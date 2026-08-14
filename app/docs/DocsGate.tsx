'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const COOKIE_NAME = 'edge8_docs_ok'
const ACCESS_CODE = 'Edge82026'
const COOKIE_MAX_AGE_DAYS = 90

// Same access code and shape as the private workflows library, but scoped to
// /docs so unlocking one area does not silently unlock the other. The check
// that matters is server side: app/docs/page.tsx and app/docs/[slug]/route.ts
// both read this cookie before any document content is fetched or returned.
export default function DocsGate() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code !== ACCESS_CODE) {
      setError(true)
      return
    }
    const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60
    document.cookie = `${COOKIE_NAME}=1; path=/docs; max-age=${maxAge}; SameSite=Lax`
    router.refresh()
  }

  return (
    <section className="section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
      <div className="container" style={{ maxWidth: 420 }}>
        <span className="section-label">Internal · Access required</span>
        <h1 className="section-title" style={{ fontSize: 30, marginBottom: 12 }}>
          Documents
        </h1>
        <p className="wf-hero-sub" style={{ marginBottom: 24 }}>
          Enter the access code to view this page.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setError(false)
            }}
            placeholder="Access code"
            autoFocus
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 6,
              border: error ? '1px solid #e0554f' : '1px solid var(--border, #ccc)',
              fontSize: 15,
            }}
          />
          <button type="submit" className="wf-back" style={{ border: 'none', cursor: 'pointer' }}>
            Unlock
          </button>
        </form>
        {error && (
          <p style={{ color: '#e0554f', fontSize: 14, marginTop: 8 }}>That code isn&apos;t right. Try again.</p>
        )}
      </div>
    </section>
  )
}
