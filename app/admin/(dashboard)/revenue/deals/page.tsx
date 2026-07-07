import { companyOs } from "@/lib/supabase";
import { getActiveBrandId } from "@/lib/admin/brand";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { formatCents } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import type { KanbanColumn } from "@/components/admin/KanbanBoard";
import { DealsBoard, HANDOFF_COLUMN_ID, type DealCard, type StageOption } from "./DealsBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Deals",
  description: "The closer's pipeline board and revenue forecast.",
};

const STAGE_ACCENT: Record<number, string> = {
  0: "var(--admin-accent)",
  1: "#6b7194",
  2: "#D1458B",
  3: "#f59e0b",
};

type Stage = { id: string; name: string; position: number; is_won: boolean; is_lost: boolean };
type Embedded<T> = T | T[] | null;
type Row = {
  id: string;
  title: string | null;
  stage_id: string | null;
  amount_cents: number | null;
  currency: string | null;
  probability: number | null;
  status: string | null;
  expected_close_date: string | null;
  source: string | null;
  person_id: string | null;
  next_step: string | null;
  next_step_date: string | null;
  proposal_url: string | null;
  contract_url: string | null;
  handoff_status: string | null;
  lost_reason: string | null;
  archived_at: string | null;
  updated_at: string | null;
  people: Embedded<{ full_name: string | null; email: string }>;
  companies: Embedded<{ name: string | null }>;
};

const one = <T,>(e: Embedded<T>): T | null => (Array.isArray(e) ? e[0] ?? null : e);

export default async function DealsPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const brandId = getActiveBrandId();
  const initialSelectedId = firstParam(searchParams.deal) ?? null;

  const { data: stages } = await companyOs
    .from("pipeline_stages")
    .select("id, name, position, is_won, is_lost")
    .order("position");

  const stageList = (stages as Stage[] | null) ?? [];
  const lostStageIds = stageList.filter((s) => s.is_lost).map((s) => s.id);
  const stageOptions: StageOption[] = stageList
    .filter((s) => !s.is_won && !s.is_lost)
    .map((s) => ({ id: s.id, name: s.name }));

  const columns: KanbanColumn[] = [
    { id: HANDOFF_COLUMN_ID, label: "New from SDR", accent: "#8b5cf6" },
    ...stageList.map((s) => ({
      id: s.id,
      label: s.name,
      accent: s.is_won ? "#1a9e74" : s.is_lost ? "#9ca3af" : STAGE_ACCENT[s.position] ?? "#6b7194",
    })),
  ];
  const firstStageId = stageList[0]?.id ?? "";

  let query = companyOs
    .from("deals")
    .select(
      "id, title, stage_id, amount_cents, currency, probability, status, expected_close_date, source, person_id, next_step, next_step_date, proposal_url, contract_url, handoff_status, lost_reason, archived_at, updated_at, people!person_id(full_name, email), companies(name)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (brandId) query = query.eq("brand_id", brandId);

  const { data, error } = await query;

  const cards: DealCard[] = ((data as Row[] | null) ?? []).map((r) => {
    const p = one(r.people);
    const co = one(r.companies);
    const pendingHandoff = r.handoff_status === "pending" && r.status === "open";
    return {
      id: r.id,
      columnId: pendingHandoff ? HANDOFF_COLUMN_ID : r.stage_id ?? firstStageId,
      stageId: r.stage_id ?? firstStageId,
      title: r.title,
      personId: r.person_id,
      personName: p?.full_name ?? p?.email ?? null,
      companyName: co?.name ?? null,
      amountCents: r.amount_cents,
      currency: r.currency,
      probability: r.probability,
      status: r.status,
      expectedClose: r.expected_close_date,
      source: r.source,
      nextStep: r.next_step,
      nextStepDate: r.next_step_date,
      proposalUrl: r.proposal_url,
      contractUrl: r.contract_url,
      handoffStatus: r.handoff_status ?? "none",
      lostReason: r.lost_reason,
      archivedAt: r.archived_at,
      updatedAt: r.updated_at,
    };
  });

  // KPIs and the board ignore archived deals; the list can opt in to show them.
  const activeCards = cards.filter((c) => !c.archivedAt);
  const openCards = activeCards.filter((c) => c.status === "open");
  const openPipeline = openCards.reduce((s, c) => s + (c.amountCents ?? 0), 0);
  const weighted = openCards.reduce(
    (s, c) => s + (c.amountCents ?? 0) * ((c.probability ?? 0) / 100),
    0,
  );
  const monthEnd = new Date();
  monthEnd.setMonth(monthEnd.getMonth() + 1, 1);
  monthEnd.setHours(0, 0, 0, 0);
  const closingThisMonth = openCards
    .filter((c) => c.expectedClose && new Date(c.expectedClose) < monthEnd)
    .reduce((s, c) => s + (c.amountCents ?? 0), 0);
  const noNextStep = openCards.filter((c) => !c.nextStepDate).length;
  const pendingHandoffs = activeCards.filter((c) => c.columnId === HANDOFF_COLUMN_ID).length;

  return (
    <>
      <PageHead
        eyebrow="Revenue"
        title="Deals"
        sub={`${openCards.length} open · ${pendingHandoffs} awaiting handoff decision · board or list view`}
      />
      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error.message}
        </div>
      )}
      <div className="mp-kpi-grid" style={{ marginBottom: 16 }}>
        <MetricCard label="Open pipeline" value={formatCents(openPipeline)} />
        <MetricCard label="Weighted" value={formatCents(Math.round(weighted))} />
        <MetricCard label="Closing this month" value={formatCents(closingThisMonth)} />
        <MetricCard
          label="No next step"
          value={noNextStep}
          sub={noNextStep > 0 ? "open deals silently dying" : "every deal has a next step"}
        />
      </div>
      <DealsBoard
        columns={columns}
        initialCards={cards}
        lostStageIds={lostStageIds}
        stageOptions={stageOptions}
        initialSelectedId={initialSelectedId}
      />
    </>
  );
}
