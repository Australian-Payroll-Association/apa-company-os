"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, statusTone } from "@/components/admin/Badge";
import {
  CHANNELS,
  STATUS_LABEL,
  type BrandOption,
  type CalendarChannel,
  type PillarOption,
} from "@/lib/admin/marketing-calendar";
import {
  CAMPAIGN_STATUSES,
  type CampaignAsset,
  type MarketingCampaignRow,
} from "@/lib/admin/marketing-campaigns";
import { addAssetToCampaign, updateCampaign } from "../actions";

type Note = { tone: "ok" | "err"; text: string } | null;
type Tab = "assets" | "seo";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CampaignHub({
  campaign,
  assets: initialAssets,
  brands,
  pillars,
}: {
  campaign: MarketingCampaignRow;
  assets: CampaignAsset[];
  brands: BrandOption[];
  pillars: PillarOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<Note>(null);
  const [tab, setTab] = useState<Tab>("assets");
  const [editing, setEditing] = useState(false);

  // Campaign fields (state is the source of truth once edited, so read-only mode
  // reflects a save without a full reload).
  const [name, setName] = useState(campaign.name);
  const [objective, setObjective] = useState(campaign.objective ?? "");
  const [brandId, setBrandId] = useState(campaign.brandId ?? "");
  const [pillarId, setPillarId] = useState(campaign.pillarId ?? "");
  const [startsOn, setStartsOn] = useState(campaign.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(campaign.endsOn ?? "");
  const [status, setStatus] = useState(campaign.status);
  const [seoGeoMd, setSeoGeoMd] = useState(campaign.seoGeoMd ?? "");

  const [assets, setAssets] = useState<CampaignAsset[]>(initialAssets);

  // New-asset form.
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newChannel, setNewChannel] = useState<CalendarChannel>("blog");
  const [newDate, setNewDate] = useState("");

  const brandPillars = brandId ? pillars.filter((p) => p.brandId === brandId) : [];
  const brandName = brands.find((b) => b.id === brandId)?.name ?? null;
  const pillarName = pillars.find((p) => p.id === pillarId)?.name ?? null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) {
    setNote(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setNote({ tone: "ok", text: success });
        after?.();
        router.refresh();
      } else {
        setNote({ tone: "err", text: result.error ?? "Something went wrong." });
      }
    });
  }

  function saveHeader() {
    run(
      () =>
        updateCampaign(campaign.id, {
          name,
          objective: objective || null,
          brandId: brandId || null,
          pillarId: pillarId || null,
          startsOn: startsOn || null,
          endsOn: endsOn || null,
          status,
        }),
      "Campaign saved.",
      () => setEditing(false),
    );
  }

  function saveSeo() {
    run(() => updateCampaign(campaign.id, { seoGeoMd: seoGeoMd || null }), "SEO / GEO plan saved.");
  }

  function addAsset() {
    const title = newTitle.trim();
    if (!title) {
      setNote({ tone: "err", text: "Give the asset a title." });
      return;
    }
    setNote(null);
    startTransition(async () => {
      const result = await addAssetToCampaign(campaign.id, {
        title,
        channel: newChannel,
        publishDate: newDate || null,
      });
      if (result.ok) {
        setAssets((prev) => [
          ...prev,
          {
            id: result.id,
            title,
            channel: newChannel,
            status: "idea",
            publishDate: newDate || null,
            broadcastId: null,
            broadcastStatus: null,
            imageUrl: null,
          },
        ]);
        setNewTitle("");
        setNewDate("");
        setAddOpen(false);
        setNote({ tone: "ok", text: "Asset added." });
        router.refresh();
      } else {
        setNote({ tone: "err", text: result.error });
      }
    });
  }

  const windowLabel =
    startsOn || endsOn ? `${fmtDate(startsOn || null)} – ${fmtDate(endsOn || null)}` : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {note && <div className={`admin-alert admin-alert--${note.tone}`}>{note.text}</div>}

      {/* Header: the idea + goal/dates/pillar/brand */}
      <section className="admin-card admin-section-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="admin-chip admin-chip--accent">Campaign</span>
            <Badge tone={status === "done" ? "ok" : status === "active" ? "warn" : "info"}>
              {CAMPAIGN_STATUSES.find((s) => s.id === status)?.label ?? status}
            </Badge>
          </div>
          <button type="button" className="admin-btn admin-btn--sm" onClick={() => setEditing((v) => !v)} disabled={pending}>
            {editing ? "Close" : "Edit"}
          </button>
        </div>

        {!editing ? (
          <div className="admin-summary-pills" style={{ marginTop: 14 }}>
            <span className="admin-pill">
              <span className="admin-pill-label">Goal</span>
              <span className="admin-pill-val">{objective || "—"}</span>
            </span>
            <span className="admin-pill">
              <span className="admin-pill-label">Window</span>
              <span className="admin-pill-val">{windowLabel}</span>
            </span>
            <span className="admin-pill">
              <span className="admin-pill-label">Pillar</span>
              <span className="admin-pill-val">{pillarName || "—"}</span>
            </span>
            <span className="admin-pill">
              <span className="admin-pill-label">Brand</span>
              <span className="admin-pill-val">{brandName || "—"}</span>
            </span>
          </div>
        ) : (
          <div className="admin-form" style={{ marginTop: 14 }}>
            <div className="admin-field">
              <label className="admin-label" htmlFor="h-name">The idea</label>
              <input id="h-name" className="admin-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="admin-field">
              <label className="admin-label" htmlFor="h-goal">Goal</label>
              <input id="h-goal" className="admin-input" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Lead-gen: 25 demos booked" />
            </div>
            <div className="admin-field" style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="admin-label" htmlFor="h-brand">Brand</label>
                <select
                  id="h-brand"
                  className="admin-input"
                  value={brandId}
                  onChange={(e) => {
                    setBrandId(e.target.value);
                    setPillarId("");
                  }}
                >
                  <option value="">— No brand —</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="admin-label" htmlFor="h-pillar">Pillar</label>
                <select
                  id="h-pillar"
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
            </div>
            <div className="admin-field" style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="admin-label" htmlFor="h-start">Starts</label>
                <input id="h-start" className="admin-input" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="admin-label" htmlFor="h-end">Ends</label>
                <input id="h-end" className="admin-input" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="admin-label" htmlFor="h-status">Status</label>
                <select id="h-status" className="admin-input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                  {CAMPAIGN_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="admin-form-actions">
              <button type="button" className="admin-btn admin-btn--primary" onClick={saveHeader} disabled={pending || !name.trim()}>
                {pending ? "Saving…" : "Save campaign"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Tabs */}
      <div>
        <nav className="admin-tabs">
          <button type="button" className={`admin-tab${tab === "assets" ? " is-active" : ""}`} onClick={() => setTab("assets")}>
            Assets by channel
          </button>
          <button type="button" className={`admin-tab${tab === "seo" ? " is-active" : ""}`} onClick={() => setTab("seo")}>
            SEO / GEO plan
          </button>
        </nav>

        {tab === "assets" ? (
          <AssetsByChannel
            assets={assets}
            addOpen={addOpen}
            setAddOpen={setAddOpen}
            newTitle={newTitle}
            setNewTitle={setNewTitle}
            newChannel={newChannel}
            setNewChannel={setNewChannel}
            newDate={newDate}
            setNewDate={setNewDate}
            addAsset={addAsset}
            pending={pending}
          />
        ) : (
          <section className="admin-card admin-section-card">
            <div className="admin-card-title">SEO / GEO plan</div>
            <p className="admin-page-sub" style={{ marginTop: 4 }}>
              The search and generative-engine plan for this campaign: target keywords, questions to
              own, entities, and internal links. The writer reads it when drafting.
            </p>
            <div className="admin-form" style={{ marginTop: 12 }}>
              <textarea
                className="admin-textarea"
                rows={14}
                value={seoGeoMd}
                onChange={(e) => setSeoGeoMd(e.target.value)}
                placeholder={"## Target keywords\n\n## Questions to own\n\n## Entities & internal links"}
              />
              <div className="admin-form-actions">
                <button type="button" className="admin-btn admin-btn--primary" onClick={saveSeo} disabled={pending}>
                  {pending ? "Saving…" : "Save plan"}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function AssetsByChannel({
  assets,
  addOpen,
  setAddOpen,
  newTitle,
  setNewTitle,
  newChannel,
  setNewChannel,
  newDate,
  setNewDate,
  addAsset,
  pending,
}: {
  assets: CampaignAsset[];
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  newTitle: string;
  setNewTitle: (v: string) => void;
  newChannel: CalendarChannel;
  setNewChannel: (v: CalendarChannel) => void;
  newDate: string;
  setNewDate: (v: string) => void;
  addAsset: () => void;
  pending: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="admin-page-sub">
          {assets.length} asset{assets.length === 1 ? "" : "s"} across {new Set(assets.map((a) => a.channel)).size} channel
          {new Set(assets.map((a) => a.channel)).size === 1 ? "" : "s"}.
        </div>
        <button type="button" className="admin-btn admin-btn--primary admin-btn--sm" onClick={() => setAddOpen(!addOpen)} disabled={pending}>
          {addOpen ? "Close" : "+ Add asset"}
        </button>
      </div>

      {addOpen && (
        <section className="admin-card" style={{ padding: "14px 16px" }}>
          <div className="admin-form">
            <div className="admin-field" style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 2 }}>
                <label className="admin-label" htmlFor="a-title">Title</label>
                <input id="a-title" className="admin-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="What is a centaur team?" />
              </div>
              <div style={{ flex: 1 }}>
                <label className="admin-label" htmlFor="a-channel">Channel</label>
                <select id="a-channel" className="admin-input" value={newChannel} onChange={(e) => setNewChannel(e.target.value as CalendarChannel)}>
                  {CHANNELS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="admin-label" htmlFor="a-date">Publish date</label>
                <input id="a-date" className="admin-input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
            </div>
            <div className="admin-form-actions">
              <button type="button" className="admin-btn admin-btn--primary" onClick={addAsset} disabled={pending || !newTitle.trim()}>
                {pending ? "Adding…" : "Add asset"}
              </button>
            </div>
          </div>
        </section>
      )}

      {assets.length === 0 ? (
        <div className="admin-empty">No assets yet. Add the first piece of content above.</div>
      ) : (
        <div className="mcr-lanes">
          {CHANNELS.map((ch) => {
            const lane = assets.filter((a) => a.channel === ch.id);
            return (
              <div key={ch.id} className="admin-card mcr-lane">
                <div className="mcr-lane-head">
                  <span className="admin-chip">{ch.label}</span>
                  <span className="admin-cell-muted">{lane.length}</span>
                </div>
                {lane.length === 0 ? (
                  <div className="admin-cell-muted" style={{ fontSize: 12, padding: "6px 2px" }}>—</div>
                ) : (
                  lane.map((a) => (
                    <div key={a.id} className="mcr-asset">
                      <div className="mcr-asset-title">{a.title}</div>
                      <div className="mcr-asset-foot">
                        {a.channel === "email" && a.broadcastId ? (
                          <span className="admin-chip admin-chip--accent">Broadcast</span>
                        ) : (
                          <Badge tone={statusTone(a.status)}>{STATUS_LABEL[a.status]}</Badge>
                        )}
                        <span className="admin-cell-muted" style={{ fontSize: 12 }}>{fmtDate(a.publishDate)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
