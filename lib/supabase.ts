import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client connected to the shared ai-officer database
// (also used by caiocoach.com, ai-officer.com, davehajdu.com).
// Uses the secret key, which bypasses RLS. NEVER import from a client component.

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.warn(
    "Supabase env vars not configured (SUPABASE_URL / SUPABASE_SECRET_KEY). Database features will not work."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseSecretKey || "placeholder-key",
  {
    auth: { persistSession: false },
  }
);

// Query builder scoped to the `company_os` schema — the canonical Company OS
// (people, inquiries, candidates, applications, documents, bookings, orders).
// Site forms write here via the service-role key (bypasses RLS). Storage stays
// on the base `supabase` client (buckets are schema-independent).
export const companyOs = supabase.schema("company_os");

export const htt = supabase.schema("htt");
