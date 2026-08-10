import Link from "next/link";
import { requireTeamMember } from "@/lib/team-auth";
import { getActorClientCompanies } from "@/lib/team/clients";
import { PageHead } from "@/components/admin/PageHead";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Clients",
};

export default async function TeamClientsPage() {
  const actor = await requireTeamMember();
  const clients = await getActorClientCompanies(actor);

  return (
    <>
      <PageHead
        eyebrow="Team"
        title="My Clients"
        sub="The clients you're assigned to. Open one to see their roadmap."
      />

      {clients.length === 0 ? (
        <div className="admin-card admin-section-card" style={{ padding: 22 }}>
          <p className="admin-page-sub" style={{ margin: 0 }}>
            You&apos;re not assigned to any clients yet. When you&apos;re assigned to a client
            account, it shows up here with their roadmap.
          </p>
        </div>
      ) : (
        <div className="team-hub-grid">
          {clients.map((c) => (
            <Link key={c.id} href={`/team/clients/${c.id}`} className="team-hub-card">
              <span className="team-hub-ico" aria-hidden>◔</span>
              <span className="team-hub-title">{c.name}</span>
              <span className="team-hub-sub">{c.roleTitle || "View roadmap"}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
