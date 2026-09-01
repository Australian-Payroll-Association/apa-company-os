'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  computeRoi, formatCents,
  type RoiAssumptions, type BerylPrice,
} from '@/lib/roi'

// Build 2 — the embeddable widget. Standalone, APA-branded, chrome-free
// (see BARE_ROUTES in components/SiteFrame). Lead capture is the APA HubSpot
// form embedded below; this app makes NO HubSpot calls. On a successful form
// submit, the manager-ready PDF (render-only, no side effects) is offered for
// download here in the iframe.

const HS_PORTAL = '40101382'
const HS_FORM = 'c380c654-3b7e-4464-998a-d338bfd6fcb2'
const HS_REGION = 'na1'

type Loaded = { assumptions: RoiAssumptions; price: BerylPrice }

export default function BerylRoiEmbed() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [showMethod, setShowMethod] = useState(false)

  const [teamSize, setTeamSize] = useState('5')
  const [queriesPerUser, setQueriesPerUser] = useState('')
  const [salary, setSalary] = useState('')

  const [showForm, setShowForm] = useState(false)
  // idle -> (form submitted) preparing -> ready (download link) | error
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'preparing' | 'ready' | 'error'>('idle')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const logged = useRef(false)
  const usageId = useRef<string | null>(null)
  const hsCreated = useRef(false)
  const contactRef = useRef({ firstname: '', lastname: '', jobtitle: '' })
  const inputsRef = useRef({ t: 0, q: 0, s: 0, valid: false })

  useEffect(() => {
    fetch('/api/roi/assumptions')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Loaded) => { setLoaded(d); setQueriesPerUser(String(d.assumptions.typicalQueriesPerUser)) })
      .catch(() => setLoadError(true))
  }, [])

  // Auto-resize the host iframe (also catches the HubSpot form + PDF button).
  useEffect(() => {
    const post = () => window.parent?.postMessage(
      { type: 'beryl-roi:height', height: Math.ceil(document.documentElement.scrollHeight) }, '*')
    post()
    const ro = new ResizeObserver(post)
    ro.observe(document.body)
    window.addEventListener('load', post)
    return () => { ro.disconnect(); window.removeEventListener('load', post) }
  })

  const nums = useMemo(() => {
    const t = Number(teamSize), q = Number(queriesPerUser), s = Number(salary)
    return { t, q, s, valid: [t, q, s].every(n => Number.isFinite(n) && n > 0) }
  }, [teamSize, queriesPerUser, salary])
  inputsRef.current = nums

  const result = useMemo(() => {
    if (!loaded || !nums.valid) return null
    return computeRoi({ teamSize: nums.t, queriesPerUser: nums.q, annualSalary: nums.s / nums.t }, loaded.assumptions, loaded.price)
  }, [loaded, nums])

  // Anonymous usage row on first valid result (no PII, no HubSpot).
  useEffect(() => {
    if (!result || logged.current) return
    logged.current = true
    fetch('/api/roi/usage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamSize: nums.t, queriesPerUser: nums.q, salary: nums.s }),
    }).then(r => r.ok ? r.json() : null).then(d => { if (d?.id) usageId.current = d.id }).catch(() => {})
  }, [result, nums])

  // Fetch the render-only PDF and expose it as a download link.
  async function preparePdf() {
    const cur = inputsRef.current
    if (!cur.valid) return
    setPdfStatus('preparing')
    try {
      const res = await fetch('/api/roi/pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contactRef.current, teamSize: cur.t, queriesPerUser: cur.q, salary: cur.s }),
      })
      if (!res.ok) throw new Error('pdf')
      const blob = await res.blob()
      setPdfUrl(URL.createObjectURL(blob))
      setPdfStatus('ready')
    } catch { setPdfStatus('error') }
  }

  // Load HubSpot's form embed and render the APA form once the user opts in.
  useEffect(() => {
    if (!showForm || hsCreated.current) return
    const ensure = () => new Promise<void>((resolve) => {
      if ((window as any).hbspt) return resolve()
      const s = document.createElement('script')
      s.src = 'https://js.hsforms.net/forms/embed/v2.js'
      s.async = true
      s.onload = () => resolve()
      document.body.appendChild(s)
    })
    ensure().then(() => {
      const hbspt = (window as any).hbspt
      if (!hbspt?.forms || hsCreated.current) return
      hsCreated.current = true
      hbspt.forms.create({
        region: HS_REGION,
        portalId: HS_PORTAL,
        formId: HS_FORM,
        target: '#beryl-hs-form',
        // Capture the entered name (client-side only) purely to personalise the
        // PDF — nothing is stored or sent anywhere by this app.
        onFormSubmit: ($form: any) => {
          try {
            const v = (n: string) => $form?.find?.(`input[name="${n}"]`)?.val?.() || ''
            contactRef.current = { firstname: v('firstname'), lastname: v('lastname'), jobtitle: v('jobtitle') }
          } catch {}
        },
        // HubSpot has captured the lead natively; now offer the PDF.
        onFormSubmitted: () => { preparePdf() },
      })
    })
  }, [showForm])

  const currency = loaded?.price.currency ?? 'aud'
  const range = (lo: number, hi: number) =>
    lo === hi ? formatCents(lo, currency) : `${formatCents(lo, currency)} – ${formatCents(hi, currency)}`
  const timeSaved = loaded
    ? (loaded.assumptions.timeSavedMinMinutes === loaded.assumptions.timeSavedMaxMinutes
        ? `${loaded.assumptions.timeSavedMinMinutes} min`
        : `${loaded.assumptions.timeSavedMinMinutes}–${loaded.assumptions.timeSavedMaxMinutes} min`)
    : ''

  return (
    <div className="beryl">
      <link rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700&family=Source+Sans+3:wght@400;600&display=swap" />

      {loadError && <p className="err">The calculator couldn&rsquo;t load. Please refresh the page.</p>}

      <div className="grid">
        <div className="inputs">
          <label>
            <span className="lbl">Team size <em>Beryl users</em></span>
            <input type="number" min="1" inputMode="numeric" value={teamSize} onChange={e => setTeamSize(e.target.value)} />
          </label>
          <label>
            <span className="lbl">Questions per user, per month</span>
            <input type="number" min="1" inputMode="numeric" value={queriesPerUser} onChange={e => setQueriesPerUser(e.target.value)} />
            {loaded && <small>Typical Beryl user asks about {loaded.assumptions.typicalQueriesPerUser} a month. Adjust to your team.</small>}
          </label>
          <label>
            <span className="lbl">Total team salary <em>per year</em></span>
            <input type="number" min="1" inputMode="numeric" placeholder="e.g. 375000" value={salary} onChange={e => setSalary(e.target.value)} />
            <small>Combined annual salary of all Beryl users.</small>
          </label>
        </div>

        <div className="result" aria-live="polite">
          {!result ? (
            <p className="placeholder">{loaded ? 'Enter your numbers to see the savings.' : 'Loading…'}</p>
          ) : (
            <>
              <div className="headline">
                <span className="cap">Estimated monthly saving</span>
                <span className="big">{range(result.monthlySavingLowCents, result.monthlySavingHighCents)}</span>
                <span className="per">{range(result.monthlySavingLowCents / nums.t, result.monthlySavingHighCents / nums.t)} per user, per month</span>
              </div>
              <dl>
                <div><dt>Annual saving</dt><dd>{range(result.annualSavingLowCents, result.annualSavingHighCents)}</dd></div>
                <div><dt>Beryl cost&#8202;·&#8202;{formatCents(loaded!.price.amountCents, currency, { exact: true })} × {nums.t}</dt><dd>{formatCents(result.berylCostCents, currency, { exact: true })}/mo</dd></div>
                <div className="net"><dt>Net benefit / month</dt><dd>{range(result.netBenefitLowCents, result.netBenefitHighCents)}</dd></div>
                <div><dt>Return on investment</dt><dd>{result.roiMultipleLow === result.roiMultipleHigh
                  ? `${result.roiMultipleLow.toFixed(1)}×`
                  : `${result.roiMultipleLow.toFixed(1)}× – ${result.roiMultipleHigh.toFixed(1)}×`}</dd></div>
              </dl>
            </>
          )}
        </div>
      </div>

      {/* Lead capture = the APA HubSpot form; PDF unlocks on submit */}
      {result && (
        <div className="pdf">
          {!showForm ? (
            <button type="button" className="cta" onClick={() => setShowForm(true)}>
              Get a manager ready PDF of this estimate
            </button>
          ) : (
            <div className="capture">
              {pdfStatus !== 'ready' && (
                <>
                  <p className="capnote">Enter your details to download the manager ready PDF of this estimate.</p>
                  <div id="beryl-hs-form" />
                </>
              )}
              {pdfStatus === 'preparing' && <p className="capnote">Preparing your PDF…</p>}
              {pdfStatus === 'ready' && pdfUrl && (
                <div className="ready">
                  <p className="done">✓ Thanks! Your manager ready PDF is ready.</p>
                  <a className="cta" href={pdfUrl} download="Beryl-ROI-estimate.pdf">Download your PDF</a>
                </div>
              )}
              {pdfStatus === 'error' && (
                <p className="ferr">We couldn&rsquo;t generate the PDF just now. Please try again in a moment.</p>
              )}
            </div>
          )}
        </div>
      )}

      {loaded && (
        <div className="method">
          <button type="button" onClick={() => setShowMethod(v => !v)} aria-expanded={showMethod}>
            <span>How we calculate this</span><span className="chev">{showMethod ? '–' : '+'}</span>
          </button>
          {showMethod && (
            <div className="method-body">
              <p>
                We assume Beryl saves about <b>{timeSaved}</b> per question: the time a payroll or HR person would
                otherwise spend self-resolving it (reading the award, legislation or policy, or lodging and chasing a
                helpdesk ticket). Each user&rsquo;s time is valued at their hourly rate: total team salary ÷ team size ÷
                {' '}<b>{loaded.assumptions.workingHoursYear.toLocaleString()}</b> working hours a year. Savings are shown
                against Beryl&rsquo;s {formatCents(loaded.price.amountCents, currency, { exact: true })} per user monthly price.
              </p>
              <p className="fine">Figures are an estimate to help you weigh the decision, not a guarantee. Adjust the inputs to match your team.</p>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .beryl { --blue:#48608a; --blue-d:#2a3850; --gold:#F0BD18; --ink:#3a3839;
          --muted:#6b7484; --line:#dde2ea; --surface:#fff; --ground:#f6f8fb; --good:#2f7d5b;
          font-family:"Source Sans 3", system-ui, -apple-system, sans-serif; color:var(--ink);
          font-size:18px; max-width:1200px; margin:0 auto; padding:8px; }
        .beryl *, .beryl *::before, .beryl *::after { box-sizing:border-box; }
        .err { color:#a4382f; font-weight:600; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; align-items:stretch; }
        .inputs { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:22px; }
        label { display:block; }
        .inputs label + label { margin-top:18px; }
        .lbl { display:block; font-family:"Montserrat",sans-serif; font-weight:600; font-size:1rem; color:var(--blue-d); margin-bottom:7px; }
        .lbl em { color:var(--muted); font-style:normal; font-weight:500; }
        input { width:100%; padding:12px 14px; font-size:1.1rem; font-family:inherit;
          border:1px solid #cfd6e0; border-radius:9px; background:var(--ground); color:var(--blue-d); }
        input:focus { outline:2px solid var(--blue); outline-offset:1px; border-color:var(--blue); }
        small { display:block; color:var(--muted); font-size:.9rem; margin-top:6px; line-height:1.45; }
        .result { background:var(--blue-d); border-radius:14px; padding:24px; color:#eaf0f8; }
        .placeholder { color:#aab6c8; margin:0; font-size:1.05rem; }
        .headline { border-bottom:1px solid rgba(255,255,255,.14); padding-bottom:16px; margin-bottom:16px; }
        .cap { display:block; font-family:"Montserrat",sans-serif; font-size:.74rem; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--gold); margin-bottom:7px; }
        .big { display:block; font-family:"Montserrat",sans-serif; font-size:2.6rem; font-weight:700; color:#fff; line-height:1; font-variant-numeric:tabular-nums; }
        .per { display:block; margin-top:7px; font-size:1.05rem; color:#c7d3e6; font-variant-numeric:tabular-nums; }
        dl { margin:0; }
        dl > div { display:flex; justify-content:space-between; align-items:baseline; gap:12px; padding:9px 0; border-bottom:1px solid rgba(255,255,255,.10); }
        dl > div:last-child { border-bottom:0; }
        dt { color:#b9c5d8; font-size:1rem; }
        dd { margin:0; font-size:1.05rem; font-family:"Montserrat",sans-serif; font-weight:600; color:#fff; font-variant-numeric:tabular-nums; }
        .net dd { color:#7fe0b0; }
        .pdf { margin-top:18px; }
        .cta { display:inline-block; text-decoration:none; text-align:center; font-family:"Montserrat",sans-serif; font-weight:700; font-size:1.1rem;
          color:var(--blue-d); background:var(--gold); border:0; border-radius:10px; padding:15px 22px; cursor:pointer; width:100%; }
        .cta:hover { background:#e0ad0c; }
        .cta:focus-visible { outline:2px solid var(--blue-d); outline-offset:2px; }
        .capture { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:22px; }
        .capnote { font-family:"Montserrat",sans-serif; font-weight:600; color:var(--blue-d); font-size:1rem; margin:0 0 14px; }
        .ready { text-align:center; }
        .done { background:#e6f2ec; border:1px solid #bfe0cd; color:var(--good); border-radius:12px; padding:14px 16px; margin:0 0 14px; font-weight:600; font-size:1.05rem; }
        .ferr { color:#a4382f; font-size:.95rem; margin:12px 0 0; }
        .method { margin-top:18px; }
        .method > button { width:100%; display:flex; justify-content:space-between; align-items:center; background:var(--ground);
          border:1px solid var(--line); border-radius:10px; padding:13px 18px; font-family:"Montserrat",sans-serif; font-weight:600;
          font-size:1rem; color:var(--blue-d); cursor:pointer; }
        .method > button:focus-visible { outline:2px solid var(--blue); outline-offset:2px; }
        .chev { color:var(--blue); font-size:1.2rem; line-height:1; }
        .method-body { padding:15px 18px 2px; }
        .method-body p { font-size:1rem; color:var(--ink); line-height:1.6; margin:0 0 10px; }
        .fine { color:var(--muted); font-size:.9rem; }
      `}</style>
      {/* Give HubSpot's injected form fields a look that fits the widget. */}
      <style jsx global>{`
        html, body { background:transparent; margin:0; }
        #beryl-hs-form .hs-form-field { margin-bottom:14px; }
        #beryl-hs-form label { font-family:"Montserrat",sans-serif; font-weight:600; font-size:.9rem; color:#2a3850; display:block; margin-bottom:6px; }
        #beryl-hs-form input.hs-input, #beryl-hs-form select.hs-input, #beryl-hs-form textarea.hs-input {
          width:100%; padding:12px 14px; font-size:1.05rem; border:1px solid #cfd6e0; border-radius:9px; background:#f6f8fb; color:#2a3850; }
        #beryl-hs-form .hs-button {
          font-family:"Montserrat",sans-serif; font-weight:700; font-size:1.1rem; color:#2a3850; background:#F0BD18;
          border:0; border-radius:10px; padding:14px 22px; cursor:pointer; margin-top:6px; }
        #beryl-hs-form .hs-button:hover { background:#e0ad0c; }
        #beryl-hs-form .hs-error-msg, #beryl-hs-form .hs-error-msgs label { color:#a4382f; font-weight:400; }
      `}</style>
    </div>
  )
}
