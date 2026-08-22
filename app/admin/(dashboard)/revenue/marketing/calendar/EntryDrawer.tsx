"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, statusTone } from "@/components/admin/Badge";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import {
  CHANNELS,
  type BrandOption,
  type CalendarEntryRow,
} from "@/lib/admin/marketing-calendar";
import { updateEntry, deleteEntry, createCampaignFromEntry } from "./actions";

type Note = { tone: "ok" | "err"; text: string } | null;

export function EntryDrawer({
  entry,
  brands,
  allEntries,
  onPatched,
  onDeleted,
  onLinkedCampaign,
}: {
  entry: CalendarEntryRow;
  brands: BrandOption[];
  allEntries: CalendarEntryRow[];
  onPatched: (id: string, partial: Partial<CalendarEntryRow>) => void;
  onDeleted: (id: string) => void;
  onLinkedCampaign: (id: string, campaignId: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<Note>(null);

  const [title, setTitle] = useState(entry.title);
  const [brandId, setBrandId] = useState(entry.brandId ?? "");
  const [channel, setChannel] = useState(entry.channel);
  const [publishDate, setPublishDate] = useState(entry.publishDate ?? "");
  const [pillar, setPillar] = useState(entry.pillar ?? "");
  const [copyMd, setCopyMd] = useState(entry.copyMd ?? "");
  const [assetUrl, setAssetUrl] = useState(entry.assetUrl ?? "");
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [parentId, setParentId] = useState(entry.parentId ?? "");

  const parentChoices = allEntries.filter((e) => e.id !== entry.id);

  function save() {
    setNote(null);
    startTransition(async () => {
      const r = await updateEntry(entry.id, {
        title,
        brandId: brandId || null,
        channel,
        publishDate: publishDate || null,
        pillar: pillar || null,
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
        pillar: pillar || null,
        copyMd: copyMd || null,
        assetUrl: assetUrl || null,
        notes: notes || null,
        parentId: parentId || null,
      });
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

      <div className="admin-form">
        <div className="admin-field">
          <label className="admin-label" htmlFor="e-title">Title</label>
          <input id="e-title" className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="e-brand">Brand</label>
          <select id="e-brand" className="admin-input" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
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
          <input id="e-pillar" className="admin-input" value={pillar} onChange={(e) => setPillar(e.target.value)} placeholder="Content theme" />
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
          <div className="admin-hint" style={{ marginTop: 8 }}>
            Spawns a draft campaign in the send engine, prefilled with this entry&apos;s title, brand, and date.
          </div>
        </div>
      )}
    </div>
  );
}
