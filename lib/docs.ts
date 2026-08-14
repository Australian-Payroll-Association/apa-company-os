import { supabase } from '@/lib/supabase'

// Documents live in Supabase Storage, not in the repo, so publishing one is an
// upload rather than a deploy. Nothing here is generated at build time.
export const DOCS_BUCKET = 'documents'
export const DOCS_COOKIE = 'edge8_docs_ok'

export type DocMeta = {
  slug: string
  title: string
  publishedAt: string
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)
}

// Created on first publish so there is no manual dashboard step. Private: the
// route below is the only way in, and it checks the access cookie first.
export async function ensureBucket(): Promise<void> {
  const { data } = await supabase.storage.getBucket(DOCS_BUCKET)
  if (data) return
  await supabase.storage.createBucket(DOCS_BUCKET, { public: false })
}

export async function listDocs(): Promise<DocMeta[]> {
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .list('', { limit: 200, sortBy: { column: 'updated_at', order: 'desc' } })
  if (error || !data) return []

  const slugs = data.filter((o) => o.name.endsWith('.html')).map((o) => o.name.replace(/\.html$/, ''))

  const metas = await Promise.all(
    slugs.map(async (slug) => {
      const { data: file } = await supabase.storage.from(DOCS_BUCKET).download(`${slug}.meta.json`)
      if (!file) return { slug, title: slug, publishedAt: '' }
      try {
        const meta = JSON.parse(await file.text()) as Partial<DocMeta>
        return { slug, title: meta.title || slug, publishedAt: meta.publishedAt || '' }
      } catch {
        return { slug, title: slug, publishedAt: '' }
      }
    }),
  )

  return metas.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
}
