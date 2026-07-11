import { requireTeamMember } from "@/lib/team-auth";
import { getOwnProfile } from "@/lib/team/data";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatDate, humanize } from "@/lib/admin/format";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Profile",
  description: "Your employment details and contact info.",
};

// /team/profile — the actor's own record only (getOwnProfile is self-scoped by
// construction). Employment fields are read-only; contact + emergency contact
// are editable via the strictly-self saveOwnContact action.
export default async function TeamProfilePage() {
  const actor = await requireTeamMember();
  const profile = await getOwnProfile(actor);

  if (!profile) {
    return (
      <>
        <PageHead eyebrow="Me" title="My Profile" />
        <div className="admin-alert admin-alert--err">
          Your employment record could not be loaded. Contact your admin.
        </div>
      </>
    );
  }

  const p = profile.person;

  return (
    <>
      <PageHead
        eyebrow="Me"
        title={actor.displayName}
        sub={[profile.positionTitle, p?.email].filter(Boolean).join(" · ")}
        action={
          profile.status ? (
            <Badge tone={statusTone(profile.status)}>{humanize(profile.status)}</Badge>
          ) : undefined
        }
      />

      <div className="admin-360">
        <div className="admin-card admin-section-card">
          <h2 className="admin-card-title">Employment</h2>
          <p className="admin-page-sub" style={{ marginTop: 0 }}>
            Managed by the company — talk to your admin if something is wrong.
          </p>
          <dl className="admin-kv">
            <dt>Full name</dt>
            <dd>{p?.full_name || "—"}</dd>
            <dt>Email</dt>
            <dd>{p?.email || "—"}</dd>
            <dt>Department</dt>
            <dd>{profile.departmentName || "—"}</dd>
            <dt>Position</dt>
            <dd>{profile.positionTitle || "—"}</dd>
            <dt>Manager</dt>
            <dd>{profile.managerName || "—"}</dd>
            <dt>Employment type</dt>
            <dd>{profile.employment_type ? humanize(profile.employment_type) : "—"}</dd>
            <dt>Employee #</dt>
            <dd>{profile.employee_number || "—"}</dd>
            <dt>Location</dt>
            <dd>{profile.work_location || "—"}</dd>
            <dt>Start date</dt>
            <dd>{profile.start_date ? formatDate(profile.start_date) : "—"}</dd>
          </dl>
        </div>

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
