-- Rename company_os.compensation -> company_os.compensation_sensitive.
--
-- The table holds real pay data and is already treated as sensitive (RLS on,
-- service-role only, revoked from the chatbot roles, gated in-app by
-- canViewSensitive). This brings its NAME in line with the *_sensitive
-- convention (people_sensitive, candidate_sensitive).
--
-- DEPLOY COUPLING: the admin app queries this table at runtime (lib/admin/*,
-- app/admin/.../contractors) and the NL->SQL assistants block it by name.
-- Apply this rename together with the code that references compensation_sensitive
-- (including the updated assistant block-lists in lib/admin-chat/db.ts and
-- lib/team-chat/db.ts), or admin pages error and the block-lists stop matching
-- in the gap.
alter table if exists company_os.compensation rename to compensation_sensitive;

-- Keep the check-constraint names aligned with the table (cosmetic; no code
-- references them by name).
alter table company_os.compensation_sensitive
  rename constraint compensation_comp_type_check to compensation_sensitive_comp_type_check;
alter table company_os.compensation_sensitive
  rename constraint compensation_pay_period_check to compensation_sensitive_pay_period_check;
