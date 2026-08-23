"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, statusTone } from "@/components/admin/Badge";
import { MetricCard } from "@/components/admin/MetricCard";
import {
  CHANNELS,
  STATUS_LABEL,
  type BrandOption,
  type CalendarChannel,
  type CalendarEntryRow,
  type PillarOption,
} from "@/lib/admin/marketing-calendar";
import {
  CAMPAIGN_STATUSES,
  type CampaignReport,
  type MarketingCampaignRow,
} from "@/lib/admin/marketing-campaigns";
import { CalendarBoard } from "../../calendar/CalendarBoard";
import { CalendarMonth } from "../../calendar/CalendarMonth";
import { moveEntry } from "../../calendar/actions";
import { addAssetToCampaign, updateCampaign } from "../actions";

type Note = { tone: "ok" | "err"; text: string } | null;
type Tab = "assets" | "workboard" | "calendar" | "report" | "seo";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CampaignHub({
  campaign,
  entries: initialEntries,
  report,
  brands,
  pillars,
}: {
  campaign: MarketingCampaignRow;
  entries: CalendarEntryRow[];
  report: CampaignReport;
  brands: BrandOption[];
  pillars: PillarOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<Note>(null);
  const [tab, setTab] = useState<Tab>("assets");
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState(campaign.name);
  const [objective, setObjective] = useState(campaign.objective ?? "");
  const [brandId, setBrandId] = useState(campaign.brandId ?? "");
  const [pillarId, setPillarId] = useState(campaign.pillarId ?? "");
  const [startsOn, setStartsOn] = useState(campaign.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(campaign.endsOn ?? "");
  const [status, setStatus] = useState(campaign.status);
  const [seoGeoMd, setSeoGeoMd] = useState(campaign.seoGeoMd ?? "");

  const [entries, setEntries] = useState<CalendarEntryRow[]>(initialEntries);

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

  function openAsset(id: string) {
    router.push(`/admin/revenue/marketing/campaigns/${campaign.id}/assets/${id}`);
  }

  // Optimistic status move for the workboard; revert on failure.
  function move(id: string, next: string) {
    const prev = entries;
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, status: next as CalendarEntryRow["status"] } : e)));
    setNote(null);
    moveEntry(id, next).then((r) => {
      if (!r.ok) {
        setEntries(prev);
        setNote({ tone: "err", text: `Couldn't move: ${r.error}` });
      }
    });
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
        setEntries((prev) => [
          ...prev,
          {
            id: result.id,
            title,
            brandId: campaign.brandId,
            brandName: campaign.brandName,
            pillarId: campaign.pillarId,
            pillarName: campaign.pillarName,
            channel: newChannel,
            status: "idea",
            publishDate: newDate || null,
            parentId: null,
            broadcastId: null,
            broadcastStatus: null,
            campaignId: campaign.id,
            campaignName: campaign.name,
            copyMd: null,
            assetUrl: null,
            postedUrl: null,
            notes: null,
            blogStyle: null,
            socialStyle: null,
            imageStyle: null,
            imageType: null,
            seoMd: null,
            imageBriefMd: null,
            imageUrl: null,
            sortOrder: 0,
            createdAt: new Date().toISOString(),
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
          <button type="button" className={`admin-tab${tab === "workboard" ? " is-active" : ""}`} onClick={() => setTab("workboard")}>
            Workboard
          </button>
          <button type="button" className={`admin-tab${tab === "calendar" ? " is-active" : ""}`} onClick={() => setTab("calendar")}>
            Calendar
          </button>
          <button type="button" className={`admin-tab${tab === "report" ? " is-active" : ""}`} onClick={() => setTab("report")}>
            Report
          </button>
          <button type="button" className={`admin-tab${tab === "seo" ? " is-active" : ""}`} onClick={() => setTab("seo")}>
            SEO / GEO plan
          </button>
        </nav>

        {tab === "assets" && (
          <AssetsByChannel
            campaignId={campaign.id}
            entries={entries}
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
        )}

        {tab === "workboard" && (
          <div className="admin-card admin-section-card">
            <div className="admin-card-title">Workboard</div>
            <p className="admin-page-sub" style={{ marginTop: 4, marginBottom: 12 }}>
              Where each asset sits in production. Drag a card to move its stage, or open one to edit
              its copy and images.
            </p>
            {entries.length === 0 ? (
              <div className="admin-empty">No assets yet.</div>
            ) : (
              <CalendarBoard entries={entries} onMove={move} onCardClick={openAsset} />
            )}
          </div>
        )}

        {tab === "calendar" && (
          <div className="admin-card admin-section-card">
            <div className="admin-card-title">Publish calendar</div>
            {entries.length === 0 ? (
              <div className="admin-empty">No assets yet.</div>
            ) : (
              <CalendarMonth entries={entries} onSelect={openAsset} />
            )}
          </div>
        )}

        {tab === "report" && <ReportPanel report={report} />}

        {tab === "seo" && (
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
  campaignId,
  entries,
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
  campaignId: string;
  entries: CalendarEntryRow[];
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
  const channelCount = new Set(entries.map((a) => a.channel)).size;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="admin-page-sub">
          {entries.length} asset{entries.length === 1 ? "" : "s"} across {channelCount} channel
          {channelCount === 1 ? "" : "s"}.
        </div>
        <button type="button" className="admin-btn admin-btn--primary admin-btn--sm" onClick={() => setAddOpen(!addOpen)} disabled={pending}>
          {addOpen ? "Close" : "+ Add asset"}
        </button>
      </div>

      {addOpen && (
        <section className="admin-card" style={{ padding: "14px 16px" }}>
          <div className="admin-form">
            <div className="admin-field" style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "2 1 220px" }}>
                <label className="admin-label" htmlFor="a-title">Title</label>
                <input id="a-title" className="admin-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="What is a centaur team?" />
              </div>
              <div style={{ flex: "1 1 130px" }}>
                <label className="admin-label" htmlFor="a-channel">Channel</label>
                <select id="a-channel" className="admin-input" value={newChannel} onChange={(e) => setNewChannel(e.target.value as CalendarChannel)}>
                  {CHANNELS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: "1 1 150px" }}>
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

      {entries.length === 0 ? (
        <div className="admin-empty">No assets yet. Add the first piece of content above.</div>
      ) : (
        <div className="mcr-lanes">
          {CHANNELS.map((ch) => {
            const lane = entries.filter((a) => a.channel === ch.id);
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
                      <Link className="mcr-asset-title" href={`/admin/revenue/marketing/campaigns/${campaignId}/assets/${a.id}`}>
                        {a.title}
                      </Link>
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

function ReportPanel({ report }: { report: CampaignReport }) {
  const openRate = report.delivered > 0 ? `${Math.round((report.opened / report.delivered) * 100)}%` : "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="mp-kpi-grid">
        <MetricCard label="Assets live" value={String(report.assetsLive)} sub={`of ${report.assetsTotal} planned`} />
        <MetricCard label="Emails delivered" value={report.delivered.toLocaleString()} sub={`${report.broadcasts.length} broadcast${report.broadcasts.length === 1 ? "" : "s"}`} />
        <MetricCard label="Open rate" value={openRate} sub={`${report.opened.toLocaleString()} opened`} />
        <MetricCard label="Clicks" value={report.clicked.toLocaleString()} sub="link clicks" />
      </div>

      <div className="mcr-report-split">
        <section className="admin-card admin-section-card">
          <div className="admin-card-title">Email (Broadcasts)</div>
          {report.broadcasts.length === 0 ? (
            <div className="admin-cell-muted" style={{ marginTop: 8, fontSize: 13 }}>No broadcasts in this campaign yet.</div>
          ) : (
            <div style={{ marginTop: 10 }}>
              {report.broadcasts.map((b) => (
                <div key={b.id} className="mcr-report-row">
                  <span style={{ flex: 1, fontSize: 13 }}>{b.title}</span>
                  <span className="admin-cell-mono" style={{ fontSize: 12 }}>
                    {b.sent > 0 ? `${b.sent.toLocaleString()} sent · ${b.openRate ?? "—"}% open` : b.status ?? "draft"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-card admin-section-card">
          <div className="admin-card-title">Content (Blog · Social)</div>
          {report.content.filter((c) => c.channel !== "email").length === 0 ? (
            <div className="admin-cell-muted" style={{ marginTop: 8, fontSize: 13 }}>No content assets yet.</div>
          ) : (
            <div style={{ marginTop: 10 }}>
              {report.content
                .filter((c) => c.channel !== "email")
                .map((c) => (
                  <div key={c.channel} className="mcr-report-row">
                    <span style={{ flex: 1, fontSize: 13, textTransform: "capitalize" }}>{c.channel}</span>
                    <span className="admin-cell-mono" style={{ fontSize: 12 }}>
                      {c.published} / {c.total} published
                    </span>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
