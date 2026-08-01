import type { RetreatResource } from "@/lib/my-retreat/content";

// Presentational hub sections (server components). No client interactivity —
// survey cards are links that flip to a "done" state once a matching response
// exists for this guest.

export type SurveyCard = {
  stage: string;
  title: string;
  description: string;
  href: string;
  completed: boolean;
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 14,
};

const cardBase: React.CSSProperties = {
  display: "block",
  padding: "16px 18px",
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 12,
  textDecoration: "none",
  color: "inherit",
};

export function SurveyCards({ items }: { items: SurveyCard[] }) {
  if (items.length === 0) return null;
  return (
    <section style={{ marginTop: 36 }}>
      <h2 style={{ fontSize: 20, margin: "0 0 14px" }}>Your surveys</h2>
      <div style={grid}>
        {items.map((s) => (
          <a
            key={s.href}
            href={s.href}
            style={{
              ...cardBase,
              background: s.completed ? "rgba(20,140,80,0.06)" : "var(--paper, #fff)",
              borderColor: s.completed ? "rgba(20,140,80,0.4)" : "rgba(0,0,0,0.12)",
            }}
          >
            <div style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6 }}>
              {s.stage}
            </div>
            <div style={{ fontWeight: 600, margin: "4px 0 6px" }}>{s.title}</div>
            <p style={{ margin: "0 0 10px", fontSize: 14, opacity: 0.8, lineHeight: 1.5 }}>{s.description}</p>
            <span style={{ fontWeight: 600, fontSize: 14, color: s.completed ? "#148c50" : "var(--ink, #111)" }}>
              {s.completed ? "✓ Completed. Edit your answers" : "Open survey →"}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function ResourceCards({ resources }: { resources: RetreatResource[] }) {
  if (resources.length === 0) return null;
  return (
    <section style={{ marginTop: 36 }}>
      <h2 style={{ fontSize: 20, margin: "0 0 14px" }}>Resources</h2>
      <div style={grid}>
        {resources.map((r) => (
          <a
            key={r.href}
            href={r.href}
            style={{ ...cardBase, background: "var(--paper, #fff)" }}
            target={r.href.startsWith("http") ? "_blank" : undefined}
            rel={r.href.startsWith("http") ? "noopener noreferrer" : undefined}
          >
            {r.eyebrow && (
              <div style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6 }}>
                {r.eyebrow}
              </div>
            )}
            <div style={{ fontWeight: 600, margin: "4px 0 6px" }}>{r.title}</div>
            {r.description && <p style={{ margin: "0 0 10px", fontSize: 14, opacity: 0.8, lineHeight: 1.5 }}>{r.description}</p>}
            <span style={{ fontWeight: 600, fontSize: 14 }}>Open →</span>
          </a>
        ))}
      </div>
    </section>
  );
}
