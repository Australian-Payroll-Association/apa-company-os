import Link from "next/link";
import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import { listBoards, listBoardManageOptions } from "@/lib/boards/data";
import { initials } from "@/lib/boards/types";
import { NewBoardForm } from "./NewBoardForm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "Boards",
  description: "Task boards for client projects, our own products, and day-to-day work.",
};

export default async function BoardsPage() {
  const [boards, options] = await Promise.all([listBoards(), listBoardManageOptions()]);

  return (
    <>
      <PageHead
        eyebrow="Workspace"
        title="Boards"
        sub="Trello-style boards for client projects, our own products, and day-to-day work."
      />

      <NewBoardForm clients={options.clients} />

      {boards.length === 0 ? (
        <div className="admin-card admin-section-card">
          <span className="admin-cell-muted">No boards yet.</span>
        </div>
      ) : (
        <div className="mp-kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {boards.map((b) => {
            const total = b.open_count + b.done_count;
            const pct = total > 0 ? Math.round((b.done_count / total) * 100) : 0;
            const shown = b.member_names.slice(0, 4);
            const extra = b.member_names.length - shown.length;
            return (
              <Link
                key={b.id}
                href={`/admin/boards/${b.slug}`}
                className="admin-card admin-section-card is-clickable"
                style={{ display: "flex", flexDirection: "column", gap: 0, textDecoration: "none" }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <span className="admin-cell-strong" style={{ fontSize: 15 }}>
                    {b.name}
                  </span>
                  {b.client_name && <Badge tone="info">Client</Badge>}
                </div>
                <div className="admin-cell-muted" style={{ marginTop: 4, minHeight: 18 }}>
                  {b.client_name ?? "Internal"}
                </div>
                <div style={{ marginTop: 14 }}>
                  <div
                    className="admin-cell-muted"
                    style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}
                  >
                    <span>
                      {total === 0
                        ? "No cards yet"
                        : b.open_count === 0
                          ? "All done"
                          : `${b.open_count} open`}
                    </span>
                    {total > 0 && <span>{pct}% done</span>}
                  </div>
                  <div className="board-progress">
                    <div className="board-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="board-avatar-stack">
                    {shown.map((name, i) => (
                      <span key={`${name}-${i}`} className="sap-avatar" title={name}>
                        {initials(name)}
                      </span>
                    ))}
                    {extra > 0 && <span className="board-avatar-more">+{extra}</span>}
                    {b.member_names.length === 0 && (
                      <span className="admin-cell-muted" style={{ fontSize: 12 }}>
                        No members
                      </span>
                    )}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
