"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BrandOption, PillarOption } from "@/lib/admin/marketing-calendar";
import { createCampaign } from "./actions";

export function NewCampaignForm({ brands, pillars }: { brands: BrandOption[]; pillars: PillarOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState("");
  const [objective, setObjective] = useState("");
  const [pillarId, setPillarId] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const brandPillars = brandId ? pillars.filter((p) => p.brandId === brandId) : [];

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createCampaign({
        name,
        brandId: brandId || null,
        objective: objective || null,
        pillarId: pillarId || null,
        startsOn: startsOn || null,
        endsOn: endsOn || null,
      });
      if (result.ok) {
        router.push(`/admin/revenue/marketing/campaigns/${result.id}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="admin-form" style={{ marginTop: 12 }}>
      <div className="admin-field">
        <label className="admin-label" htmlFor="c-name">
          The idea
        </label>
        <input
          id="c-name"
          className="admin-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="The centaur hiring thesis"
        />
        <div className="admin-hint">Name the campaign the way you would pitch the idea out loud.</div>
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="c-objective">
          Goal
        </label>
        <input
          id="c-objective"
          className="admin-input"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="Lead-gen: 25 demos booked"
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="c-brand">
          Brand
        </label>
        <select
          id="c-brand"
          className="admin-input"
          value={brandId}
          onChange={(e) => {
            setBrandId(e.target.value);
            setPillarId("");
          }}
        >
          <option value="">— No brand —</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="c-pillar">
          Pillar
        </label>
        <select
          id="c-pillar"
          className="admin-input"
          value={pillarId}
          disabled={!brandId || brandPillars.length === 0}
          onChange={(e) => setPillarId(e.target.value)}
        >
          <option value="">{brandId ? "— None —" : "Pick a brand first"}</option>
          {brandPillars.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-field" style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="admin-label" htmlFor="c-start">
            Starts
          </label>
          <input id="c-start" className="admin-input" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="admin-label" htmlFor="c-end">
            Ends
          </label>
          <input id="c-end" className="admin-input" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      <div className="admin-form-actions">
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={submit}
          disabled={pending || !name.trim()}
        >
          {pending ? "Creating…" : "Create campaign"}
        </button>
      </div>
    </div>
  );
}
