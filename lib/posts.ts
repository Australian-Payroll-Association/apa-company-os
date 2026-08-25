import { remark } from 'remark'
import remarkHtml from 'remark-html'
import type { PostMeta } from './postData'

export type { PostMeta }

export interface FaqItem {
  question: string
  answer: string
}

export interface Post extends PostMeta {
  contentHtml: string
  faq: FaqItem[]
  // DB-backed posts (lib/blog.ts) carry a purpose-built title tag and meta
  // description from their SEO plan; static posts leave these undefined and
  // generateMetadata falls back to title/excerpt as before.
  titleTag?: string | null
  metaDescription?: string | null
}

// Pull the FAQ out of a post's markdown so the page can emit FAQPage
// structured data. Posts write their FAQ as the established accordion:
//   <details class="faq-item"><summary>Question</summary>
//
//   Answer paragraph(s).
//   </details>
// The answer is reduced to plain text (tags and markdown emphasis stripped);
// Google's FAQPage schema wants the plain answer, and this keeps the JSON-LD
// free of the markup the visible accordion still renders.
export function extractFaq(markdown: string): FaqItem[] {
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

// The single markdown → HTML pipeline every post body goes through. sanitize:false
// lets first-party markdown use raw HTML: <figure>/<figcaption> exhibit framing and
// the <details class="faq-item"> FAQ accordion. Shared so DB-backed posts (lib/blog.ts)
// render byte-identically to the file-backed ones.
export async function renderPostMarkdown(markdown: string): Promise<string> {
  const processed = await remark().use(remarkHtml, { sanitize: false }).process(markdown)
  return processed.toString()
}


