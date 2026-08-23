"use client";

import { useState, useTransition } from "react";
import { Badge, statusTone } from "@/components/admin/Badge";
import { STATUS_LABEL, type CalendarEntryRow } from "@/lib/admin/marketing-calendar";
import type { AssetImage } from "@/lib/admin/marketing-images";
import { regenerateAssetImage, saveAssetCopy, selectAssetImage } from "./actions";

type Note = { tone: "ok" | "err"; text: string } | null;

export function ContentDetail({
  campaignId,
  entry,
  initialHtml,
  initialImages,
}: {
  campaignId: string;
  entry: CalendarEntryRow;
  initialHtml: string;
  initialImages: AssetImage[];
}) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<Note>(null);

  const [editing, setEditing] = useState(false);
  const [copyMd, setCopyMd] = useState(entry.copyMd ?? "");
  const [html, setHtml] = useState(initialHtml);

  const [images, setImages] = useState<AssetImage[]>(initialImages);
  const selected = images.find((i) => i.isSelected) ?? images[0] ?? null;

  function saveCopy() {
    setNote(null);
    startTransition(async () => {
      const r = await saveAssetCopy(campaignId, entry.id, copyMd);
      if (r.ok) {
        setHtml(r.html);
        setEditing(false);
        setNote({ tone: "ok", text: "Copy saved." });
      } else {
        setNote({ tone: "err", text: r.error });
      }
    });
  }

  function regenImage() {
    setNote(null);
    startTransition(async () => {
      const r = await regenerateAssetImage(campaignId, entry.id);
      if (r.ok) {
        setImages(r.images);
        setNote({ tone: "ok", text: "New image version added." });
      } else {
        setNote({ tone: "err", text: r.error });
      }
    });
  }

  function pickImage(imageId: string) {
    setNote(null);
    startTransition(async () => {
      const r = await selectAssetImage(campaignId, entry.id, imageId);
      if (r.ok) {
        setImages(r.images);
      } else {
        setNote({ tone: "err", text: r.error });
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {note && <div className={`admin-alert admin-alert--${note.tone}`}>{note.text}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span className="admin-chip">{entry.channel}</span>
        <Badge tone={statusTone(entry.status)}>{STATUS_LABEL[entry.status]}</Badge>
        {entry.pillarName && <span className="admin-chip">Pillar: {entry.pillarName}</span>}
        {entry.channel === "email" && entry.broadcastId && (
          <span className="admin-chip admin-chip--accent">Broadcast</span>
        )}
      </div>

      <div className="mcr-detail-grid">
        {/* Formatted text */}
        <section className="admin-card mcr-panel">
          <div className="mcr-panel-head">
            <span className="mcr-panel-title">Formatted text</span>
            <button
              type="button"
              className="admin-btn admin-btn--sm"
              onClick={() => setEditing((v) => !v)}
              disabled={pending}
            >
              {editing ? "Preview" : "Edit markdown"}
            </button>
          </div>
          {editing ? (
            <div className="admin-form" style={{ padding: 16 }}>
              <textarea
                className="admin-textarea"
                rows={20}
                value={copyMd}
                onChange={(e) => setCopyMd(e.target.value)}
                placeholder="Draft the post copy in markdown…"
              />
              <div className="admin-form-actions">
                <button type="button" className="admin-btn admin-btn--primary" onClick={saveCopy} disabled={pending}>
                  {pending ? "Saving…" : "Save copy"}
                </button>
              </div>
            </div>
          ) : html.trim() ? (
            <div className="idea-plan" style={{ padding: 16 }} dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div className="admin-empty" style={{ margin: 16 }}>
              No copy yet. Edit markdown to write it, or draft it from the calendar.
            </div>
          )}
        </section>

        {/* Images */}
        <section className="admin-card mcr-panel">
          <div className="mcr-panel-head">
            <span className="mcr-panel-title">
              Images{images.length > 0 ? ` · ${images.length}` : ""}
            </span>
            <button type="button" className="admin-btn admin-btn--sm" onClick={regenImage} disabled={pending}>
              {pending ? "Working…" : images.length > 0 ? "Regenerate image" : "Generate image"}
            </button>
          </div>

          {selected ? (
            <>
              <a href={selected.url} target="_blank" rel="noreferrer" className="mcr-imgbox">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selected.url} alt={entry.title} />
              </a>
              {images.length > 1 && (
                <div className="mcr-thumbs">
                  {images.map((img, i) => (
                    <button
                      key={img.id}
                      type="button"
                      className={`mcr-thumb${img.isSelected ? " is-selected" : ""}`}
                      onClick={() => pickImage(img.id)}
                      disabled={pending || img.isSelected}
                      title={img.isSelected ? "Selected" : "Use this version"}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={`Version ${images.length - i}`} />
                    </button>
                  ))}
                </div>
              )}
              <div className="admin-hint" style={{ padding: "0 16px 16px" }}>
                Every generation is kept. The highlighted version is the one that publishes; click an
                older one to switch back.
              </div>
            </>
          ) : (
            <div className="admin-empty" style={{ margin: 16 }}>
              No image yet. Generate one from the entry&apos;s image brief and the brand palette.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
