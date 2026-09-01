import { PageHead } from '@/components/admin/PageHead'
import { MetricCard } from '@/components/admin/MetricCard'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { Badge } from '@/components/admin/Badge'
import { formatDate } from '@/lib/admin/format'
import { firstParam, type SearchParamsObj } from '@/lib/admin/url'
import { getRoiStats, listRoiEvents, type RoiEvent } from '@/lib/admin/roi-stats'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const metadata = { title: 'Beryl ROI · Usage' }

const PAGE_SIZE = 25

const aud = (cents: number | null | undefined) =>
  cents == null
    ? 'n/a'
    : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(cents / 100)

const savingRange = (r: RoiEvent) =>
  r.monthly_saving_low_cents === r.monthly_saving_high_cents
    ? aud(r.monthly_saving_low_cents)
    : `${aud(r.monthly_saving_low_cents)} – ${aud(r.monthly_saving_high_cents)}`

export default async function BerylRoiUsagePage({ searchParams }: { searchParams: SearchParamsObj }) {
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? '1') || 1)
  const [stats, { rows, total }] = await Promise.all([
    getRoiStats(),
    listRoiEvents({ page, pageSize: PAGE_SIZE }),
  ])

  const columns: Column<RoiEvent>[] = [
    { key: 'created_at', header: 'When', cell: r => formatDate(r.created_at) },
    { key: 'team_size', header: 'Team', align: 'right', cell: r => r.team_size },
    { key: 'queries_per_user', header: 'Q / user', align: 'right', cell: r => r.queries_per_user },
    { key: 'salary_cents', header: 'Team salary', align: 'right', cell: r => aud(r.salary_cents) },
    { key: 'hourly_rate_cents', header: 'Hourly', align: 'right', cell: r => aud(r.hourly_rate_cents) },
    { key: 'monthly_saving', header: 'Monthly saving', align: 'right', cell: savingRange },
    { key: 'pdf_requested', header: 'PDF', cell: r => r.pdf_requested ? <Badge tone="ok">Downloaded</Badge> : <Badge tone="neutral">No</Badge> },
  ]

  return (
    <>
      <PageHead
        eyebrow="Marketing"
        title="Beryl ROI Calculator"
        sub="How the public ROI widget is being used, and how many prospects convert to a PDF lead."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <MetricCard label="Total runs" value={stats.totalRuns.toLocaleString()} sub="all time" />
        <MetricCard label="PDF downloads" value={stats.pdfDownloads.toLocaleString()} sub={`${stats.conversionPct}% of runs`} />
        <MetricCard label="Runs (30 days)" value={stats.runs30d.toLocaleString()} sub="last 30 days" />
        <MetricCard label="Common team size" value={stats.commonTeamSize ?? 'n/a'} sub="most entered" />
        <MetricCard label="Avg monthly saving" value={aud(stats.avgMonthlySavingCents)} sub="per run, midpoint" />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        basePath="/admin/revenue/marketing/beryl-roi"
        searchParams={searchParams}
        emptyText="No calculator runs yet."
      />
    </>
  )
}
