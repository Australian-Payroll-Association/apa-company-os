import { NextResponse } from "next/server";
import { companyOs } from "@/lib/supabase";
import {
  resolveAccessCode,
  signAccessGrant,
  accessCookieOptions,
  MY_RETREAT_COOKIE,
} from "@/lib/my-retreat/access";

// POST { code }                                  → validate the retreat code (no cookie yet).
// POST { code, registration: { email } }         → returning: match a client by email + unlock.
// POST { code, registration: { email, name } }   → first-time: unlock with the given name.
// Identity is email-only for known clients ("continue as a Client"); unknown
// emails fall back to name capture. This soft cookie unlocks marketing content
// only — never protected data.

interface RegistrationInput {
  email?: string;
  name?: string;
}
interface RequestBody {
  code?: string;
  registration?: RegistrationInput;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const retreat = await resolveAccessCode(body.code ?? "");
  if (!retreat) {
    return NextResponse.json({ ok: false, error: "That access code isn't recognized." }, { status: 401 });
  }

  // Step 1: code valid — ask who they are before unlocking.
  if (!body.registration) {
    return NextResponse.json({ ok: true, retreat: { title: retreat.title } });
  }

  // Step 2: unlock.
  const email = (body.registration.email || "").trim().toLowerCase();
  const name = (body.registration.name || "").trim();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  }

  // Match an existing client by email ("continue as a Client").
  const { data: people, error } = await companyOs
    .from("people")
    .select("id, full_name")
    .ilike("email", email)
    .limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: "Couldn't verify that email right now." }, { status: 500 });
  }
  const person = (people ?? [])[0] as { id: string; full_name: string | null } | undefined;

  let personId: string | undefined;
  let grantName: string | undefined;
  if (person) {
    personId = person.id;
    grantName = person.full_name ?? undefined;
  } else {
    // Unknown email → first-time: require a name.
    if (!name) {
      return NextResponse.json(
        { ok: false, error: "We don't have that email on file — add your name to continue.", needName: true },
        { status: 404 },
      );
    }
    grantName = name;
  }

  const { token, maxAgeSeconds } = await signAccessGrant(retreat.slug, { email, personId, name: grantName });
  const res = NextResponse.json({ ok: true, redirect: `/my-retreat/${retreat.slug}` });
  res.cookies.set(MY_RETREAT_COOKIE, token, accessCookieOptions(maxAgeSeconds));
  return res;
}
