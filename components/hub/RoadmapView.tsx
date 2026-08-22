import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { PRIORITY_LABEL, effectivePriority, type BacklogPriority } from "@/lib/client-backlog";
import type { CompanyRoadmap } from "@/lib/admin/company-hub";

// Read-only roadmap view: the same groups, ordering, and effective priorities
// the client sees, rendered from the Badge pill system. Shared by the admin 360
// hub (and available for other read surfaces).
const BACKLOG_PRIORITY_TONE: Record<BacklogPriority, BadgeTone> = {
  now: "info",
  next: "ok",
  later: "neutral",
  park: "warn",
};

export function RoadmapView({ roadmap }: { roadmap: CompanyRoadmap }) {
  const { overview, groups, items } = roadmap;

  return (
    <div style={{ maxWidth: 860 }}>
      {overview && (
        <section className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
          <h2 className="admin-card-title" style={{ marginBottom: 8 }}>Overview</h2>
          <div style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{overview}</div>
        </section>
      )}

      {items.length === 0 ? (
        <div className="admin-empty">No roadmap items yet for this client.</div>
      ) : (
        groups.map((g) => {
          const groupItems = items.filter((i) => i.group_key === g.key);
          if (groupItems.length === 0) return null;
          return (
            <section className="admin-card admin-section-card" key={g.key} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                {g.step_label && <Badge tone="info">{g.step_label}</Badge>}
                <h2 className="admin-card-title" style={{ margin: 0 }}>{g.title}</h2>
              </div>
              <div className="admin-list">
                {groupItems.map((it) => {
                  const priority = effectivePriority(it);
                  return (
                    <div className="admin-list-row" key={it.id}>
                      <div className="admin-list-main">
                        <div className="admin-list-title">{it.ref ? `${it.ref} · ` : ""}{it.title}</div>
                      </div>
                      <div className="admin-list-aside" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Badge tone={BACKLOG_PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
