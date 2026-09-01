import { companyOs } from '@/lib/supabase'

export interface RoiStats {
  totalRuns: number
  pdfDownloads: number
  conversionPct: number
  runs30d: number
  commonTeamSize: number | null
  avgMonthlySavingCents: number | null
}

const T = 'roi_usage_events'

export async function getRoiStats(): Promise<RoiStats> {
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [total, pdf, last30, spread] = await Promise.all([
    companyOs.from(T).select('id', { count: 'exact', head: true }),
    companyOs.from(T).select('id', { count: 'exact', head: true }).eq('pdf_requested', true),
    companyOs.from(T).select('id', { count: 'exact', head: true }).gte('created_at', since30),
    companyOs.from(T).select('team_size, monthly_saving_low_cents, monthly_saving_high_cents'),
  ])

  const rows = spread.data ?? []
  // Most common team size (mode).
  const freq = new Map<number, number>()
  for (const r of rows) freq.set(r.team_size, (freq.get(r.team_size) ?? 0) + 1)
  let commonTeamSize: number | null = null, best = 0
  for (const [size, n] of freq) if (n > best) { best = n; commonTeamSize = size }

  // Average of each run's midpoint monthly saving.
  const mids = rows.map(r => (r.monthly_saving_low_cents + r.monthly_saving_high_cents) / 2)
  const avgMonthlySavingCents = mids.length ? Math.round(mids.reduce((a, b) => a + b, 0) / mids.length) : null

  const totalRuns = total.count ?? 0
  const pdfDownloads = pdf.count ?? 0
  return {
    totalRuns,
    pdfDownloads,
    conversionPct: totalRuns ? Math.round((pdfDownloads / totalRuns) * 100) : 0,
    runs30d: last30.count ?? 0,
    commonTeamSize,
    avgMonthlySavingCents,
  }
}

export interface RoiEvent {
  id: string
  created_at: string
  team_size: number
  queries_per_user: number
  salary_cents: number | null
  hourly_rate_cents: number | null
  monthly_saving_low_cents: number
  monthly_saving_high_cents: number
  pdf_requested: boolean
}

export async function listRoiEvents(opts: { page: number; pageSize: number }): Promise<{ rows: RoiEvent[]; total: number }> {
  const from = (opts.page - 1) * opts.pageSize
  const { data, count } = await companyOs
    .from(T)
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + opts.pageSize - 1)
  return { rows: (data ?? []) as RoiEvent[], total: count ?? 0 }
}
