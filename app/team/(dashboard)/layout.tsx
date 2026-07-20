import type { Metadata } from "next";
import { requireTeamMember } from "@/lib/team-auth";
import { TeamSidebar } from "@/components/team/TeamSidebar";
import "../../admin/admin.css";

export const metadata: Metadata = {
  title: { template: "%s · Edge8 AI Workspace", default: "Edge8 AI Workspace" },
  description: "Your Edge8 team workspace.",
  robots: { index: false, follow: false },
};

export default async function TeamDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireTeamMember();

  return (
    <div className="admin-shell">
      <TeamSidebar name={actor.displayName} role={actor.role} isAdmin={actor.isAdmin} />
      <main className="admin-main">{children}</main>
    </div>
  );
}
