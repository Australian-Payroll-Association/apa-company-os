import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getAllSlugs, getPostDataBySlug } from '@/lib/posts'
import { allPosts } from '@/lib/postData'

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = allPosts.find((p) => p.slug === params.slug)
  if (!post) return {}
  const title = `${post.title} | Edge8 Blog`
  // Prefer real excerpt; fall back to a short generated line so Google never sees "8 min read · Innovation"
  const description = (post.excerpt && post.excerpt.length > 30)
    ? post.excerpt.slice(0, 160)
    : `${post.title}. ${post.readTime} on AI and business by Edge8.`
  const canonical = `/post/${post.slug}/`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'article',
      images: post.image ? [{ url: post.image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: post.image ? [post.image] : undefined,
    },
  }
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPostDataBySlug(params.slug)
  if (!post) notFound()

  // FAQPage structured data, so the post's Q&As are eligible for Google rich
  // results and can be lifted directly by AI answer engines. Rendered only when
  // the post actually carries an FAQ.
  const faqJsonLd = post.faq.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: post.faq.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      }
    : null

  // Sidebar: recent posts from same category (excluding this post)
  const relatedPosts = allPosts
    .filter((p) => p.categorySlug === post.categorySlug && p.slug !== post.slug)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  return (
    <main>
      {faqJsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      {/* ═══ POST HERO — dark section, cover image only ══════════ */}
      <section className="post-hero">
        <div className="post-cover-wrap">
          <Image
            src={post.image}
            alt={post.title}
            width={1600}
            height={520}
            className="post-cover"
            priority
          />
        </div>
      </section>

      {/* ═══ POST CONTENT ════════════════════════════════════════ */}
      <section className="post-section">
        <div className="container">
          <div className="post-layout">
            {/* Main article */}
            <article>
              <div className="post-meta">
                <Link href={`/blog#${post.categorySlug}`} className="post-category-tag">
                  {post.category}
                </Link>
                <span className="post-date">
                  {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="post-read-time">{post.readTime}</span>
              </div>
              <h1 className="post-title">{post.title}</h1>
              <div
                className="post-body"
                dangerouslySetInnerHTML={{ __html: post.contentHtml }}
              />
              <div className="post-all-posts">
                <Link href="/blog" className="btn btn-secondary">← All Posts</Link>
              </div>
            </article>

            {/* Sidebar */}
            <aside className="post-sidebar">
              <div className="sidebar-title">More in {post.category}</div>
              {relatedPosts.map((p) => (
                <Link key={p.slug} href={`/post/${p.slug}`} className="sidebar-post">
                  <Image
                    src={p.image}
                    alt={p.title}
                    width={64}
                    height={64}
                    className="sidebar-post-img"
                  />
                  <div className="sidebar-post-text">
                    <div className="sidebar-post-title">{p.title}</div>
                    <div className="sidebar-post-date">
                      {new Date(p.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </Link>
              ))}

            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}
