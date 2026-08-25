import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkHtml from 'remark-html'
import { allPosts, PostMeta } from './postData'

export type { PostMeta }
export { allPosts }

export interface FaqItem {
  question: string
  answer: string
}

export interface Post extends PostMeta {
  contentHtml: string
  faq: FaqItem[]
}

const contentDir = path.join(process.cwd(), 'content', 'blog')

// Pull the FAQ out of a post's markdown so the page can emit FAQPage
// structured data. Posts write their FAQ as the established accordion:
//   <details class="faq-item"><summary>Question</summary>
//
//   Answer paragraph(s).
//   </details>
// The answer is reduced to plain text (tags and markdown emphasis stripped);
// Google's FAQPage schema wants the plain answer, and this keeps the JSON-LD
// free of the markup the visible accordion still renders.
function extractFaq(markdown: string): FaqItem[] {
  const items: FaqItem[] = []
  const block = /<details[^>]*class="faq-item"[^>]*>([\s\S]*?)<\/details>/gi
  let m: RegExpExecArray | null
  while ((m = block.exec(markdown)) !== null) {
    const inner = m[1]
    const sum = inner.match(/<summary>([\s\S]*?)<\/summary>/i)
    if (!sum) continue
    const question = plain(sum[1])
    const answer = plain(inner.replace(/<summary>[\s\S]*?<\/summary>/i, ''))
    if (question && answer) items.push({ question, answer })
  }
  return items
}

function plain(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ') // strip any tags
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1') // italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links -> text
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/\s+/g, ' ')
    .trim()
}

export async function getPostDataBySlug(slug: string): Promise<Post | null> {
  const post = allPosts.find((p) => p.slug === slug)
  if (!post) return null

  const fullPath = path.join(contentDir, `${post.mdFile}.md`)

  if (!fs.existsSync(fullPath)) {
    return { ...post, contentHtml: '<p>Content coming soon.</p>', faq: [] }
  }

  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { content: rawContent } = matter(fileContents)
  const faq = extractFaq(rawContent)

  // Strip the title (H1) and metadata block (Published, Source, Category, etc.)
  // that appears before the first --- separator in all post markdown files
  const hrIndex = rawContent.search(/\n---+\s*\n/)
  const content = hrIndex !== -1 ? rawContent.slice(hrIndex).replace(/^---+\s*\n/, '') : rawContent

  // sanitize:false lets first-party markdown use raw HTML — <figure>/<figcaption>
  // exhibit framing and the <details> FAQ accordion. Pure-markdown posts are unaffected.
  const processedContent = await remark().use(remarkHtml, { sanitize: false }).process(content)
  const contentHtml = processedContent.toString()

  return { ...post, contentHtml, faq }
}

export function getAllSlugs(): string[] {
  return allPosts.map((p) => p.slug)
}
