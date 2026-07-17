import { requireTeamMember } from "@/lib/team-auth";
import { PageHead } from "@/components/admin/PageHead";
import { listGalleryPhotos } from "@/lib/gallery";
import { formatDate } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gallery", description: "Photos from the Edge8 team." };

// Read-only team photo wall. Company-visible (no per-actor scope); admins add
// photos in /admin/operations/gallery. Public-bucket images, so a plain <img>.
export default async function TeamGalleryPage() {
  await requireTeamMember();
  const photos = await listGalleryPhotos();

  return (
    <>
      <PageHead
        eyebrow="Company"
        title="Gallery"
        sub={`${photos.length} ${photos.length === 1 ? "photo" : "photos"}`}
      />
      {photos.length === 0 ? (
        <div className="admin-empty">No photos yet. Check back soon.</div>
      ) : (
        <div className="gallery-masonry">
          {photos.map((p) => (
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
      )}
    </>
  );
}
