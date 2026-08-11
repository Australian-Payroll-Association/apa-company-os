import { endAssumeSession } from "@/app/portal/(dashboard)/actions";
import type { PortalImpersonation } from "@/lib/portal-auth";

// Persistent, unmissable banner while an admin is viewing /portal via Assume.
// Never rendered for a real client — impersonation is null for them by
// construction (lib/portal-auth.ts).
export function AssumeBanner({
  impersonation,
  viewingAsName,
  companyName,
}: {
  impersonation: PortalImpersonation;
  viewingAsName: string;
  companyName: string | null;
}) {
  const expiresIn = Math.max(
    0,
    Math.round((new Date(impersonation.expiresAt).getTime() - Date.now()) / 60000),
  );

  return (
    <div
      style={{
        background: "var(--admin-warn-bg)",
        color: "var(--admin-warn-ink)",
        borderBottom: "1px solid var(--admin-line-strong)",
        padding: "6px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
        fontSize: 12,
        lineHeight: 1.4,
      }}
    >
      <span>
        <strong>Admin view</strong> — viewing as {viewingAsName}
        {companyName ? ` (${companyName})` : ""} · signed in as {impersonation.adminEmail} ·
        expires in {expiresIn}m
      </span>
      <form action={endAssumeSession}>
        <button type="submit" className="admin-btn admin-btn--sm">
          Exit
        </button>
      </form>
    </div>
  );
}
