import { formatCents } from "@/lib/admin/format";

export function MoneyCell({
  cents,
  currency,
}: {
  cents: number | string | null | undefined;
  currency?: string;
}) {
  return <span className="admin-cell-mono">{formatCents(cents, currency)}</span>;
}
