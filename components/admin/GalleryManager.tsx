"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GalleryPhoto } from "@/lib/gallery";
import { uploadGalleryPhoto, saveGalleryPhoto, removeGalleryPhoto } from "@/app/admin/(dashboard)/operations/gallery/actions";

// Admin gallery management: multi-file upload (each file uploads immediately),
// then an editable grid — caption + date save on blur, delete with confirm.
export function GalleryManager({ photos }: { photos: GalleryPhoto[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    setBusy(files.length);
    start(async () => {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await uploadGalleryPhoto(fd);
        if (!res.ok) setError(res.error);
        setBusy((n) => n - 1);
      }
      router.refresh();
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <>
      <div className="admin-toolbar">
        <button className="admin-btn admin-btn--primary" disabled={pending} onClick={() => inputRef.current?.click()}>
          {busy > 0 ? `Uploading ${busy}…` : "Add photos"}
        </button>
        <span className="admin-cell-muted">{photos.length} {photos.length === 1 ? "photo" : "photos"}</span>
        {error && <span className="admin-alert admin-alert--err" style={{ padding: "4px 10px" }}>{error}</span>}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={onPick} />
      </div>

      {photos.length === 0 ? (
        <div className="admin-empty">No photos yet. Add the first one.</div>
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
