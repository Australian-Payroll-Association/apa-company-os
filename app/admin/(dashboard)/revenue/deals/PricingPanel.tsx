"use client";

// E7 · Native Pricing (CPQ) panel on the deal record.
//
// The per-service pricing config (lib/admin/pricing/config) is PURE DATA, so
// this client component walks the selected service's config to render exactly
// the right intake fields, previews Member & Non-Member figures live via the
// pure previewPricing action, and persists / applies / overrides via the server
// actions. The applied figure lands on deals.amount_cents (AUD) through the
// existing FX path.
//
// NOTE: saveDealPricing / applyPricingToDeal / setPricingOverride require the
// company_os.deal_pricing table (migration docs/db/2026-09-01-e7-pricing.sql),
// which is NOT applied yet — the live preview works without it; persistence is
// enabled once the migration runs.

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCents } from "@/lib/admin/format";
import { SERVICE_CONFIGS } from "@/lib/admin/pricing/config";
import type { PricingInputs, PricingResult, ServiceConfig, ServiceKey } from "@/lib/admin/pricing/types";
import { applyPricingToDeal, previewPricing, saveDealPricing, setPricingOverride } from "./pricing/actions";

type ModField = { key: string; label: string; kind: "binary" | "tri" };
type FieldSpec = {
  needsHeadcount: boolean;
  needsComplexity: boolean;
  toggles: { key: string; label: string }[];
  numbers: { key: string; label: string; map: "units" | "stepped" | "tiers"; required?: boolean }[];
  selects: { key: string; label: string; options: string[] }[];
  months: { key: "recalcMonths" | "wageSafeMonths"; label: string }[];
  levels: { count: number } | null;
  modifiers: ModField[];
};

// Derive the intake field set from a service config (no hard-coding per service).
function deriveFields(config: ServiceConfig): FieldSpec {
  const toggles = new Map<string, string>();
  const numbers = new Map<string, { label: string; map: "units" | "stepped" | "tiers"; required?: boolean }>();
  const selects = new Map<string, string[]>();
  const months = new Map<"recalcMonths" | "wageSafeMonths", string>();
  let needsHeadcount = false;
  let needsComplexity = false;
  let levels: { count: number } | null = null;

  for (const c of config.components) {
    switch (c.type) {
      case "banded_per_emp":
        needsHeadcount = true;
        break;
      case "flat":
        break;
      case "complexity":
        needsComplexity = true;
        break;
      case "scope":
        toggles.set(c.toggleKey, c.label);
        break;
      case "unit":
        numbers.set(c.countKey, { label: c.label, map: "units" });
        break;
      case "award_levels":
        levels = { count: c.slots };
        break;
      case "stepped":
        numbers.set(c.countKey, { label: c.label, map: "stepped", required: c.required });
        break;
      case "tiered_cumulative":
        numbers.set(c.countKey, { label: c.label, map: "tiers" });
        break;
      case "enum_flat":
        selects.set(c.enumKey, Object.keys(c.options));
        break;
      case "wagesafe_per_emp":
      case "wagesafe_monthly":
        needsHeadcount = true;
        months.set(c.monthsKey, c.monthsKey === "recalcMonths" ? "Recalculation months" : "WageSafe licence months");
        break;
      case "factor_of": {
        const f = c.factor;
        if (f.kind === "headcount_band") needsHeadcount = true;
        else if (f.kind === "toggle") toggles.set(f.toggleKey, c.label);
        else if (f.kind === "enum") selects.set(f.enumKey, Object.keys(f.map));
        else if (f.kind === "months_lookup") {
          months.set(f.monthsKey, f.monthsKey === "recalcMonths" ? "Recalculation months" : "WageSafe licence months");
          needsHeadcount = true;
        } else if (f.kind === "count_step" || f.kind === "count_linear") {
          numbers.set(f.countKey, { label: c.label, map: "units" });
        }
        break;
      }
    }
  }

  const modifiers: ModField[] = (config.modifiers ?? []).map((m) => ({ key: m.key, label: m.label, kind: m.kind }));

  return {
    needsHeadcount,
    needsComplexity,
    toggles: [...toggles].map(([key, label]) => ({ key, label })),
    numbers: [...numbers].map(([key, v]) => ({ key, label: v.label, map: v.map, required: v.required })),
    selects: [...selects].map(([key, options]) => ({ key, label: key.replace(/_/g, " "), options })),
    months: [...months].map(([key, label]) => ({ key, label })),
    levels,
    modifiers,
  };
}

const SERVICE_OPTIONS = (Object.keys(SERVICE_CONFIGS) as ServiceKey[]).map((k) => ({ key: k, label: SERVICE_CONFIGS[k].label }));

export function PricingPanel({ dealId }: { dealId: string }) {
  const [serviceKey, setServiceKey] = useState<ServiceKey>("payroll_360");
  const [isMember, setIsMember] = useState(false);
  const [inputs, setInputs] = useState<PricingInputs>({});
  const [result, setResult] = useState<PricingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ovOpen, setOvOpen] = useState(false);
  const [ovAmount, setOvAmount] = useState("");
  const [ovReason, setOvReason] = useState("");
  const [ovApprover, setOvApprover] = useState("Ross");

  const fields = useMemo(() => deriveFields(SERVICE_CONFIGS[serviceKey]), [serviceKey]);

  // Reset inputs when the service changes.
  useEffect(() => {
    setInputs({});
    setResult(null);
  }, [serviceKey]);

  // Live preview whenever inputs change.
  useEffect(() => {
    let live = true;
    previewPricing(serviceKey, inputs).then((r) => {
      if (live) setResult(r);
    });
    return () => {
      live = false;
    };
  }, [serviceKey, inputs]);

  const setField = useCallback((patch: Partial<PricingInputs>) => setInputs((prev) => ({ ...prev, ...patch })), []);
  const setMapField = useCallback((map: "units" | "stepped" | "tiers", key: string, value: number | undefined) => {
    setInputs((prev) => ({ ...prev, [map]: { ...(prev[map] ?? {}), [key]: value } }));
  }, []);

  const selected = result ? (isMember ? result.memberCents : result.nonMemberCents) : null;

  // A required base-driver count that is not yet provided → the quote is not
  // computable and must never be applied to the deal. (Empty required fields are
  // kept `undefined`, not coerced to 0, so they can't price a bogus $0 base.)
  const requiredMissing = fields.numbers.some(
    (n) => n.required && (inputs[n.map] as Record<string, number> | undefined)?.[n.key] == null,
  );

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      setMsg(r.ok ? okMsg : r.error ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card admin-section-card">
      <div className="admin-section-label" style={{ marginBottom: 12 }}>Native pricing (CPQ)</div>

      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span className="admin-kv-key">Service</span>
          <select value={serviceKey} onChange={(e) => setServiceKey(e.target.value as ServiceKey)} className="admin-input">
            {SERVICE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={isMember} onChange={(e) => setIsMember(e.target.checked)} />
          <span>APA member pricing (else non-member)</span>
        </label>

        {fields.needsHeadcount && (
          <label style={{ display: "grid", gap: 4 }}>
            <span className="admin-kv-key">Headcount</span>
            <input type="number" min={0} className="admin-input" value={inputs.headcount ?? ""} onChange={(e) => setField({ headcount: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </label>
        )}

        {fields.needsComplexity && (
          <label style={{ display: "grid", gap: 4 }}>
            <span className="admin-kv-key">Award complexity (1–4)</span>
            <input type="number" min={1} max={4} className="admin-input" value={inputs.complexity ?? ""} onChange={(e) => setField({ complexity: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </label>
        )}

        {fields.months.map((m) => (
          <label key={m.key} style={{ display: "grid", gap: 4 }}>
            <span className="admin-kv-key">{m.label}</span>
            <input type="number" min={0} className="admin-input" value={inputs[m.key] ?? ""} onChange={(e) => setField({ [m.key]: e.target.value === "" ? undefined : Number(e.target.value) } as PricingInputs)} />
          </label>
        ))}

        {fields.selects.map((s) => (
          <label key={s.key} style={{ display: "grid", gap: 4 }}>
            <span className="admin-kv-key" style={{ textTransform: "capitalize" }}>{s.label}</span>
            <select className="admin-input" value={inputs.enums?.[s.key] ?? ""} onChange={(e) => setField({ enums: { ...(inputs.enums ?? {}), [s.key]: e.target.value } })}>
              <option value="">—</option>
              {s.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
        ))}

        {fields.numbers.map((n) => {
          const val = (inputs[n.map] as Record<string, number> | undefined)?.[n.key];
          const missing = n.required && val == null;
          return (
            <label key={n.key} style={{ display: "grid", gap: 4 }}>
              <span className="admin-kv-key">
                {n.label}
                {n.required && <span style={{ color: "var(--admin-warn-line, #a67c00)" }}> *</span>}
              </span>
              <input
                type="number"
                min={0}
                required={n.required}
                aria-invalid={missing || undefined}
                className="admin-input"
                value={val ?? ""}
                // Required drivers stay `undefined` when cleared (never coerced to 0)
                // so a missing base can't be priced as $0; optional counts keep 0.
                onChange={(e) => setMapField(n.map, n.key, e.target.value === "" ? (n.required ? undefined : 0) : Number(e.target.value))}
              />
              {missing && <span style={{ color: "var(--admin-warn-line, #a67c00)", fontSize: 12 }}>Required to price this service.</span>}
            </label>
          );
        })}

        {fields.levels && (
          <div style={{ display: "grid", gap: 4 }}>
            <span className="admin-kv-key">Award levels (1–4), up to {fields.levels.count}</span>
            <input className="admin-input" placeholder="e.g. 2,4,1" value={(inputs.awardLevels ?? []).join(",")} onChange={(e) => setField({ awardLevels: e.target.value.split(",").map((x) => Number(x.trim())).filter((x) => x >= 1 && x <= 4) })} />
          </div>
        )}

        {fields.toggles.length > 0 && (
          <fieldset style={{ display: "grid", gap: 6, border: "1px solid var(--admin-line)", borderRadius: 8, padding: 10 }}>
            <legend className="admin-kv-key">Scope</legend>
            {fields.toggles.map((t) => (
              <label key={t.key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={!!inputs.scope?.[t.key]} onChange={(e) => setField({ scope: { ...(inputs.scope ?? {}), [t.key]: e.target.checked } })} />
                <span>{t.label}</span>
              </label>
            ))}
          </fieldset>
        )}

        {fields.modifiers.length > 0 && (
          <fieldset style={{ display: "grid", gap: 6, border: "1px solid var(--admin-line)", borderRadius: 8, padding: 10 }}>
            <legend className="admin-kv-key">Modifiers</legend>
            {fields.modifiers.map((m) => (
              <label key={m.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                <span>{m.label}</span>
                <select className="admin-input" value={(inputs.modifiers?.[m.key] as string) ?? ""} onChange={(e) => setField({ modifiers: { ...(inputs.modifiers ?? {}), [m.key]: e.target.value as "yes" | "no" | "partial" } })}>
                  <option value="">—</option>
                  <option value="yes">Yes</option>
                  {m.kind === "tri" && <option value="partial">Partial</option>}
                  <option value="no">No</option>
                </select>
              </label>
            ))}
          </fieldset>
        )}
      </div>

      {result && (
        <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="admin-kv-key">Member</span>
            <strong style={{ opacity: isMember ? 1 : 0.6 }}>{result.memberCents == null ? "—" : formatCents(result.memberCents, "aud")}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="admin-kv-key">Non-member</span>
            <strong style={{ opacity: isMember ? 0.6 : 1 }}>{result.nonMemberCents == null ? "—" : formatCents(result.nonMemberCents, "aud")}</strong>
          </div>
          {(result.techMemberCents ?? 0) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, opacity: 0.8 }}>
              <span>incl. Tech Costs</span>
              <span>{formatCents(isMember ? result.techMemberCents : result.techNonMemberCents, "aud")}</span>
            </div>
          )}
          {result.warnings.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 16, color: "var(--admin-warn-line, #a67c00)", fontSize: 13 }}>
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="admin-btn" disabled={busy} onClick={() => run(() => saveDealPricing(dealId, serviceKey, inputs, isMember), "Pricing saved.")}>Save pricing</button>
        <button className="admin-btn admin-btn--primary" disabled={busy || selected == null || requiredMissing} onClick={() => run(() => applyPricingToDeal(dealId), "Applied to deal value.")}>Use as deal value</button>
        <button className="admin-btn" disabled={busy} onClick={() => setOvOpen((v) => !v)}>Override</button>
      </div>

      {ovOpen && (
        <div style={{ marginTop: 12, display: "grid", gap: 8, borderTop: "1px solid var(--admin-line)", paddingTop: 12 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="admin-kv-key">Override amount (AUD)</span>
            <input type="number" min={0} className="admin-input" value={ovAmount} onChange={(e) => setOvAmount(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="admin-kv-key">Reason</span>
            <input className="admin-input" value={ovReason} onChange={(e) => setOvReason(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="admin-kv-key">Approved by</span>
            <input className="admin-input" value={ovApprover} onChange={(e) => setOvApprover(e.target.value)} />
          </label>
          <button className="admin-btn admin-btn--primary" disabled={busy} onClick={() => run(() => setPricingOverride(dealId, Number(ovAmount), ovReason, ovApprover), "Override applied and logged.")}>Save override</button>
        </div>
      )}

      {msg && <div style={{ marginTop: 10, fontSize: 13 }}>{msg}</div>}
    </section>
  );
}
