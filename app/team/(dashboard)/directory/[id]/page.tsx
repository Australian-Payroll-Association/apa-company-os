import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getMemberProfile } from "@/lib/team/data";
import { formatDate, humanize } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profile",
  description: "A team member's public profile.",
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// /team/directory/[id] — a colleague's public profile. Company-visible like the
// directory and org chart, and limited to the same safe fields plus the
// get-to-know-you extras (hometown, education, hobbies). No contact details.
export default async function MemberProfilePage({ params }: { params: { id: string } }) {
  await requireTeamMember();
  const profile = await getMemberProfile(params.id);
  if (!profile) notFound();

  const meta = [
    profile.fullName && profile.fullName !== profile.name ? profile.fullName : null,
    profile.positionTitle,
    profile.departmentName,
  ]
    .filter(Boolean)
    .join(" · ");
  const personal = !!(profile.hometown || profile.education || profile.hobbies.length);

  return (
    <div className="team-profile">
      <div className="team-profile-head">
        <div className="team-avatar" style={{ width: 88, height: 88, fontSize: 88 / 2.6 }}>
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt={profile.name} />
          ) : (
            <span>{initials(profile.name)}</span>
          )}
        </div>
        <div className="team-profile-head-text">
          <h1 className="admin-page-title">{profile.name}</h1>
          {meta && (
            <p className="admin-page-sub" style={{ marginTop: 2 }}>
              {meta}
            </p>
          )}
        </div>
      </div>

      <div className="team-profile-stack">
        <section className="admin-card admin-section-card">
          <h2 className="admin-card-title">Role</h2>
          <dl className="admin-kv">
            <dt>Position</dt>
            <dd>{profile.positionTitle || "—"}</dd>
            <dt>Department</dt>
            <dd>{profile.departmentName || "—"}</dd>
            <dt>Location</dt>
            <dd>{profile.workLocation || "—"}</dd>
            <dt>Manager</dt>
            <dd>
              {profile.managerId && profile.managerName ? (
                <Link href={`/team/directory/${profile.managerId}`}>{profile.managerName}</Link>
              ) : (
                profile.managerName || "—"
              )}
            </dd>
            <dt>Employment type</dt>
            <dd>{profile.employmentType ? humanize(profile.employmentType) : "—"}</dd>
            <dt>Start date</dt>
            <dd>{profile.startDate ? formatDate(profile.startDate) : "—"}</dd>
          </dl>
        </section>

        {personal && (
          <section className="admin-card admin-section-card">
            <h2 className="admin-card-title">Get to know {profile.name}</h2>
            <dl className="admin-kv">
              {profile.hometown && (
                <>
                  <dt>Hometown</dt>
                  <dd>{profile.hometown}</dd>
                </>
              )}
              {profile.education && (
                <>
                  <dt>Education</dt>
                  <dd>{profile.education}</dd>
                </>
              )}
              {profile.hobbies.length > 0 && (
                <>
                  <dt>Hobbies</dt>
                  <dd>{profile.hobbies.join(", ")}</dd>
                </>
              )}
            </dl>
          </section>
        )}

        <p className="admin-page-sub" style={{ marginBottom: 0 }}>
          <Link href="/team/org">← Back to the org chart</Link>
        </p>
      </div>
    </div>
  );
}
