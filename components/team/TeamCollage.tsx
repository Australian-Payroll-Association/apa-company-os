import type { GalleryPhoto, CollageAvatar } from "@/lib/gallery";

// A photo-wall band for the /team home: recent gallery photos interleaved with
// team avatars. Server component — plain <img>/<a>, no client JS. Renders
// nothing when there's neither a photo nor an avatar to show.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const raw = parts.length >= 2 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return raw.toUpperCase();
}

export function TeamCollage({ photos, avatars }: { photos: GalleryPhoto[]; avatars: CollageAvatar[] }) {
  if (photos.length === 0 && avatars.length === 0) return null;

  const tiles: React.ReactNode[] = [];
  let pi = 0;
  let ai = 0;
  // Lead with a photo, then a couple of faces, and repeat — a loose collage.
  while (pi < photos.length || ai < avatars.length) {
    if (pi < photos.length) {
      const p = photos[pi++];
      tiles.push(
        <a key={`p${p.id}`} className="team-collage-photo" href={p.image_url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.image_url} alt={p.caption || "Team photo"} />
          {p.caption && <span className="team-collage-cap">{p.caption}</span>}
        </a>,
      );
    }
    for (let k = 0; k < 2 && ai < avatars.length; k++) {
      const a = avatars[ai++];
      tiles.push(
        <span key={`a${a.id}`} className="team-collage-avatar" title={a.name}>
          {a.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.avatarUrl} alt={a.name} />
          ) : (
            <span>{initials(a.name)}</span>
          )}
        </span>,
      );
    }
  }

  return <div className="team-collage">{tiles}</div>;
}
