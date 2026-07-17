"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GalleryPhoto } from "@/lib/gallery";
import { createGalleryUpload, recordGalleryUpload, saveGalleryPhoto, removeGalleryPhoto } from "@/app/admin/(dashboard)/operations/gallery/actions";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
// Public anon key — mirrors what the supabase browser client sends; harmless if
// the signed-upload endpoint doesn't require it. Absent only in odd env setups.
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type QueueItem = {
  id: number;
  file: File;
  name: string;
  previewUrl: string;
  progress: number; // 0..1
  status: "uploading" | "done" | "error";
  error?: string;
};

// Drag-and-drop gallery uploader: drop (or browse) any number of photos, watch
// each one's progress bar, then they drop into the editable grid below. Uploads
// stream to /api/admin/gallery/upload via XHR (server actions can't report
// upload progress), three at a time.
export function GalleryManager({ photos }: { photos: GalleryPhoto[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const [drag, setDrag] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  function update(id: number, patch: Partial<QueueItem>) {
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  // Direct-to-storage: get a signed upload URL, PUT the file to it (with a real
  // progress bar), then record the row. The file never touches our server, so
  // there's no size limit in the way.
  async function uploadOne(item: QueueItem): Promise<void> {
    const signed = await createGalleryUpload(item.file.type);
    if (!signed.ok) {
      update(item.id, { status: "error", error: signed.error });
      return;
    }
    const put = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signed.signedUrl);
      if (SUPABASE_ANON) xhr.setRequestHeader("apikey", SUPABASE_ANON);
      xhr.setRequestHeader("x-upsert", "false");
      // Reserve the last slice of the bar for the record step.
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) update(item.id, { progress: (e.loaded / e.total) * 0.95 });
      };
      xhr.onload = () =>
        resolve(
          xhr.status >= 200 && xhr.status < 300
            ? { ok: true }
            : { ok: false, error: `Upload failed (${xhr.status}).` },
        );
      xhr.onerror = () => resolve({ ok: false, error: "Network error." });
      // Supabase signed upload expects multipart with the file under an empty key.
      const fd = new FormData();
      fd.append("cacheControl", "3600");
      fd.append("", item.file);
      xhr.send(fd);
    });
    if (!put.ok) {
      update(item.id, { status: "error", error: put.error });
      return;
    }
    const rec = await recordGalleryUpload(signed.path);
    update(item.id, rec.ok ? { status: "done", progress: 1 } : { status: "error", error: rec.error });
  }

  async function addFiles(files: File[]) {
    const images = files.filter((f) => ACCEPT.includes(f.type));
    if (images.length === 0) return;
    const items: QueueItem[] = images.map((file) => ({
      id: nextId.current++,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: "uploading",
    }));
    setQueue((q) => [...items, ...q]);

    // Upload three at a time.
    const pending = [...items];
    const worker = async () => {
      for (;;) {
        const it = pending.shift();
        if (!it) return;
        await uploadOne(it);
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, pending.length) }, worker));
    router.refresh();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    addFiles(Array.from(e.dataTransfer.files));
  }
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []));
    if (inputRef.current) inputRef.current.value = "";
  }
  function clearFinished() {
    setQueue((q) => {
      q.filter((it) => it.status !== "uploading").forEach((it) => URL.revokeObjectURL(it.previewUrl));
      return q.filter((it) => it.status === "uploading");
    });
  }

  const uploading = queue.some((it) => it.status === "uploading");

  return (
    <>
      <div
        className={`gallery-drop${drag ? " is-drag" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        <span className="gallery-drop-ico" aria-hidden>⬆</span>
        <span className="gallery-drop-title">Drag photos here, or click to browse</span>
        <span className="gallery-drop-sub">JPG, PNG, or WebP · any size</span>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={onPick} />
      </div>

      {queue.length > 0 && (
        <div className="gallery-queue">
          {queue.map((it) => (
            <div className="gallery-queue-item" key={it.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="gallery-queue-thumb" src={it.previewUrl} alt="" />
              <div className="gallery-queue-body">
                <div className="gallery-queue-name">{it.name}</div>
                {it.status === "error" ? (
                  <div className="gallery-queue-err">{it.error}</div>
                ) : (
                  <div className="gallery-bar">
                    <div
                      className={`gallery-bar-fill${it.status === "done" ? " is-done" : ""}`}
                      style={{ width: `${Math.round(it.progress * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <span className={`gallery-queue-status is-${it.status}`}>
                {it.status === "done" ? "✓" : it.status === "error" ? "✕" : `${Math.round(it.progress * 100)}%`}
              </span>
            </div>
          ))}
          {!uploading && (
            <button className="admin-btn admin-btn--sm" onClick={clearFinished} style={{ alignSelf: "flex-start" }}>
              Clear
            </button>
          )}
        </div>
      )}

      <div className="admin-toolbar" style={{ marginTop: 18 }}>
        <span className="admin-cell-muted">{photos.length} {photos.length === 1 ? "photo" : "photos"}</span>
      </div>

      {photos.length === 0 ? (
        <div className="admin-empty">No photos yet. Drop the first one above.</div>
      ) : (
        <div className="gallery-admin-grid">
          {photos.map((p) => (
            <PhotoCard key={p.id} photo={p} onChanged={() => router.refresh()} />
          ))}
        </div>
      )}
    </>
  );
}

function PhotoCard({ photo, onChanged }: { photo: GalleryPhoto; onChanged: () => void }) {
  const [pending, start] = useTransition();
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [takenOn, setTakenOn] = useState(photo.taken_on ?? "");

  function save() {
    if (caption === (photo.caption ?? "") && takenOn === (photo.taken_on ?? "")) return;
    start(async () => {
      await saveGalleryPhoto(photo.id, caption, takenOn);
      onChanged();
    });
  }
  function del() {
    if (!window.confirm("Delete this photo?")) return;
    start(async () => {
      await removeGalleryPhoto(photo.id);
      onChanged();
    });
  }

  return (
    <div className="gallery-admin-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.image_url} alt={caption || "Team photo"} className="gallery-admin-img" />
      <input
        className="admin-input gallery-admin-cap"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        onBlur={save}
        placeholder="Add a caption"
        disabled={pending}
      />
      <div className="gallery-admin-row">
        <input className="admin-input" type="date" value={takenOn} onChange={(e) => setTakenOn(e.target.value)} onBlur={save} disabled={pending} />
        <button className="admin-btn admin-btn--sm admin-btn--danger" onClick={del} disabled={pending}>Delete</button>
      </div>
    </div>
  );
}
