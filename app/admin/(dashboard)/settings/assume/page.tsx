import { requireAdmin } from "@/lib/admin-auth";
import { listAssumableClients } from "@/lib/admin/portal-assume";
import { PageHead } from "@/components/admin/PageHead";
import { ASSUME_SESSION_MINUTES } from "@/lib/portal-auth";
import { AssumeManager } from "./AssumeManager";

export const dynamic = "force-dynamic";

// Settings → Assume. View the client portal exactly as one of the active
// client companies would see it, without ever leaving your admin session.
export default async function AssumePage() {
  await requireAdmin();
  const clients = await listAssumableClients();

  return (
    <>
      <PageHead
        eyebrow="Settings"
        title="Assume"
        sub={`View /portal as one of ${clients.length} active client ${clients.length === 1 ? "company" : "companies"}. Sessions expire after ${ASSUME_SESSION_MINUTES} minutes and can be ended anytime from the banner shown on every portal page.`}
      />

      <div className="admin-card admin-section-card">
        <AssumeManager clients={clients} />
      </div>
    </>
  );
}
