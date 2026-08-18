'use client'

import { useEffect, useState } from 'react'
import { PasswordInput } from '@/components/PasswordInput'

const COOKIE_NAME = 'edge8_private_ok'
const ACCESS_CODE = 'Edge82026'
const COOKIE_MAX_AGE_DAYS = 90

function hasAccessCookie() {
  return document.cookie
    .split('; ')
    .some((row) => row.startsWith(`${COOKIE_NAME}=1`))
}

function setAccessCookie() {
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60
  document.cookie = `${COOKIE_NAME}=1; path=/workflows/private; max-age=${maxAge}; SameSite=Lax`
}

export default function PrivateGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  const [ready, setReady] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (hasAccessCookie()) setUnlocked(true)
    setReady(true)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code === ACCESS_CODE) {
      setAccessCookie()
      setUnlocked(true)
      setError(false)
    } else {
      setError(true)
    }
  }

  if (!ready) return null

  if (!unlocked) {
    return (
      <section className="section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
        <div className="container" style={{ maxWidth: 420 }}>
          <span className="section-label">Internal · Access required</span>
          <h1 className="section-title" style={{ fontSize: 30, marginBottom: 12 }}>
            Private workflows library
          </h1>
          <p className="wf-hero-sub" style={{ marginBottom: 24 }}>
            Enter the access code to view this page.
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
            <PasswordInput
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setError(false)
              }}
              placeholder="Access code"
              autoFocus
              wrapperStyle={{ flex: 1 }}
              inputStyle={{
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

  return <>{children}</>
}
