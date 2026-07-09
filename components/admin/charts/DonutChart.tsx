// Dependency-free server-rendered donut. Slices are stroke-dasharray arcs on a
// circle (no path trig; a single 100% slice is just a full ring). Identity is
// never color-alone: 2px surface gaps separate slices and the legend carries
// label + count for every slice. Tail beyond maxSlices folds into "Other
// categories"; "Uncategorized" always renders muted gray.

const R = 58;
const C = 2 * Math.PI * R;
const STROKE = 26;
const GAP = 2;

const MUTED_SLICES = new Set(["Uncategorized", "Other categories"]);

export function DonutChart({
  data,
  centerLabel,
  ariaLabel,
  maxSlices = 8,
  emptyText = "No data yet.",
}: {
  data: Array<{ label: string; value: number }>;
  centerLabel: string;
  ariaLabel: string;
  maxSlices?: number;
  emptyText?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) {
    return <div className="admin-empty" style={{ padding: "32px 16px" }}>{emptyText}</div>;
  }

  // Named categories sorted desc; fold the tail, keep Uncategorized last.
  const named = data.filter((d) => !MUTED_SLICES.has(d.label)).sort((a, b) => b.value - a.value);
  const uncategorized = data.filter((d) => d.label === "Uncategorized");
  const head = named.slice(0, maxSlices - 1);
  const tail = named.slice(maxSlices - 1);
  const slices = [
    ...head,
    ...(tail.length > 0
      ? [{ label: "Other categories", value: tail.reduce((s, d) => s + d.value, 0) }]
      : []),
    ...uncategorized,
  ];

  let acc = 0;
  const arcs = slices.map((s, i) => {
    const len = (s.value / total) * C;
    const start = acc;
    acc += len;
    return {
      ...s,
      color: MUTED_SLICES.has(s.label) ? "var(--admin-muted)" : `var(--admin-chart-${(i % 8) + 1})`,
      // Shorten by the gap so a sliver of surface separates adjacent slices.
      dash: `${Math.max(0, len - GAP)} ${C - Math.max(0, len - GAP)}`,
      // Start at 12 o'clock (offset C/4), then advance clockwise.
      offset: C / 4 - start,
    };
  });

  return (
    <div className="admin-donut">
      <svg
        className="admin-chart"
        viewBox="0 0 160 160"
        role="img"
        aria-label={ariaLabel}
        style={{ width: 150, height: 150, flex: "0 0 auto" }}
      >
        <title>{ariaLabel}</title>
        {arcs.map((a) => (
          <circle
            key={a.label}
            cx={80}
            cy={80}
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth={STROKE}
            strokeDasharray={a.dash}
            strokeDashoffset={a.offset}
          >
            <title>{`${a.label}: ${a.value}`}</title>
          </circle>
        ))}
        <text x={80} y={78} textAnchor="middle" fontSize={26} fontWeight={600} fill="var(--admin-ink)">
          {total}
        </text>
        <text x={80} y={96} textAnchor="middle" fontSize={11} fill="var(--admin-muted)">
          {centerLabel}
        </text>
      </svg>
      <ul className="admin-chart-legend">
        {arcs.map((a) => (
          <li key={a.label}>
            <span className="admin-chart-swatch" style={{ background: a.color }} />
            <span className="admin-chart-legend-label">{a.label}</span>
            <span className="admin-chart-legend-count">{a.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
