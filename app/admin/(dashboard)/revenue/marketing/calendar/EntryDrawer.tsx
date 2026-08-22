"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, statusTone } from "@/components/admin/Badge";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import {
  CHANNELS,
  type BrandOption,
  type CalendarEntryRow,
  type PillarOption,
} from "@/lib/admin/marketing-calendar";
import {
  updateEntry,
  deleteEntry,
  createCampaignFromEntry,
  repurposeEntry,
  markPosted,
  getEntryPerformance,
  type EntryPerformance,
} from "./actions";

type Note = { tone: "ok" | "err"; text: string } | null;

export function EntryDrawer({
  entry,
  brands,
  pillars,
  allEntries,
  onPatched,
  onDeleted,
  onLinkedCampaign,
  onRepurposed,
}: {
  entry: CalendarEntryRow;
  brands: BrandOption[];
  pillars: PillarOption[];
  allEntries: CalendarEntryRow[];
  onPatched: (id: string, partial: Partial<CalendarEntryRow>) => void;
  onDeleted: (id: string) => void;
  onLinkedCampaign: (id: string, campaignId: string) => void;
  onRepurposed: (entries: CalendarEntryRow[]) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<Note>(null);

  const [title, setTitle] = useState(entry.title);
  const [brandId, setBrandId] = useState(entry.brandId ?? "");
  const [channel, setChannel] = useState(entry.channel);
  const [publishDate, setPublishDate] = useState(entry.publishDate ?? "");
  const [pillarId, setPillarId] = useState(entry.pillarId ?? "");
  const [copyMd, setCopyMd] = useState(entry.copyMd ?? "");
  const [assetUrl, setAssetUrl] = useState(entry.assetUrl ?? "");
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [parentId, setParentId] = useState(entry.parentId ?? "");
  const [postedUrl, setPostedUrl] = useState(entry.postedUrl ?? "");
  const [perf, setPerf] = useState<EntryPerformance | null>(null);

  // Delivery numbers for a linked email campaign, loaded once the drawer opens.
  useEffect(() => {
    let live = true;
    setPerf(null);
    if (entry.campaignId) {
      getEntryPerformance(entry.campaignId).then((p) => {
        if (live) setPerf(p);
      });
    }
    return () => {
      live = false;
    };
  }, [entry.campaignId]);

  const parentChoices = allEntries.filter((e) => e.id !== entry.id);
  const brandPillars = brandId ? pillars.filter((p) => p.brandId === brandId) : [];
  const parentEntry = entry.parentId ? allEntries.find((e) => e.id === entry.parentId) ?? null : null;
  const childCount = allEntries.filter((e) => e.parentId === entry.id).length;

  function save() {
    setNote(null);
    startTransition(async () => {
      const r = await updateEntry(entry.id, {
        title,
        brandId: brandId || null,
        channel,
        publishDate: publishDate || null,
        pillarId: pillarId || null,
        copyMd: copyMd || null,
        assetUrl: assetUrl || null,
        notes: notes || null,
        parentId: parentId || null,
      });
      if (!r.ok) {
        setNote({ tone: "err", text: r.error });
        return;
      }
      setNote({ tone: "ok", text: "Saved." });
      onPatched(entry.id, {
        title,
        brandId: brandId || null,
        brandName: brands.find((b) => b.id === brandId)?.name ?? null,
        channel,
        publishDate: publishDate || null,
        pillarId: pillarId || null,
        pillarName: pillars.find((p) => p.id === pillarId)?.name ?? null,
        copyMd: copyMd || null,
        assetUrl: assetUrl || null,
        notes: notes || null,
        parentId: parentId || null,
      });
    });
  }

  function repurpose() {
    setNote(null);
    startTransition(async () => {
      const r = await repurposeEntry(entry.id);
      if (!r.ok) {
        setNote({ tone: "err", text: r.error });
        return;
      }
      onRepurposed(r.entries);
      setNote({ tone: "ok", text: "Derivatives added to the board." });
    });
  }

  function post() {
    setNote(null);
    startTransition(async () => {
      const r = await markPosted(entry.id, postedUrl);
      if (!r.ok) {
        setNote({ tone: "err", text: r.error });
        return;
      }
      onPatched(entry.id, { status: "published", postedUrl: postedUrl.trim() || null });
      setNote({ tone: "ok", text: "Marked as posted." });
    });
  }

  function spawnCampaign() {
    setNote(null);
    startTransition(async () => {
      const r = await createCampaignFromEntry(entry.id);
      if (!r.ok) {
        setNote({ tone: "err", text: r.error });
        return;
      }
      onLinkedCampaign(entry.id, r.campaignId);
      router.push(`/admin/revenue/marketing/campaigns/${r.campaignId}`);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {note && <div className={`admin-alert admin-alert--${note.tone}`}>{note.text}</div>}

      <div className="admin-card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div className="admin-label">Repurposing waterfall</div>
          <div className="admin-hint" style={{ marginTop: 2 }}>
            {parentEntry
              ? `Derived from "${parentEntry.title}".`
              : childCount > 0
                ? `${childCount} derivative${childCount === 1 ? "" : "s"} on the board.`
                : "Spin off dated LinkedIn, Facebook, and email versions of this asset."}
          </div>
        </div>
        <button type="button" className="admin-btn" disabled={pending} onClick={repurpose}>
          Repurpose →
        </button>
      </div>

      <div className="admin-form">
        <div className="admin-field">
          <label className="admin-label" htmlFor="e-title">Title</label>
          <input id="e-title" className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="e-brand">Brand</label>
          <select
            id="e-brand"
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

        <div className="admin-field">
          <label className="admin-label" htmlFor="e-channel">Channel</label>
          <select id="e-channel" className="admin-input" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="e-date">Publish date</label>
          <input id="e-date" className="admin-input" type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="e-pillar">Pillar</label>
          <select
            id="e-pillar"
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
          <div className="admin-hint">Manage pillars from the Pillars card on the calendar page.</div>
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="e-parent">Repurposed from</label>
          <select id="e-parent" className="admin-input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Standalone —</option>
            {parentChoices.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
          <div className="admin-hint">Link a channel post to the core asset it came from.</div>
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="e-copy">Copy</label>
          <textarea id="e-copy" className="admin-textarea" rows={8} value={copyMd} onChange={(e) => setCopyMd(e.target.value)} placeholder="Draft the post copy here…" />
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="e-asset">Asset URL</label>
          <input id="e-asset" className="admin-input" value={assetUrl} onChange={(e) => setAssetUrl(e.target.value)} placeholder="Image, doc, or link" />
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="e-notes">Notes</label>
          <textarea id="e-notes" className="admin-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="admin-form-actions">
          <button type="button" className="admin-btn admin-btn--primary" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </button>
          <ConfirmButton
            label="Delete"
            title="Delete this entry?"
            body="This removes the calendar entry. Any linked campaign is left untouched."
            confirmLabel="Delete"
            disabled={pending}
            onConfirm={() => deleteEntry(entry.id)}
            onDone={() => onDeleted(entry.id)}
          />
        </div>
      </div>

      {entry.channel !== "email" && (
        <div className="admin-card" style={{ padding: "12px 14px" }}>
          <div className="admin-label" style={{ marginBottom: 8 }}>Publish</div>
          <div className="admin-form">
            <input
              className="admin-input"
              value={postedUrl}
              onChange={(e) => setPostedUrl(e.target.value)}
              placeholder="Live post URL (optional)"
            />
            <div className="admin-form-actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={pending || entry.status === "published"}
                onClick={post}
              >
                {entry.status === "published" ? "Posted" : "Mark posted"}
              </button>
              {entry.postedUrl && (
                <a className="admin-btn admin-btn--sm" href={entry.postedUrl} target="_blank" rel="noreferrer">
                  View live
                </a>
              )}
            </div>
          </div>
          <div className="admin-hint" style={{ marginTop: 8 }}>
            You post {CHANNELS.find((c) => c.id === entry.channel)?.label ?? "this"} by hand; recording it
            here moves the entry to Published and clears it from the daily reminder.
          </div>
        </div>
      )}

      {entry.channel === "email" && (
        <div className="admin-card" style={{ padding: "12px 14px" }}>
          <div className="admin-label" style={{ marginBottom: 8 }}>Email campaign</div>
          {entry.campaignId ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {entry.campaignStatus && (
                <Badge tone={statusTone(entry.campaignStatus)}>{entry.campaignStatus}</Badge>
              )}
              <Link className="admin-btn admin-btn--sm" href={`/admin/revenue/marketing/campaigns/${entry.campaignId}`}>
                Open campaign
              </Link>
            </div>
          ) : (
            <button type="button" className="admin-btn admin-btn--primary" disabled={pending} onClick={spawnCampaign}>
              Create campaign
            </button>
          )}
          {perf && perf.sent > 0 && (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
              <PerfStat label="Sent" value={perf.sent} />
              <PerfStat label="Delivered" value={perf.delivered} />
              <PerfStat label="Opened" value={perf.opened} />
              <PerfStat label="Clicked" value={perf.clicked} />
            </div>
          )}
          <div className="admin-hint" style={{ marginTop: 8 }}>
            Spawns a draft campaign in the send engine, prefilled with this entry&apos;s title, brand, and date.
          </div>
        </div>
      )}
    </div>
  );
}

function PerfStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{value.toLocaleString()}</div>
      <div className="admin-hint">{label}</div>
    </div>
  );
}
