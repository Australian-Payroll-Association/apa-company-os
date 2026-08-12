"use client";

// The Eight Edges ladder picker: which company objective, key result, or
// metric a goal hangs off. Shared by the coach page (CoachProfileView) and the
// member's own page (/team/goals) so both offer the same company goals, in the
// same shape, and write the same three columns.

import type { EdgesLadder, EdgesOptions, LadderInput } from "@/lib/coaching/data";

// The select's value encoding: "<kind>:<id>", or "" for no ladder.
export function ladderValue(ladder: EdgesLadder | null): string {
  if (!ladder) return "";
  return `${ladder.kind}:${ladder.id}`;
}

export function parseLadder(value: string): LadderInput {
  if (!value) return { kind: "none" };
  const [kind, id] = value.split(":");
  if ((kind === "objective" || kind === "key_result" || kind === "metric") && id) return { kind, id };
  return { kind: "none" };
}

export function LadderSelect({
  edges,
  value,
  onChange,
  disabled,
  id,
  emptyLabel = "No ladder",
}: {
  edges: EdgesOptions;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  id?: string;
  emptyLabel?: string;
}) {
  return (
    <select
      id={id}
      className="admin-input"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Ladders to (Eight Edges)"
    >
      <option value="">{emptyLabel}</option>
      {edges.objectives.map((o, i) => (
        <optgroup key={o.id} label={`O${i + 1}: ${o.label}`}>
          <option value={`objective:${o.id}`}>The objective itself</option>
          {edges.keyResults
            .filter((k) => k.objectiveId === o.id)
            .map((k, j) => (
              <option key={k.id} value={`key_result:${k.id}`}>
                {`KR${j + 1}: ${k.label}`}
              </option>
            ))}
        </optgroup>
      ))}
      {edges.keyResults.some((k) => !k.objectiveId) && (
        <optgroup label="Other key results">
          {edges.keyResults
            .filter((k) => !k.objectiveId)
            .map((k) => (
              <option key={k.id} value={`key_result:${k.id}`}>
                {k.label}
              </option>
            ))}
        </optgroup>
      )}
      <optgroup label="Metrics (KPIs)">
        {edges.metrics.map((m) => (
          <option key={m.id} value={`metric:${m.id}`}>
            {m.label}
            {m.target != null ? ` (target ${m.target}${m.direction === "down" ? " ↓" : " ↑"})` : ""}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
