import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sync",
  description: "Eight Edges: the weekly heartbeat. The Monday packet, prepared Sunday 18:00 by the product manager agent.",
};

type Packet = { id: string; week_start: string; body_md: string; created_by: string; created_at: string };

// Minimal renderer for the packet's markdown subset (## headings and - bullets).
function PacketBody({ body }: { body: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: string) => {
    if (!list.length) return;
    blocks.push(
      <ul key={key} style={{ margin: "6px 0 14px", paddingLeft: 18 }}>
        {list.map((item, i) => (
          <li key={i} style={{ marginBottom: 5, fontSize: 13 }}>
            {item}
          </li>
        ))}
      </ul>,
    );
    list = [];
  };
  body.split("\n").forEach((line, i) => {
    if (line.startsWith("## ")) {
      flush(`l${i}`);
      blocks.push(
        <h3 key={i} style={{ fontSize: 13, fontWeight: 750, margin: "14px 0 4px", color: "var(--admin-ink)" }}>
          {line.slice(3)}
        </h3>,
      );
    } else if (line.startsWith("- ")) {
      list.push(line.slice(2));
    } else if (line.trim()) {
      flush(`l${i}`);
      blocks.push(
        <p key={i} style={{ fontSize: 13, margin: "0 0 8px" }}>
          {line}
        </p>,
      );
    }
  });
  flush("end");
  return <>{blocks}</>;
}

export default async function SyncPage() {
  const { data, error } = await companyOs
    .from("sync_packets")
    .select("id, week_start, body_md, created_by, created_at")
    .order("week_start", { ascending: false })
    .limit(13);

  const packets = (data ?? []) as Packet[];
  const [latest, ...past] = packets;

  return (
    <>
      <PageHead
        eyebrow="Eight Edges"
        title="Sync"
        sub="The weekly heartbeat. The packet is prepared every Sunday 18:00 from the live numbers, goals, and issues; the meeting starts at the decision."
      />
      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error.message}
        </div>
      )}

      {!latest && (
        <div className="admin-empty">
          No packet yet. The Sunday 18:00 run creates the first one, or run `node scripts/edges/sync-packet.mjs` from the
          repo root.
        </div>
      )}

      {latest && (
        <div className="admin-card" style={{ padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 6 }}>
            <h2 style={{ fontSize: 15, fontWeight: 750, margin: 0 }}>Sync of {latest.week_start}</h2>
            <span className="admin-badge admin-badge--ok">AGENT</span>
            <span className="admin-cell-muted" style={{ fontSize: 11.5 }}>
              prepared by {latest.created_by} · {new Date(latest.created_at).toLocaleString()}
            </span>
          </div>
          <PacketBody body={latest.body_md} />
        </div>
      )}

      {past.length > 0 && (
        <div className="admin-card" style={{ padding: "12px 20px" }}>
          <h3 style={{ fontSize: 12, fontWeight: 750, margin: "4px 0 8px", color: "var(--admin-muted)" }}>
            Past syncs (the streak: {packets.length} packet{packets.length === 1 ? "" : "s"})
          </h3>
          {past.map((p) => (
            <details key={p.id} style={{ borderTop: "1px solid var(--admin-line)", padding: "8px 0" }}>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 650 }}>Sync of {p.week_start}</summary>
              <PacketBody body={p.body_md} />
            </details>
          ))}
        </div>
      )}
    </>
  );
}
