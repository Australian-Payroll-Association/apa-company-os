import { companyOs } from "@/lib/supabase";

// Server-only QuickBooks Online client. NEVER import from a client component.
//
// One connection (Talent Edge LLC), stored in the single-row
// company_os.qbo_connection table. OAuth quirks that shape this module:
//  - access tokens last ~60 min; refresh tokens ROTATE on every refresh and
//    die ~100 days after issue. An unpersisted rotation bricks the
//    connection, so the refresh write is a conditional update keyed on the
//    refresh token we used — if another lambda rotated first, we re-read and
//    use its tokens instead of clobbering them.
//  - business calls never throw: they return {ok:false} and the caller
//    degrades (billing → manual_required + accountant email).
//
// Env: QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI,
// QBO_ENV ('sandbox' | 'production'), QBO_SERVICE_ITEM_ID (the "Contractor
// Services" service item invoices line against — one-time QBO setup).
// Plan: docs/plans/2026-07-18-client-work-requests.md

const QBO_ENV = process.env.QBO_ENV === "sandbox" ? "sandbox" : "production";
const API_BASE =
  QBO_ENV === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const MINOR_VERSION = "75";

type ConnectionRow = {
  id: string;
  realm_id: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string;
  environment: string;
  connected_by: string;
  updated_at: string;
};

export type QboConnectionStatus =
  | { connected: false }
  | {
      connected: true;
      realmId: string;
      environment: string;
      connectedBy: string;
      refreshTokenExpiresAt: string;
      updatedAt: string;
    };

function basicAuth(): string {
  return Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString("base64");
}

export function qboConfigured(): boolean {
  return Boolean(process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET && process.env.QBO_REDIRECT_URI);
}

async function loadConnection(): Promise<ConnectionRow | null> {
  const { data, error } = await companyOs
    .from("qbo_connection")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (error) {
    console.error("[qbo] connection load failed:", error.message);
    return null;
  }
  return (data as ConnectionRow | null) ?? null;
}

export async function getQboConnectionStatus(): Promise<QboConnectionStatus> {
  const conn = await loadConnection();
  if (!conn) return { connected: false };
  return {
    connected: true,
    realmId: conn.realm_id,
    environment: conn.environment,
    connectedBy: conn.connected_by,
    refreshTokenExpiresAt: conn.refresh_token_expires_at,
    updatedAt: conn.updated_at,
  };
}

export function buildQboAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.QBO_CLIENT_ID ?? "",
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: process.env.QBO_REDIRECT_URI ?? "",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  x_refresh_token_expires_in: number; // seconds
};

async function requestTokens(body: URLSearchParams): Promise<TokenResponse | { error: string }> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth()}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = (json.error as string) || `HTTP ${res.status}`;
      return { error: err };
    }
    return json as unknown as TokenResponse;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "network error" };
  }
}

function tokenRow(tokens: TokenResponse) {
  const now = Date.now();
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    access_token_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
    refresh_token_expires_at: new Date(now + tokens.x_refresh_token_expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Authorization-code exchange from the OAuth callback. Upserts the single row.
export async function exchangeQboCode(
  code: string,
  realmId: string,
  connectedBy: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tokens = await requestTokens(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.QBO_REDIRECT_URI ?? "",
    }),
  );
  if ("error" in tokens) return { ok: false, error: tokens.error };

  const { error } = await companyOs.from("qbo_connection").upsert({
    id: "default",
    realm_id: realmId,
    environment: QBO_ENV,
    connected_by: connectedBy,
    ...tokenRow(tokens),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Refresh-on-demand with rotation safety. Returns a usable access token +
// realm id, or null when disconnected/expired (callers degrade, never throw).
async function getAccessToken(): Promise<{ accessToken: string; realmId: string } | null> {
  const conn = await loadConnection();
  if (!conn) return null;

  // Fresh enough — use as-is (2 min headroom for the API call itself).
  if (new Date(conn.access_token_expires_at).getTime() - Date.now() > 2 * 60_000) {
    return { accessToken: conn.access_token, realmId: conn.realm_id };
  }

  const tokens = await requestTokens(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refresh_token }),
  );
  if ("error" in tokens) {
    // invalid_grant = the refresh token is dead (expired or superseded by a
    // rotation we lost) — a concurrent lambda may have refreshed first, so
    // re-read before giving up.
    const reread = await loadConnection();
    if (reread && reread.refresh_token !== conn.refresh_token) {
      return { accessToken: reread.access_token, realmId: reread.realm_id };
    }
    console.error("[qbo] token refresh failed:", tokens.error);
    return null;
  }

  // Persist the rotation, but only if nobody else rotated while we did: the
  // conditional update on the OLD refresh token is the serialization point
  // across concurrent lambdas.
  const { data: updated, error } = await companyOs
    .from("qbo_connection")
    .update(tokenRow(tokens))
    .eq("id", "default")
    .eq("refresh_token", conn.refresh_token)
    .select("id");
  if (error) console.error("[qbo] token persist failed:", error.message);
  if (!error && (updated ?? []).length === 0) {
    // Lost the race — use the winner's tokens.
    const winner = await loadConnection();
    if (winner) return { accessToken: winner.access_token, realmId: winner.realm_id };
  }
  return { accessToken: tokens.access_token, realmId: conn.realm_id };
}

// Exported for the weekly keepalive cron: refreshes tokens so the ~100-day
// refresh-token idle expiry never hits between invoices.
export async function refreshQboTokens(): Promise<{ ok: boolean; error?: string }> {
  const conn = await loadConnection();
  if (!conn) return { ok: false, error: "not connected" };
  const tokens = await requestTokens(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refresh_token }),
  );
  if ("error" in tokens) return { ok: false, error: tokens.error };
  const { error } = await companyOs
    .from("qbo_connection")
    .update(tokenRow(tokens))
    .eq("id", "default")
    .eq("refresh_token", conn.refresh_token);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function qboFetch(
  path: string,
  init: RequestInit,
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; error: string }> {
  const auth = await getAccessToken();
  if (!auth) return { ok: false, error: "QuickBooks is not connected (reconnect at /admin/settings/quickbooks)." };

  try {
    const url = `${API_BASE}/v3/company/${auth.realmId}${path}${path.includes("?") ? "&" : "?"}minorversion=${MINOR_VERSION}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const fault = JSON.stringify((json as { Fault?: unknown }).Fault ?? json).slice(0, 500);
      return { ok: false, error: `QBO ${res.status}: ${fault}` };
    }
    return { ok: true, json };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}

export type QboInvoice = {
  id: string;
  docNumber: string | null;
  txnDate: string;
  dueDate: string | null;
  totalCents: number;
  currency: string;
};

type QboInvoiceJson = {
  Id?: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  TotalAmt?: number;
  CurrencyRef?: { value?: string };
};

// One service line: hours × rate against the "Contractor Services" item.
export async function createQboInvoice(args: {
  customerId: string;
  hours: number;
  rateCents: number;
  description: string;
  memo?: string;
}): Promise<{ ok: true; invoice: QboInvoice } | { ok: false; error: string }> {
  const itemId = process.env.QBO_SERVICE_ITEM_ID;
  if (!itemId) return { ok: false, error: "QBO_SERVICE_ITEM_ID is not set." };

  const rate = args.rateCents / 100;
  const amount = Math.round(args.hours * args.rateCents) / 100;
  const body = {
    CustomerRef: { value: args.customerId },
    Line: [
      {
        DetailType: "SalesItemLineDetail",
        Amount: amount,
        Description: args.description,
        SalesItemLineDetail: {
          ItemRef: { value: itemId },
          Qty: args.hours,
          UnitPrice: rate,
        },
      },
    ],
    ...(args.memo ? { PrivateNote: args.memo } : {}),
  };

  const res = await qboFetch("/invoice", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) return res;

  const inv = (res.json.Invoice ?? {}) as QboInvoiceJson;
  if (!inv.Id) return { ok: false, error: "QBO returned no invoice id." };
  return {
    ok: true,
    invoice: {
      id: inv.Id,
      docNumber: inv.DocNumber ?? null,
      txnDate: inv.TxnDate ?? new Date().toISOString().slice(0, 10),
      dueDate: inv.DueDate ?? null,
      totalCents: Math.round((inv.TotalAmt ?? amount) * 100),
      currency: (inv.CurrencyRef?.value ?? "USD").toLowerCase(),
    },
  };
}

// QBO emails the invoice to the customer (their billing email on the QBO
// customer record, or an explicit override).
export async function sendQboInvoice(
  invoiceId: string,
  toEmail?: string,
): Promise<{ ok: boolean; error?: string }> {
  const path = toEmail
    ? `/invoice/${invoiceId}/send?sendTo=${encodeURIComponent(toEmail)}`
    : `/invoice/${invoiceId}/send`;
  const res = await qboFetch(path, { method: "POST" });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
