-- 20260811130000_portal_member_roles.sql
--
-- Portal member roles become real (plan:
-- docs/plans/2026-08-11-client-portal-improvements.md, PR 2).
--
--   admin       full power: invoices, user management, roadmap priorities,
--               request decisions, document upload + delete-own
--   contributor propose roadmap items + upload documents; no reordering,
--               no priorities, no invoices, no user management
--   viewer      read-only everywhere
--   affiliate   unchanged: person-level (no company) referral tier
--
-- Existing client rows were provisioned as 'member' before roles existed; they
-- were all primary contacts, so they become full admins.

update company_os.portal_members set role = 'admin' where role = 'member';

-- New memberships default to full admin until an explicit role is passed (the
-- pre-roles invite flow inserts without a role; 'member' is no longer valid).
alter table company_os.portal_members alter column role set default 'admin';

alter table company_os.portal_members
  drop constraint if exists portal_members_role_check;
alter table company_os.portal_members
  add constraint portal_members_role_check
  check (role in ('admin', 'contributor', 'viewer', 'affiliate'));

comment on column company_os.portal_members.role is
  'admin | contributor | viewer (company members) or affiliate (person-level referral tier). Enforced in lib/portal/roles.ts.';
