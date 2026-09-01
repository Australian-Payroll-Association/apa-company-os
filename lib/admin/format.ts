// Shared formatters for the admin CRM. Money is always stored as integer cents
// (bigint columns) — never do float arithmetic on it; format only at the edge.

export function formatCents(cents: number | string | null | undefined, currency = "usd"): string {
  if (cents === null || cents === undefined || cents === "") return "—";
  const n = typeof cents === "string" ? Number(cents) : cents;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(n / 100);
}

// Accounting notation: negatives in parentheses instead of a leading minus,
// e.g. -30000 -> "($300)". Reuses formatCents for the actual number/currency
// formatting — only wraps the sign presentation, doesn't touch the shared
// formatter (which other pages rely on reading as "-$X").
export function formatVarianceCents(cents: number | string | null | undefined, currency = "usd"): string {
  if (cents === null || cents === undefined || cents === "") return "—";
  const n = typeof cents === "string" ? Number(cents) : cents;
  if (!Number.isFinite(n)) return "—";
  const formatted = formatCents(Math.abs(n), currency);
  return n < 0 ? `(${formatted})` : formatted;
}

// Whole VND (NOT cents). VND is a zero-decimal currency; salary_vnd stores the
// actual dong amount, so it must not go through formatCents (which divides by
// 100). e.g. 45000000 -> "₫45,000,000".
export function formatVndWhole(vnd: number | string | null | undefined): string {
  if (vnd === null || vnd === undefined || vnd === "") return "—";
  const n = typeof vnd === "string" ? Number(vnd) : vnd;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  if (Number.isNaN(ms)) return "—";
  const sec = Math.round(ms / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (sec < 60) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 30) return `${day}d ago`;
  return formatDate(iso);
}

// "new_lead" → "New lead", "private_session" → "Private session"
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const s = value.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
