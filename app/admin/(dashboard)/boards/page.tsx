import Link from "next/link";
import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import { listBoards } from "@/lib/boards/data";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "Boards",
  description: "Task boards for client projects, our own products, and day-to-day work.",
};

export default async function BoardsPage() {
  const boards = await listBoards();

  return (
    <>
      <PageHead
        eyebrow="Workspace"
        title="Boards"
        sub="Trello-style boards for client projects, our own products, and day-to-day work."
      />

      {boards.length === 0 ? (
        <div className="admin-card admin-section-card">
          <span className="admin-cell-muted">No boards yet.</span>
        </div>
      ) : (
        <div className="mp-kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {boards.map((b) => (
            <Link
              key={b.id}
              href={`/admin/boards/${b.slug}`}
              className="admin-card admin-section-card is-clickable"
              style={{ display: "block", textDecoration: "none" }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <span className="admin-cell-strong" style={{ fontSize: 15 }}>
                  {b.name}
                </span>
                {b.client_name && <Badge tone="info">Client</Badge>}
              </div>
              {b.client_name && (
                <div className="admin-cell-muted" style={{ marginTop: 4 }}>
                  {b.client_name}
                </div>
              )}
              <div className="admin-cell-muted" style={{ marginTop: 12, display: "flex", gap: 14 }}>
                <span>{b.open_count} open</span>
                <span>
                  {b.member_count} {b.member_count === 1 ? "member" : "members"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
