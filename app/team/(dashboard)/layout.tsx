import type { Metadata } from "next";
import { requireTeamMember } from "@/lib/team-auth";
import { isCoach, isCoached } from "@/lib/coaching/data";
import { hasClientAssignments } from "@/lib/team/clients";
import { isHiringManager } from "@/lib/team/hiring";
import { TeamSidebar } from "@/components/team/TeamSidebar";
import { TeamChatWidget } from "@/components/team/TeamChatWidget";
import "../../admin/admin.css";

export const metadata: Metadata = {
  title: { template: "%s · 8 Edges Team", default: "8 Edges Team" },
  description: "Your Edge8 team workspace.",
  robots: { index: false, follow: false },
};

export default async function TeamDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireTeamMember();
  const [coaches, coached, hasClients, hiringManager] = await Promise.all([
    isCoach(actor),
    isCoached(actor),
    hasClientAssignments(actor),
    isHiringManager(actor),
  ]);

  return (
    <div className="admin-shell">
      <TeamSidebar
        name={actor.displayName}
        role={actor.role}
        isAdmin={actor.isAdmin}
        isCoach={coaches}
        isCoached={coached}
        hasClients={hasClients}
        isHiringManager={hiringManager}
      />
      <main className="admin-main">{children}</main>
      <TeamChatWidget />
    </div>
  );
}
