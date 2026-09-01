'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  computeRoi,
  formatCents,
  type RoiAssumptions,
  type BerylPrice,
} from '@/lib/roi'

// Build 1 — prove the loop. Ungated, no styling polish beyond legible; brand
// styling, PDF, lead capture and usage logging land in Build 2.

type Loaded = { assumptions: RoiAssumptions; price: BerylPrice }

export default function BerylRoiPage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState(false)

  const [teamSize, setTeamSize] = useState('5')
  const [queriesPerUser, setQueriesPerUser] = useState('')
  const [salary, setSalary] = useState('')

  useEffect(() => {
    fetch('/api/roi/assumptions')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Loaded) => {
        setLoaded(d)
        // Pre-fill the query field with the typical-usage benchmark.
        setQueriesPerUser(String(d.assumptions.typicalQueriesPerUser))
      })
      .catch(() => setLoadError(true))
  }, [])

  const nums = useMemo(() => {
    const t = Number(teamSize)
    const q = Number(queriesPerUser)
    const s = Number(salary)
    const valid =
      Number.isFinite(t) && t > 0 &&
      Number.isFinite(q) && q > 0 &&
      Number.isFinite(s) && s > 0
    return { t, q, s, valid }
  }, [teamSize, queriesPerUser, salary])

  const result = useMemo(() => {
    if (!loaded || !nums.valid) return null
    return computeRoi(
      // Salary is entered as the team total; the model works per-user, so divide.
      { teamSize: nums.t, queriesPerUser: nums.q, annualSalary: nums.s / nums.t },
      loaded.assumptions,
      loaded.price,
    )
  }, [loaded, nums])

  const currency = loaded?.price.currency ?? 'aud'
  const range = (low: number, high: number) =>
    low === high ? formatCents(low, currency) : `${formatCents(low, currency)} – ${formatCents(high, currency)}`

  return (
    <main className="roi">
      <div className="wrap">
        <p className="eyebrow">Australian Payroll Association · Beryl</p>
        <h1>Is Beryl worth it? Do the maths.</h1>
        <p className="lede">
          Enter your team&rsquo;s numbers and see what Beryl buys back in time —
          against {loaded ? formatCents(loaded.price.amountCents, currency, { exact: true }) : '$49.95'}/user/month.
        </p>

        {loadError && (
          <p className="err">Couldn&rsquo;t load the calculator right now. Please refresh.</p>
        )}

        <div className="grid">
          {/* Inputs */}
          <section className="card inputs">
            <label>
              <span>Team size <em>(Beryl users)</em></span>
              <input type="number" min="1" inputMode="numeric" value={teamSize}
                onChange={e => setTeamSize(e.target.value)} />
            </label>
            <label>
              <span>Queries per user / month</span>
              <input type="number" min="1" inputMode="numeric" value={queriesPerUser}
                onChange={e => setQueriesPerUser(e.target.value)} />
              {loaded && (
                <small>
                  Typical Beryl user asks ~{loaded.assumptions.typicalQueriesPerUser}/month — adjust to your team.
                </small>
              )}
            </label>
            <label>
              <span>Total team salary <em>per year (required)</em></span>
              <input type="number" min="1" inputMode="numeric" placeholder="e.g. 375000"
                value={salary} onChange={e => setSalary(e.target.value)} />
              <small>
                Combined annual salary of all {nums.valid ? nums.t : 'your'} Beryl users. We divide by team size,
                then by {loaded?.assumptions.workingHoursYear ?? 1800} working hours/year, to get an hourly rate
                {nums.valid ? ` (≈ ${formatCents(Math.round((nums.s / nums.t) / (loaded?.assumptions.workingHoursYear ?? 1800) * 100), currency, { exact: true })}/hr).` : '.'}
              </small>
            </label>
          </section>

          {/* Result */}
          <section className="card result" aria-live="polite">
            {!result ? (
              <p className="hint">
                {loaded ? 'Enter team size, queries and salary to see your savings.' : 'Loading…'}
              </p>
            ) : (
              <>
                <div className="headline">
                  <span className="k">Monthly saving <em>· whole team</em></span>
                  <span className="v big">{range(result.monthlySavingLowCents, result.monthlySavingHighCents)}</span>
                  <span className="peruser">
                    = {range(result.monthlySavingLowCents / nums.t, result.monthlySavingHighCents / nums.t)} per user, per month
                  </span>
                </div>
                <div className="row"><span className="k">Annual saving <em>· team</em></span>
                  <span className="v">{range(result.annualSavingLowCents, result.annualSavingHighCents)}</span></div>
                <div className="row"><span className="k">Beryl cost <em>· {formatCents(loaded!.price.amountCents, currency, { exact: true })} × {nums.t} user{nums.t === 1 ? '' : 's'}</em></span>
                  <span className="v">{formatCents(result.berylCostCents, currency, { exact: true })}</span></div>
                <div className="row net"><span className="k">Net benefit / month</span>
                  <span className="v">{range(result.netBenefitLowCents, result.netBenefitHighCents)}</span></div>
                <div className="row"><span className="k">ROI</span>
                  <span className="v">
                    {result.roiMultipleLow === result.roiMultipleHigh
                      ? `${result.roiMultipleLow.toFixed(1)}×`
                      : `${result.roiMultipleLow.toFixed(1)}× – ${result.roiMultipleHigh.toFixed(1)}×`}
                  </span></div>
                <p className="basis">
                  Based on {loaded!.assumptions.timeSavedMinMinutes === loaded!.assumptions.timeSavedMaxMinutes
                    ? `${loaded!.assumptions.timeSavedMinMinutes} min`
                    : `${loaded!.assumptions.timeSavedMinMinutes}–${loaded!.assumptions.timeSavedMaxMinutes} min`} saved per query
                  across {result.totalQueries} queries/month.
                </p>
              </>
            )}
          </section>
        </div>
      </div>

      <style jsx>{`
        .roi { background: #eff1f5; min-height: 100vh; color: #3a3839;
          font-family: "Source Sans 3", system-ui, sans-serif; padding: 48px 20px 96px; }
        .wrap { max-width: 860px; margin: 0 auto; }
        .eyebrow { font-size: .72rem; font-weight: 600; letter-spacing: .16em; text-transform: uppercase;
          color: #48608a; margin: 0 0 14px; }
        h1 { font-family: "Montserrat", system-ui, sans-serif; color: #2a3850; font-size: 2.1rem;
          line-height: 1.1; letter-spacing: -.02em; margin: 0 0 12px; }
        .lede { font-size: 1.1rem; color: #3a3839; max-width: 60ch; margin: 0 0 28px; }
        .err { color: #a4382f; font-weight: 600; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
        @media (max-width: 680px) { .grid { grid-template-columns: 1fr; } }
        .card { background: #fff; border: 1px solid #dde2ea; border-radius: 12px; padding: 22px;
          box-shadow: 0 1px 2px rgba(42,56,80,.05), 0 8px 28px rgba(42,56,80,.06); }
        .inputs label { display: block; margin-bottom: 18px; }
        .inputs label:last-child { margin-bottom: 0; }
        .inputs span { display: block; font-family: "Montserrat", system-ui, sans-serif; font-weight: 600;
          font-size: .9rem; color: #2a3850; margin-bottom: 6px; }
        .inputs em { color: #6b7484; font-style: normal; font-weight: 500; }
        .inputs input { width: 100%; box-sizing: border-box; padding: 10px 12px; font-size: 1rem;
          border: 1px solid #cfd6e0; border-radius: 8px; background: #f6f8fb; color: #2a3850; }
        .inputs input:focus { outline: 2px solid #48608a; outline-offset: 1px; border-color: #48608a; }
        .inputs small { display: block; color: #6b7484; font-size: .82rem; margin-top: 5px; }
        .result { position: sticky; top: 20px; }
        .hint { color: #6b7484; margin: 0; }
        .headline { border-bottom: 1px solid #dde2ea; padding-bottom: 14px; margin-bottom: 4px; }
        .headline .k { display: block; font-size: .72rem; letter-spacing: .1em; text-transform: uppercase;
          color: #6b7484; font-weight: 600; margin-bottom: 4px; }
        .v.big { display: block; font-family: "Montserrat", system-ui, sans-serif; font-size: 1.9rem;
          font-weight: 700; color: #48608a; font-variant-numeric: tabular-nums; }
        .peruser { display: block; margin-top: 4px; font-size: .9rem; color: #2f7d5b; font-weight: 600;
          font-variant-numeric: tabular-nums; }
        .row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
          padding: 9px 0; border-bottom: 1px solid #eef1f6; }
        .row .k { color: #6b7484; font-size: .92rem; }
        .row .v { font-family: "Montserrat", system-ui, sans-serif; font-weight: 600; color: #2a3850;
          font-variant-numeric: tabular-nums; }
        .row.net .v { color: #2f7d5b; }
        .basis { color: #6b7484; font-size: .82rem; margin: 12px 0 0; }
      `}</style>
    </main>
  )
}
