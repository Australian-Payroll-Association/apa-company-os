"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCapability } from "./actions";
import {
  CAPABILITY_LEVELS,
  LEVEL_META,
  type CapabilityLevel,
  type CapabilityPreference,
} from "@/lib/scheduling";

export type CapabilityPerson = { id: string; name: string };
export type CellState = { level: CapabilityLevel | null; preference: CapabilityPreference | null };

type Props = {
  people: CapabilityPerson[];
  workTypes: string[];
  initialCells: Record<string, CellState>;
};

const PREF_CYCLE: (CapabilityPreference | null)[] = [null, "likes", "neutral", "dislikes"];
const PREF_ICON: Record<CapabilityPreference, string> = { likes: "♥", neutral: "·", dislikes: "⊘" };
const PREF_LABEL: Record<CapabilityPreference, string> = { likes: "Likes", neutral: "Neutral", dislikes: "Dislikes" };

export function CapabilityMatrix({ people, workTypes, initialCells }: Props) {
  const [cells, setCells] = useState<Record<string, CellState>>(initialCells);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function keyOf(personId: string, workType: string) {
    return `${personId}|${workType}`;
  }

  function commit(personId: string, workType: string, next: CellState, prev: CellState | undefined) {
    const k = keyOf(personId, workType);
    setCells((c) => ({ ...c, [k]: next }));
    setError(null);
    startTransition(async () => {
      const res = await setCapability({
        personId,
        workType,
        level: next.level,
        preference: next.preference,
      });
      if (!res.ok) {
        setError(res.error);
        // revert
        setCells((c) => {
          const copy = { ...c };
          if (prev) copy[k] = prev;
          else delete copy[k];
          return copy;
        });
        return;
      }
      router.refresh();
    });
  }

  function onLevel(personId: string, workType: string, value: string) {
    const k = keyOf(personId, workType);
    const prev = cells[k];
    const level = value === "" ? null : (value as CapabilityLevel);
    const preference = level === null ? null : prev?.preference ?? null;
    commit(personId, workType, { level, preference }, prev);
  }

  function onPref(personId: string, workType: string) {
    const k = keyOf(personId, workType);
    const prev = cells[k];
    if (!prev || !prev.level) return; // preference only when a level is set
    const idx = PREF_CYCLE.indexOf(prev.preference ?? null);
    const preference = PREF_CYCLE[(idx + 1) % PREF_CYCLE.length];
    commit(personId, workType, { level: prev.level, preference }, prev);
  }

  return (
    <>
      {error && (
        <p className="tsheet-error" role="alert">
          {error}
        </p>
      )}
      <div className="sched-tablewrap">
        <table className="sched-table cap-table">
          <thead>
            <tr>
              <th className="sched-name-h">Person</th>
              {workTypes.map((wt) => (
                <th key={wt} className="cap-wt-h" title={wt}>
                  {wt}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td className="sched-name">{p.name}</td>
                {workTypes.map((wt) => {
                  const cell = cells[keyOf(p.id, wt)];
                  const level = cell?.level ?? null;
                  const tone = level ? LEVEL_META[level].tone : "empty";
                  return (
                    <td key={wt} className={`cap-cell is-${tone}`}>
                      <div className="cap-cell-inner">
                        <select
                          className="cap-level"
                          value={level ?? ""}
                          disabled={pending}
                          onChange={(e) => onLevel(p.id, wt, e.target.value)}
                          aria-label={`${p.name} — ${wt}`}
                        >
                          <option value="">—</option>
                          {CAPABILITY_LEVELS.map((lv) => (
                            <option key={lv} value={lv}>
                              {LEVEL_META[lv].label}
                            </option>
                          ))}
                        </select>
                        {level && (
                          <button
                            type="button"
                            className={`cap-pref${cell?.preference ? " is-set" : ""}`}
                            onClick={() => onPref(p.id, wt)}
                            disabled={pending}
                            title={cell?.preference ? PREF_LABEL[cell.preference] : "Set preference"}
                            aria-label="Cycle preference"
                          >
                            {cell?.preference ? PREF_ICON[cell.preference] : "+"}
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cap-key" aria-hidden="true">
        {CAPABILITY_LEVELS.map((lv) => (
          <span key={lv}>
            <i className={`sched-swatch is-${LEVEL_META[lv].tone === "info" ? "ok" : LEVEL_META[lv].tone}`} />
            {LEVEL_META[lv].label}
          </span>
        ))}
        <span className="cap-key-note">♥ likes · · neutral · ⊘ dislikes — click the badge to cycle</span>
      </div>
    </>
  );
}
