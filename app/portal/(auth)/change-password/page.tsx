import { requirePortalMember } from "@/lib/portal-auth";
import { ChangePasswordForm } from "./ChangePasswordForm";

// Lives in the un-gated (auth) group so the (dashboard) layout's
// must-change-password redirect cannot loop back here; the page still gates
// itself — a session is required before a password can be changed.
export default async function PortalChangePasswordPage() {
  await requirePortalMember();
  return (
    <main className="admin-auth">
      <div className="admin-auth-card">
        <div className="admin-auth-brand">
          <span className="admin-brand-mark">E8</span> Edge8 Client Portal
        </div>
        <p className="admin-auth-sub">
          You signed in with a temporary password. Choose your own to continue.
        </p>
        <ChangePasswordForm />
      </div>
    </main>
  );
}
