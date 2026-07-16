import { requireTeamMember } from "@/lib/team-auth";
import { getOwnProfile } from "@/lib/team/data";
import { Badge, statusTone } from "@/components/admin/Badge";
import { AvatarUpload } from "@/components/team/AvatarUpload";
import { formatDate, humanize } from "@/lib/admin/format";
import { ProfileForm } from "./ProfileForm";
import { saveOwnAvatar } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Profile",
  description: "Your employment details and contact info.",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function birthday(month: number | null, day: number | null): string | null {
  if (!month || !day || month < 1 || month > 12) return null;
  return `${MONTHS[month - 1]} ${day}`;
}

// /team/profile — the actor's own record only (getOwnProfile is self-scoped by
// construction). Employment fields are read-only; the avatar and contact block
// are self-editable. Sensitive PII (ID, bank, full DOB) is never loaded here.
export default async function TeamProfilePage() {
  const actor = await requireTeamMember();
  const profile = await getOwnProfile(actor);

  if (!profile) {
    return (
      <div className="admin-alert admin-alert--err">
        Your employment record could not be loaded. Contact your admin.
      </div>
    );
  }

  const p = profile.person;
  const x = profile.extras;
  const bday = birthday(x.birthMonth, x.birthDay);
  const hasAbout = x.hometown || x.education || bday || x.hobbies.length > 0;

  return (
    <>
      <div className="team-profile-head">
        <AvatarUpload name={actor.displayName} avatarUrl={profile.avatarUrl} action={saveOwnAvatar} />
        <div className="team-profile-head-text">
          <div className="admin-eyebrow">Me</div>
          <h1 className="admin-page-title">{actor.displayName}</h1>
          <p className="admin-page-sub" style={{ marginTop: 2 }}>
            {[profile.positionTitle, p?.email].filter(Boolean).join(" · ")}
          </p>
        </div>
        {profile.status && (
          <Badge tone={statusTone(profile.status)}>{humanize(profile.status)}</Badge>
        )}
      </div>

      <div className="team-profile-grid">
        <div className="admin-card admin-section-card">
          <h2 className="admin-card-title">Employment</h2>
          <p className="admin-page-sub" style={{ marginTop: 0 }}>
            Managed by the company — talk to your admin if something is wrong.
          </p>
          <dl className="admin-kv">
            <dt>Full name</dt>
            <dd>{p?.full_name || "—"}</dd>
            <dt>Department</dt>
            <dd>{profile.departmentName || "—"}</dd>
            <dt>Position</dt>
            <dd>{profile.positionTitle || "—"}</dd>
            <dt>Manager</dt>
            <dd>{profile.managerName || "—"}</dd>
            <dt>Employment type</dt>
            <dd>{profile.employment_type ? humanize(profile.employment_type) : "—"}</dd>
            <dt>Location</dt>
            <dd>{profile.work_location || "—"}</dd>
            <dt>Start date</dt>
            <dd>{profile.start_date ? formatDate(profile.start_date) : "—"}</dd>
          </dl>
        </div>

        {hasAbout && (
          <div className="admin-card admin-section-card">
            <h2 className="admin-card-title">About</h2>
            <dl className="admin-kv">
              {x.hometown && (<><dt>Hometown</dt><dd>{x.hometown}</dd></>)}
              {x.education && (<><dt>Education</dt><dd>{x.education}</dd></>)}
              {bday && (<><dt>Birthday</dt><dd>{bday}</dd></>)}
            </dl>
            {x.hobbies.length > 0 && (
              <div className="team-chips" style={{ marginTop: 12 }}>
                {x.hobbies.map((h) => (
                  <span className="team-chip" key={h}>{h}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="admin-card admin-section-card">
          <h2 className="admin-card-title">Contact details</h2>
          <p className="admin-page-sub" style={{ marginTop: 0 }}>
            Yours to keep up to date.
          </p>
          <ProfileForm
            preferredName={p?.preferred_name ?? ""}
            phone={p?.phone ?? ""}
            emergencyContactName={p?.emergency_contact_name ?? ""}
            emergencyContactPhone={p?.emergency_contact_phone ?? ""}
          />
        </div>
      </div>
    </>
  );
}
