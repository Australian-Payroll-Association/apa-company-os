"use client";

import { useState } from "react";
import { GALLERY_CATEGORIES, type GalleryPhoto } from "@/lib/gallery";
import { formatDate } from "@/lib/admin/format";

// Client-side category filter over the team photo wall. Small dataset, so the
// tabs filter in memory. Empty categories are hidden from the tab bar.
export function GalleryBrowser({ photos }: { photos: GalleryPhoto[] }) {
  const [filter, setFilter] = useState("");
  const cats = GALLERY_CATEGORIES.map((c) => ({
    ...c,
    count: photos.filter((p) => p.category === c.key).length,
  })).filter((c) => c.count > 0);
  const shown = filter ? photos.filter((p) => p.category === filter) : photos;

  return (
    <>
      {cats.length > 0 && (
        <div className="admin-tabs" role="tablist" aria-label="Category">
          <button type="button" className={`admin-tab${filter === "" ? " is-active" : ""}`} role="tab" aria-selected={filter === ""} onClick={() => setFilter("")}>
            All ({photos.length})
          </button>
          {cats.map((c) => (
            <button key={c.key} type="button" className={`admin-tab${filter === c.key ? " is-active" : ""}`} role="tab" aria-selected={filter === c.key} onClick={() => setFilter(c.key)}>
              {c.label} ({c.count})
            </button>
          ))}
        </div>
      )}

      <div className="gallery-masonry">
        {shown.map((p) => (
          <a key={p.id} className="gallery-tile" href={p.image_url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_url} alt={p.caption || "Team photo"} />
            {(p.caption || p.taken_on) && (
              <span className="gallery-tile-cap">
                {p.caption}
                {p.caption && p.taken_on ? " · " : ""}
                {p.taken_on ? formatDate(p.taken_on) : ""}
              </span>
            )}
          </a>
        ))}
      </div>
    </>
  );
}
