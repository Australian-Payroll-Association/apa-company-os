// Dependency-free server-rendered horizontal bar chart. Single measure, single
// series: every bar wears the accent, values are direct-labeled, no legend.

const ROW_H = 30;
const LABEL_W = 90;
const CHART_W = 320;
const BAR_MAX = CHART_W - LABEL_W - 40;

export function BarChart({
  data,
  ariaLabel,
  emptyText = "No data yet.",
  formatValue,
}: {
  data: Array<{ label: string; value: number }>;
  ariaLabel: string;
  emptyText?: string;
  // Renders the direct label next to each bar (e.g. money). Defaults to the raw number.
  formatValue?: (value: number) => string;
}) {
  const fmt = formatValue ?? ((n: number) => String(n));
  const max = Math.max(...data.map((d) => d.value));
  if (max <= 0) {
    return <div className="admin-empty" style={{ padding: "32px 16px" }}>{emptyText}</div>;
  }

  const height = data.length * ROW_H;
  return (
    <svg
      className="admin-chart"
      viewBox={`0 0 ${CHART_W} ${height}`}
      role="img"
      aria-label={ariaLabel}
      style={{ width: "100%", height: "auto" }}
    >
      <title>{ariaLabel}</title>
      {data.map((d, i) => {
        const w = d.value > 0 ? Math.max(2, (d.value / max) * BAR_MAX) : 0;
        const y = i * ROW_H;
        return (
          <g key={d.label}>
            <text x={0} y={y + 19} fontSize={12} fill="var(--admin-ink-2)">
              {d.label}
            </text>
            {w > 0 && (
              <rect x={LABEL_W} y={y + 7} width={w} height={16} rx={3} fill="var(--admin-accent)">
                <title>{`${d.label}: ${fmt(d.value)}`}</title>
              </rect>
            )}
            <text
              x={LABEL_W + w + 7}
              y={y + 19}
              fontSize={12}
              fill="var(--admin-ink)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {fmt(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
