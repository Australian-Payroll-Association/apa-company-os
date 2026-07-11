-- Team portal PR 4 (My Profile): employee-editable emergency contact.
-- Additive only; company_os.people is shared with the CRM.
-- Applied to the live DB 2026-07-11 via Supabase MCP apply_migration.
alter table company_os.people
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;
