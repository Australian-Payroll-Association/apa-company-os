-- Affiliate Program <-> CRM link (2026-07-17)
--
-- Model change: commission rate is a REDEMPTION CHOICE, not a code property.
-- A commission accrues as gross referral revenue; the affiliate later chooses
-- how to take it — 20% as work credit, or 10% as cash. So affiliate_commissions
-- records gross at accrual and the realized rate/amount only once chosen.
--
-- Also: consolidate to one active code per person (Tracy + David Nilssen each
-- had two), dedupe the duplicate David Nilssen person, add Brad Giles, book
-- James Murray's referral credit on the two paid AustPayroll invoices, and
-- pre-authorize (allowlist) every affiliate for the client portal WITHOUT
-- sending an invite (auth users are minted later by an admin action).
--
-- The data backfill below is guarded (WHERE EXISTS / NOT EXISTS / ON CONFLICT)
-- so it is safe to re-run and no-ops on a fresh database that lacks these rows.

-- 1. Schema: redemption choice on commissions -------------------------------
-- rate + commission_cents become the REALIZED values, null until a choice is
-- made (a pending commission knows only its gross).
alter table company_os.affiliate_commissions
  alter column rate drop not null,
  alter column commission_cents drop not null;

alter table company_os.affiliate_commissions
  add column if not exists redemption_choice text
    check (redemption_choice in ('work_credit', 'cash')),
  add column if not exists chosen_at timestamptz;

comment on column company_os.affiliate_commissions.redemption_choice is
  'How the affiliate takes this commission: work_credit (20%) or cash (10%). Null = pending choice.';
comment on column company_os.affiliate_commissions.rate is
  'Realized rate once redeemed (0.20 work credit / 0.10 cash). Null while pending.';
comment on column company_os.affiliate_commissions.commission_cents is
  'Realized commission = round(gross_cents * rate). Null while pending.';

-- Existing backfilled commission (WORKHEALTHY, April) was a 20% work credit.
update company_os.affiliate_commissions
   set redemption_choice = 'work_credit', chosen_at = created_at
 where redemption_choice is null and rate = 0.20;

-- 2. One active code per person ---------------------------------------------
-- Keep TRACY (drop TRACY20) and DAVIDNILSSEN (drop D65N38). Deactivate, never
-- delete — history and any commissions on the code are preserved.
update company_os.affiliates
   set active = false,
       notes = trim(both ' ' from coalesce(notes, '') ||
         ' [2026-07-17: deactivated — consolidated to one code per person]'),
       updated_at = now()
 where code in ('TRACY20', 'D65N38');

-- 3. Dedupe the duplicate David Nilssen person ------------------------------
-- dave.nilssen@doxatalent.com is a duplicate of david.nilssen@doxatalent.com
-- and is referenced only by the now-deactivated D65N38 code. Archive it.
update company_os.people
   set archived_at = now(), updated_at = now()
 where id = '7a32722d-42f8-42ab-aca0-ca320285c896'
   and archived_at is null;

-- 4. Add Brad Giles as an affiliate -----------------------------------------
-- rate stays 0.20 only to satisfy the legacy NOT-NULL default; redemption is
-- what actually decides 20/10, per commission.
insert into company_os.affiliates (code, person_id, program_type, rate, active, notes)
select 'BRADGILES', '84211c12-625d-4140-bd15-f97e62a947b9', 'commission', 0.20, true,
       'Referral partner. Has referred deals via deals.referrer_id.'
where exists (select 1 from company_os.people where id = '84211c12-625d-4140-bd15-f97e62a947b9')
on conflict (code) do nothing;

-- 5. James Murray referral credit on paid AustPayroll invoices --------------
-- James referred Tracy (AustPayroll). Book 20% work credit on the two paid
-- invoices #1250 ($4,000) and #1238 ($8,100) = $2,420. Guarded by source_ref
-- so a re-run does not duplicate.
insert into company_os.affiliate_commissions
  (affiliate_id, order_id, source_event, source_ref, gross_cents, rate, commission_cents, redemption_choice, chosen_at, notes)
select a.id, null, 'invoice_paid', i.doc_number, i.amount_cents, 0.20,
       round(i.amount_cents * 0.20)::bigint, 'work_credit', now(),
       'Referral credit: AustPayroll invoice #' || i.doc_number ||
       ' (Tracy Angwin referred by James Murray). Work credit @ 20%. Currency USD.'
  from company_os.affiliates a
  join company_os.invoices i on i.doc_number in ('1250', '1238') and i.status = 'paid'
 where a.code = 'WORKHEALTHY'
   and not exists (
     select 1 from company_os.affiliate_commissions ac
      where ac.affiliate_id = a.id and ac.source_event = 'invoice_paid' and ac.source_ref = i.doc_number
   );

-- 6. Pre-authorize affiliates for the client portal (INVITE HELD) -----------
-- An allowlist row grants nothing until an auth user is minted (admin action),
-- so this is inert until an invite is sent. Client affiliates get a
-- company-scoped membership; the rest are company-less (Referrals only).
-- Dave (admin) is excluded — admins use /admin, not the portal.
insert into company_os.portal_members (person_id, company_id, role, invited_by)
select v.person_id, v.company_id, v.role, 'migration:affiliate-program'
  from (values
    ('2d819515-3a7d-4342-8ec9-14f2fe84cc8b'::uuid, '8bdd0566-ed10-4c12-82c9-90fd8591b891'::uuid, 'member'),   -- Nilssen / Doxa Talent
    ('02307968-6df4-4fe0-92cb-7a3ce85ffd70'::uuid, '1787dc4b-a9f5-409d-a81b-e2cfdf75f95d'::uuid, 'member'),   -- Murray / Work Healthy Australia
    ('e3b19510-bccc-434e-9204-4946d0f8e8d6'::uuid, '1750a8ca-93ea-4369-aca1-c55553a49073'::uuid, 'member'),   -- Tracy / AustPayroll
    ('fbac955f-824b-4b87-920e-4c37cc62f3de'::uuid, null, 'affiliate'),                                        -- Brooks Holtom
    ('fa92a545-bd0c-4340-a975-331db2c484bb'::uuid, null, 'affiliate'),                                        -- Dru
    ('07d33458-c918-449f-b5b9-b1996b3a25ab'::uuid, null, 'affiliate'),                                        -- Eric Enriquez
    ('0fac4c7a-7554-4a71-b008-b20db54f32de'::uuid, null, 'affiliate'),                                        -- TK Nguyen
    ('84211c12-625d-4140-bd15-f97e62a947b9'::uuid, null, 'affiliate')                                         -- Brad Giles
  ) as v(person_id, company_id, role)
 where exists (select 1 from company_os.people p where p.id = v.person_id and p.archived_at is null)
   and not exists (
     select 1 from company_os.portal_members pm
      where pm.person_id = v.person_id
        and pm.company_id is not distinct from v.company_id
   );
