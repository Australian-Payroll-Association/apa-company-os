import { requireTeamMember } from "@/lib/team-auth";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import {
  KR_SELECT,
  OBJECTIVE_SELECT,
  LINE_LABELS,
  agentInitials,
  currentQuarter,
  personInitials,
  progressPct,
  type KrRow,
  type ObjectiveRow,
} from "@/app/admin/(dashboard)/edges/edges-shared";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Company Goals",
  description: "Company objectives and key results for the current quarter.",
};

// /team/company-goals — read-only, company-visible view of the quarter's
// company goals (objectives + key results). Same data as /admin/edges/goals
// but without the cascade, editing, or check-ins: every team member sees where
// the company is aiming and how far along each key result is.
type ObjectiveWithKrs = ObjectiveRow & { krs: KrRow[] };

function fmtValue(kr: KrRow): string {
  const t = kr.target_value == null ? null : Number(kr.target_value);
  const c = Number(kr.current_value);
  if (kr.unit === "usd") return `$${(c / 1000).toFixed(c >= 100000 ? 0 : 1)}k`;
  if (kr.unit === "%") return `${c}%`;
  if (kr.unit === "min") return `${c}m`;
  if (kr.unit === "days") return `${c}d`;
  if (t != null && kr.direction === "up" && t <= 20) return `${c}/${t}`;
  return `${c}`;
}

function barClass(kr: KrRow): string {
  const pct = progressPct(kr);
  if (kr.status === "done" || pct >= 100) return "is-done";
  if (kr.status === "at_risk" || kr.status === "off_track") return "is-risk";
  return "";
}

export default async function TeamCompanyGoalsPage() {
  await requireTeamMember();
  const q = currentQuarter();

  const [objRes, krRes] = await Promise.all([
    companyOs
      .from("objectives")
      .select(OBJECTIVE_SELECT)
      .eq("quarter", q.label)
      .eq("level", "company")
      .neq("status", "dropped")
      .order("sort_order"),
    companyOs.from("key_results").select(KR_SELECT).order("sort_order"),
  ]);

  const objectives = (objRes.data ?? []) as ObjectiveRow[];
  const objectiveIds = new Set(objectives.map((o) => o.id));
  const krsByObjective = new Map<string, KrRow[]>();
  for (const kr of (krRes.data ?? []) as KrRow[]) {
    if (!objectiveIds.has(kr.objective_id)) continue;
    krsByObjective.set(kr.objective_id, [...(krsByObjective.get(kr.objective_id) ?? []), kr]);
  }
  const tree: ObjectiveWithKrs[] = objectives.map((o) => ({ ...o, krs: krsByObjective.get(o.id) ?? [] }));

  const personIds = Array.from(
    new Set(tree.flatMap((o) => o.krs.map((kr) => kr.accountable_person_id))),
  );
  const peopleRes = personIds.length
    ? await companyOs.from("people").select("id, full_name").in("id", personIds)
    : { data: [] };
  const initialsById: Record<string, string> = {};
  for (const p of (peopleRes.data ?? []) as { id: string; full_name: string }[]) {
    initialsById[p.id] = personInitials(p.full_name);
  }

  return (
    <>
      <PageHead
        eyebrow="Company"
        title="Company Goals"
        sub={`${q.label} · week ${q.week} of ${q.totalWeeks}`}
      />

      {tree.length === 0 && <div className="admin-empty">No objectives for {q.label} yet.</div>}

      {tree.map((o, oi) => (
        <div key={o.id} className="admin-card" style={{ padding: 0, marginBottom: 14, overflow: "hidden" }}>
          <div className="edges-ohead">
            <span className={`edges-ltag edges-ltag--${o.business_line ?? "company"}`}>
              {LINE_LABELS[o.business_line ?? "company"]}
            </span>
            <h3>
              O{oi + 1} · {o.title}
            </h3>
            <span className="edges-ohead-note">
              {Math.round(o.krs.reduce((s, kr) => s + progressPct(kr), 0) / Math.max(1, o.krs.length))}% ·{" "}
              {o.krs.some((kr) => kr.status === "off_track")
                ? "off track"
                : o.krs.some((kr) => kr.status === "at_risk")
                  ? "watch"
                  : "on track"}
            </span>
          </div>
          {o.krs.map((kr, ki) => (
            <div key={kr.id} className="edges-kr">
              <div className="edges-kr-row">
                <div className="edges-kr-title">
                  <span style={{ color: "var(--admin-faint)", fontWeight: 750, fontSize: 10, marginRight: 7 }}>
                    KR{oi + 1}.{ki + 1}
                  </span>
                  {kr.title}
                </div>
                <span className="edges-owner">
                  <span className="edges-av" title="Accountable human">
                    {initialsById[kr.accountable_person_id] ?? "?"}
                  </span>
                  {kr.executing_agent && (
                    <span className="edges-av edges-av--bot" title={`${kr.executing_agent} agent`}>
                      {agentInitials(kr.executing_agent)}
                    </span>
                  )}
                </span>
                <span className="edges-prog">
                  <span className="edges-prog-bar">
                    <i className={barClass(kr)} style={{ width: `${Math.min(100, progressPct(kr))}%` }} />
                  </span>
                  <span className="edges-prog-val">{fmtValue(kr)}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
