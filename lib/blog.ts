import { unstable_cache } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { allPosts, type PostMeta } from "@/lib/postData";
import { getPostDataBySlug, renderPostMarkdown, extractFaq, type Post } from "@/lib/posts";

// Unified blog lookup: the public site reads published posts from BOTH the 29
// legacy static posts (lib/postData.ts + content/blog markdown) and blog assets
// published from the marketing system (company_os.marketing_calendar). Every
// surface — /post/[slug], /blog, the sitemap, related posts — goes through here
// so the two sources render identically. DB reads are tag-cached and degrade to
// [] on failure, so the site never depends on Supabase being up.

export const BLOG_CACHE_TAG = "blog-posts";
export const postTag = (slug: string) => `post:${slug}`;

export type PostSource = "static" | "db";
export type UnifiedPostMeta = PostMeta & { source: PostSource };

type DbListRow = {
  slug: string;
  title: string;
  publish_date: string | null;
  published_at: string | null;
  category: string | null;
  category_slug: string | null;
  image_url: string | null;
  read_time: string | null;
  excerpt: string | null;
};

const LIST_COLUMNS =
  "slug, title, publish_date, published_at, category, category_slug, image_url, read_time, excerpt";

function mapDbMeta(row: DbListRow): UnifiedPostMeta {
  return {
    source: "db",
    slug: row.slug,
    title: row.title,
    date: row.publish_date ?? (row.published_at ? row.published_at.slice(0, 10) : ""),
    category: row.category ?? "Innovation",
    categorySlug: row.category_slug ?? "innovation",
    image: row.image_url ?? "",
    readTime: row.read_time ?? "",
    tags: [],
    mdFile: "", // unused for DB posts; body comes from copy_md
    excerpt: row.excerpt ?? "",
  };
}

// Cached list of published DB blog posts (metadata only, no copy_md). try/catch
// → [] mirrors lib/jobs.getActiveJobs so a DB blip degrades to static-only.
const getDbPostsList = unstable_cache(
  async (): Promise<UnifiedPostMeta[]> => {
    try {
      const { data, error } = await companyOs
        .from("marketing_calendar")
        .select(LIST_COLUMNS)
        .eq("channel", "blog")
        .eq("status", "published")
        .not("slug", "is", null)
        .order("publish_date", { ascending: false });
      if (error) return [];
      return ((data ?? []) as DbListRow[]).map(mapDbMeta);
    } catch {
      return [];
    }
  },
  ["db-blog-posts-list"],
  { tags: [BLOG_CACHE_TAG], revalidate: 3600 },
);

// All published posts, static + DB, newest first. Static wins on a slug
// collision (defense in depth; the publish action also blocks collisions).
export async function getAllPublishedPosts(): Promise<UnifiedPostMeta[]> {
  const staticMetas: UnifiedPostMeta[] = allPosts.map((p) => ({ ...p, source: "static" }));
  const staticSlugs = new Set(staticMetas.map((p) => p.slug));
  const dbMetas = (await getDbPostsList()).filter((p) => !staticSlugs.has(p.slug));
  return [...staticMetas, ...dbMetas].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

// Full post (with rendered HTML + FAQ) for one slug. Static first; then DB. The
// DB fetch is cached per-slug and, on an uncached DB failure, THROWS rather than
// returning null — a transient outage must not be cached as a 404. A successful
// query that finds no row returns null (a real 404).
export async function getUnifiedPostBySlug(slug: string): Promise<Post | null> {
  const staticPost = await getPostDataBySlug(slug);
  if (staticPost) return staticPost;
  return getDbPostBySlug(slug);
}

const getDbPostBySlug = (slug: string) =>
  unstable_cache(
    async (): Promise<Post | null> => {
      const { data, error } = await companyOs
        .from("marketing_calendar")
        .select(`${LIST_COLUMNS}, copy_md, title_tag, meta_description, primary_keyword`)
        .eq("channel", "blog")
        .eq("status", "published")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(`blog db read failed: ${error.message}`);
      if (!data) return null;
      const row = data as DbListRow & {
        copy_md: string | null;
        title_tag: string | null;
        meta_description: string | null;
        primary_keyword: string | null;
      };
      const meta = mapDbMeta(row);
      const copy = row.copy_md ?? "";
      const contentHtml = await renderPostMarkdown(copy);
      const faq = extractFaq(copy);
      return {
        ...meta,
        contentHtml,
        faq,
        titleTag: row.title_tag,
        metaDescription: row.meta_description,
      };
    },
    [`db-blog-post-${slug}`],
    { tags: [BLOG_CACHE_TAG, postTag(slug)], revalidate: 3600 },
  )();
