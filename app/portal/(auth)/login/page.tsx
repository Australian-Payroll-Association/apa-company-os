import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function PortalLoginPage() {
  return (
    <main className="admin-auth">
      <div className="admin-auth-card">
        <div className="admin-auth-brand">
          Edge8 Client Portal
        </div>
        <p className="admin-auth-sub">Sign in to your Edge8 client portal.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
