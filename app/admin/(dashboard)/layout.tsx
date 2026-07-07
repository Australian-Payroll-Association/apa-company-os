import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import "../admin.css";

export const metadata: Metadata = {
  title: { template: "%s · Edge8 OS", default: "Edge8 OS" },
  description: "Edge8 Company OS — the internal admin for contacts, revenue, talent, and operations.",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="admin-shell">
      <AdminSidebar user={user} />
      <main className="admin-main">{children}</main>
    </div>
  );
}
