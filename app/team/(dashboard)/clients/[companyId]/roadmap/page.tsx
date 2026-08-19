import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getClientRoadmapForActor } from "@/lib/team/clients";
import { BotText } from "@/components/assistant/BotText";
import { RoadmapItemCard } from "./RoadmapItemCard";
import { AddItemForm } from "./AddItemForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Client Roadmap",
};

// The Roadmap tab: the same groups, ordering, and client-set priorities the
// client sees on /portal/roadmap, so the team view and the client view always
// agree. Assigned team members can add items and edit content/status; Edge8
// priority and client priority stay admin/client-only.

const STYLES = `
.tcr { --pri-now:#287BE8; --pri-next:#0b8f63; --pri-later:#4a505a; --pri-park:#b06508; max-width: 880px; }
.tcr .tcr-group { margin-bottom: 22px; }
.tcr .tcr-group-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:0 0 4px; }
.tcr .tcr-step { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:3px 9px; border-radius:99px; background:rgba(40,123,232,.1); color:#287BE8; }
.tcr .tcr-group-title { font-weight:700; font-size:15px; }
.tcr .tcr-group-intro { color:#797c82; font-size:13px; margin:2px 0 12px; }
.tcr .tcr-item { border:1px solid var(--admin-border,#E6E6E6); border-radius:12px; padding:13px 15px; margin-bottom:9px; background:#fff; }
.tcr .tcr-item-top { display:flex; gap:9px; align-items:flex-start; flex-wrap:wrap; }
.tcr .tcr-ref { flex:none; font-size:12px; font-weight:700; color:#287BE8; background:rgba(40,123,232,.1); border-radius:6px; padding:3px 7px; }
.tcr .tcr-title { font-weight:650; font-size:14px; flex:1 1 220px; }
.tcr .tcr-pri { flex:none; font-size:12px; font-weight:700; padding:4px 11px; border-radius:99px; }
.tcr .tcr-pri.now { background:var(--pri-now); color:#fff; }
.tcr .tcr-pri.next { background:rgba(11,143,99,.15); color:var(--pri-next); }
.tcr .tcr-pri.later { background:#f2f4f7; color:var(--pri-later); }
.tcr .tcr-pri.park { background:#fff4e5; color:var(--pri-park); }
.tcr .tcr-body { font-size:13px; margin-top:8px; color:#333; }
.tcr .tcr-body .k { color:#797c82; font-weight:600; }
.tcr .tcr-chips { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; align-items:center; }
.tcr .tcr-chip { font-size:11px; font-weight:600; color:#797c82; border:1px solid #EAEEF2; border-radius:99px; padding:2px 9px; }
.tcr .tcr-chip.tok { color:#287BE8; border-color:rgba(40,123,232,.15); background:rgba(40,123,232,.08); }
.tcr .tcr-chip.client { color:#0b8f63; border-color:rgba(11,143,99,.25); background:rgba(11,143,99,.1); }
`;

export default async function TeamClientRoadmapTab({ params }: { params: { companyId: string } }) {
  const actor = await requireTeamMember();
  const roadmap = await getClientRoadmapForActor(actor, params.companyId);
  if (!roadmap) notFound();

  const { overview, groups, items } = roadmap;

  return (
    <div className="tcr">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {overview && (
        <section className="admin-card admin-section-card" style={{ marginBottom: 18 }}>
          <h2 className="admin-card-title" style={{ marginBottom: 8 }}>Overview</h2>
          <div style={{ fontSize: 14, lineHeight: 1.65 }}>
            <BotText text={overview} />
          </div>
        </section>
      )}

      <AddItemForm companyId={params.companyId} groups={groups} />

      {items.length === 0 ? (
        <div className="admin-card admin-section-card" style={{ padding: 22 }}>
          <p className="admin-page-sub" style={{ margin: 0 }}>No roadmap items yet for this client.</p>
        </div>
      ) : (
        groups.map((g) => {
          const groupItems = items.filter((i) => i.group_key === g.key);
          if (groupItems.length === 0) return null;
          return (
            <div key={g.key} className="tcr-group">
              <div className="tcr-group-head">
                {g.step_label && <span className="tcr-step">{g.step_label}</span>}
                <span className="tcr-group-title">{g.title}</span>
              </div>
              {g.intro && <div className="tcr-group-intro">{g.intro}</div>}
              {groupItems.map((it) => (
                <RoadmapItemCard key={it.id} item={it} companyId={params.companyId} />
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
