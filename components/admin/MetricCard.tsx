import Link from "next/link";
import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <div className="mp-kpi-label">{label}</div>
      <div className="mp-kpi-val">{value}</div>
      {sub && <div className="mp-kpi-note">{sub}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="mp-kpi">
      {inner}
    </Link>
  ) : (
    <div className="mp-kpi">{inner}</div>
  );
}
