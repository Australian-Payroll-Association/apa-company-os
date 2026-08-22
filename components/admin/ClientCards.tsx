import Link from "next/link";

// Shared card view for the clients lists (admin + team). Reuses the team-hub
// card grid. Each card deep-links to `${detailBasePath}/${id}`; `subText`
// supplies the one-line detail under the name (industry/priority for admin,
// the member's role on the account for team).
export type ClientCardRow = { id: string; name: string | null };

export function ClientCards<T extends ClientCardRow>({
  rows,
  detailBasePath,
  subText,
}: {
  rows: T[];
  detailBasePath: string;
  subText?: (row: T) => string;
}) {
  return (
    <div className="team-hub-grid">
      {rows.map((c) => (
        <Link key={c.id} href={`${detailBasePath}/${c.id}`} className="team-hub-card">
          <span className="team-hub-ico" aria-hidden>◔</span>
          <span className="team-hub-title">{c.name || "(no name)"}</span>
          <span className="team-hub-sub">{subText?.(c) || "View details"}</span>
        </Link>
      ))}
    </div>
  );
}
