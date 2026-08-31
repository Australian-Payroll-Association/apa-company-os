// Signed, server-trusted "My Retreat" access grant.
//
// Entering a private retreat's access code (events.metadata.access_code) mints
// this HMAC-signed cookie, which authorizes VIEWING that retreat's guest hub
// (/my-retreat/<slug>). It is NOT a login and confers no identity or protected
// data access — it only unlocks marketing content and carries the guest's email
// + resolved person_id so the survey links attribute without re-asking.
//
// Ported from the infinite-leverage access-grant (src/lib/access-grant.ts).
// Uses Web Crypto (crypto.subtle) so it runs in Node route handlers and, if ever
// needed, the edge runtime. Server-only (imports the service-role client).
//
// Design: docs/plans/2026-07-31-my-retreat-design.md

import { companyOs } from "@/lib/supabase";

export const MY_RETREAT_COOKIE = "edge8_my_retreat";

// Prefer a dedicated secret; fall back to the server-only Supabase secret so a
// missing MY_RETREAT_COOKIE_SECRET never breaks a deploy. Both are server-only.
function secret(): string {
  const s = process.env.MY_RETREAT_COOKIE_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!s) throw new Error("MY_RETREAT_COOKIE_SECRET (or SUPABASE_SECRET_KEY) must be set");
  return s;
}

const DEFAULT_TTL_SECONDS = 120 * 24 * 60 * 60; // 120 days

export interface AccessGrant {
  eventSlug: string;
  exp: number; // epoch seconds
  email?: string;
  personId?: string;
  name?: string;
}

const enc = new TextEncoder();

function bytesToB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function strToB64url(str: string): string {
  return bytesToB64url(enc.encode(str));
}
function b64urlToStr(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmac(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return bytesToB64url(new Uint8Array(sig));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function signAccessGrant(
  eventSlug: string,
  identity?: { email?: string | null; personId?: string | null; name?: string | null },
): Promise<{ token: string; maxAgeSeconds: number }> {
  const exp = Math.floor(Date.now() / 1000) + DEFAULT_TTL_SECONDS;
  const grant: AccessGrant = { eventSlug, exp };
  if (identity?.email) grant.email = identity.email;
  if (identity?.personId) grant.personId = identity.personId;
  if (identity?.name) grant.name = identity.name;
  const body = strToB64url(JSON.stringify(grant));
  return { token: `${body}.${await hmac(body)}`, maxAgeSeconds: DEFAULT_TTL_SECONDS };
}

// Verify signature + expiry. Returns the grant or null.
export async function verifyAccessGrant(token: string | undefined | null): Promise<AccessGrant | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, await hmac(body))) return null;

  let payload: AccessGrant;
  try {
    payload = JSON.parse(b64urlToStr(body)) as AccessGrant;
  } catch {
    return null;
  }
  if (!payload || typeof payload.eventSlug !== "string" || typeof payload.exp !== "number") return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function accessCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    // Secure only in production — a `secure` cookie is dropped over http://localhost.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export interface ResolvedRetreat {
  eventId: string;
  slug: string;
  title: string;
}

// Resolve a typed access code to its retreat via events.metadata.access_code.
// Exact match (codes are case-sensitive), non-archived only. Server-only.
export async function resolveAccessCode(rawCode: string): Promise<ResolvedRetreat | null> {
  const code = (rawCode || "").trim();
  if (!code) return null;
  const { data, error } = await companyOs
    .from("events")
    .select("id, slug, title")
    .eq("metadata->>access_code", code)
    .is("archived_at", null)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const e = data[0] as { id: string; slug: string; title: string };
  return { eventId: e.id, slug: e.slug, title: e.title };
}
