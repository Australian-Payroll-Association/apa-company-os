"use client";

import { useState, useTransition } from "react";
import {
  CHANNELS,
  type BrandOption,
  type CalendarChannel,
  type CalendarEntryRow,
  type PillarOption,
} from "@/lib/admin/marketing-calendar";
import { createEntry } from "./actions";

export function NewEntryForm({
  brands,
  pillars,
  onCreated,
}: {
  brands: BrandOption[];
  pillars: PillarOption[];
  onCreated: (entry: CalendarEntryRow) => void;
}) {
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState<CalendarChannel>("blog");
  const [brandId, setBrandId] = useState("");
  const [pillarId, setPillarId] = useState("");
  const [publishDate, setPublishDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const brandPillars = brandId ? pillars.filter((p) => p.brandId === brandId) : [];

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await createEntry({
        title,
        channel,
        brandId: brandId || null,
        pillarId: pillarId || null,
        publishDate: publishDate || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onCreated({
        id: r.id,
        title: title.trim(),
        brandId: brandId || null,
        brandName: brands.find((b) => b.id === brandId)?.name ?? null,
        pillarId: pillarId || null,
        pillarName: pillars.find((p) => p.id === pillarId)?.name ?? null,
        channel,
        status: "idea",
        publishDate: publishDate || null,
        parentId: null,
        campaignId: null,
        campaignStatus: null,
        copyMd: null,
        assetUrl: null,
        postedUrl: null,
        notes: null,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
      });
      setTitle("");
      setPublishDate("");
      setPillarId("");
    });
  }

  return (
    <div className="admin-form" style={{ marginTop: 12 }}>
      <div className="admin-form-row" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="admin-field" style={{ flex: "2 1 220px" }}>
          <label className="admin-label" htmlFor="ne-title">Title</label>
          <input id="ne-title" className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What we learned running 40 AI workshops" />
        </div>
        <div className="admin-field" style={{ flex: "1 1 130px" }}>
          <label className="admin-label" htmlFor="ne-channel">Channel</label>
          <select id="ne-channel" className="admin-input" value={channel} onChange={(e) => setChannel(e.target.value as CalendarChannel)}>
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="admin-field" style={{ flex: "1 1 130px" }}>
          <label className="admin-label" htmlFor="ne-brand">Brand</label>
          <select
            id="ne-brand"
            className="admin-input"
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value);
              setPillarId("");
            }}
          >
            <option value="">— None —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="admin-field" style={{ flex: "1 1 150px" }}>
          <label className="admin-label" htmlFor="ne-pillar">Pillar</label>
          <select
            id="ne-pillar"
            className="admin-input"
            value={pillarId}
            disabled={!brandId || brandPillars.length === 0}
            onChange={(e) => setPillarId(e.target.value)}
          >
            <option value="">{brandId ? "— None —" : "Pick a brand first"}</option>
            {brandPillars.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="admin-field" style={{ flex: "1 1 150px" }}>
          <label className="admin-label" htmlFor="ne-date">Date</label>
          <input id="ne-date" className="admin-input" type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
        </div>
        <button type="button" className="admin-btn admin-btn--primary" onClick={submit} disabled={pending || !title.trim()}>
          {pending ? "Adding…" : "Add entry"}
        </button>
      </div>
      {error && <div className="admin-alert admin-alert--err" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
