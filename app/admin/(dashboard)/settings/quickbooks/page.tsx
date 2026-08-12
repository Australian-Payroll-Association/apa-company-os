import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import { requireAdmin } from "@/lib/admin-auth";
import { getQboConnectionStatus, qboConfigured } from "@/lib/qbo";
import { formatDate } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "QuickBooks",
  description: "QuickBooks Online connection for automatic client invoicing.",
};

const STATUS_MESSAGE: Record<string, { tone: "ok" | "err"; text: string }> = {
  connected: { tone: "ok", text: "QuickBooks connected." },
  error: { tone: "err", text: "Connecting failed — check the server logs and try again." },
  state_mismatch: { tone: "err", text: "The sign-in flow expired — try Connect again." },
  missing_code: { tone: "err", text: "Intuit returned no authorization code — try Connect again." },
  unconfigured: { tone: "err", text: "QBO env vars are missing (see setup notes below)." },
};

// Settings → QuickBooks. One connection (Talent Edge LLC): when a client
// accepts finished contractor work in the portal, the app creates the QBO
// invoice at the contractor's billable rate and QBO emails it to the client.
// Disconnected ≠ broken: billing degrades to a manual_required flag + an
// accountant email until reconnected.
export default async function QuickBooksSettingsPage({ searchParams }: { searchParams: SearchParamsObj }) {
  await requireAdmin();
  const status = await getQboConnectionStatus();
  const flash = STATUS_MESSAGE[firstParam(searchParams.status) ?? ""] ?? null;

  return (
    <>
      <PageHead
        eyebrow="Settings"
        title="QuickBooks"
        sub="Automatic client invoicing for portal work requests."
      />

      {flash && (
        <div className={`admin-alert ${flash.tone === "ok" ? "admin-alert--ok" : "admin-alert--err"}`} style={{ marginBottom: 14 }}>
          {flash.text}
        </div>
      )}

      <div className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
        <h2 className="admin-card-title" style={{ marginBottom: 10 }}>
          Connection {status.connected ? <Badge tone="ok">Connected</Badge> : <Badge tone="warn">Not connected</Badge>}
        </h2>
        {status.connected ? (
          <dl className="admin-kv">
            <dt>Realm</dt>
            <dd className="admin-cell-mono">{status.realmId}</dd>
            <dt>Environment</dt>
            <dd>{status.environment}</dd>
            <dt>Connected by</dt>
            <dd>{status.connectedBy}</dd>
            <dt>Last token refresh</dt>
            <dd>{formatDate(status.updatedAt)}</dd>
            <dt>Refresh token expires</dt>
            <dd>{formatDate(status.refreshTokenExpiresAt)} (auto-renewed weekly)</dd>
          </dl>
        ) : (
          <p className="admin-page-sub" style={{ margin: 0 }}>
            Until QuickBooks is connected, accepted portal work is flagged for manual invoicing and the
            accountant is emailed the details instead.
          </p>
        )}
        <div style={{ marginTop: 14 }}>
          <a href="/api/qbo/connect" className="admin-btn admin-btn--primary">
            {status.connected ? "Reconnect" : "Connect QuickBooks"}
          </a>
        </div>
      </div>

      <div className="admin-card admin-section-card">
        <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Setup notes</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "grid", gap: 6 }}>
          <li>
            Create an app at developer.intuit.com (Accounting scope) for Talent Edge LLC and set
            <span className="admin-cell-mono"> QBO_CLIENT_ID</span>,
            <span className="admin-cell-mono"> QBO_CLIENT_SECRET</span>,
            <span className="admin-cell-mono"> QBO_REDIRECT_URI</span> (= this site's /api/qbo/callback) and
            <span className="admin-cell-mono"> QBO_ENV</span> (sandbox first, then production).
            {qboConfigured() ? " Env vars are set." : " Env vars are currently missing."}
          </li>
          <li>
            Create a service item named &ldquo;Contractor Services&rdquo; in QuickBooks and set its id as
            <span className="admin-cell-mono"> QBO_SERVICE_ITEM_ID</span> — invoices line against it.
          </li>
          <li>
            Set <span className="admin-cell-mono">ACCOUNTING_EMAIL</span> — every automatic invoice (and every
            failure) is reported there.
          </li>
          <li>
            Map each client company to its QuickBooks customer (Revenue → Companies → QuickBooks mapping);
            unmapped companies degrade to manual invoicing.
          </li>
        </ul>
      </div>
    </>
  );
}
