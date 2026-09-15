-- One narrow, deliberate exception to "anon: nothing, anywhere".
--
-- payroll_iq.seat_tiers is the PUBLISHED PRICE LIST. It feeds the public
-- marketing page, which is statically rendered and therefore cannot read
-- cookies() - so the app reads it with an anonymous, session-less client on
-- purpose (see the header of website/src/lib/billing/ladder.ts).
--
-- Migration 20260916070000 revoked anon from that policy while applying the
-- plan's blanket rule. The rule is right for everything else and wrong for this
-- one table, and the collision surfaced as a failed production build:
-- "Could not find the table 'public.seat_tiers'".
--
-- Scoped as tightly as it goes: USAGE on the schema, SELECT on exactly one
-- table. anon still cannot see a learner, an organisation or an attempt - the
-- post-condition proves it rather than asserting it.

grant usage on schema payroll_iq to anon;
grant select on payroll_iq.seat_tiers to anon;

drop policy if exists seat_tiers_select on payroll_iq.seat_tiers;
create policy seat_tiers_select on payroll_iq.seat_tiers
  for select to authenticated, anon using (true);

comment on table payroll_iq.seat_tiers is
  'The published seat-price ladder. The ONLY payroll_iq table anon may read, because it is the price list on the public marketing page. Every other table denies anon at the grant layer, before RLS is consulted.';

do $chk$
declare leaked text;
begin
  select string_agg(c.relname, ', ') into leaked
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'payroll_iq' and c.relkind = 'r'
     and c.relname <> 'seat_tiers'
     and has_table_privilege('anon', c.oid, 'SELECT');
  if leaked is not null then
    raise exception 'anon can read payroll_iq tables beyond seat_tiers: %', leaked;
  end if;

  if not has_table_privilege('anon','payroll_iq.seat_tiers','SELECT') then
    raise exception 'anon cannot read seat_tiers - the public pricing page will 500';
  end if;

  if has_schema_privilege('anon','company_os','USAGE') or has_schema_privilege('anon','htt','USAGE') then
    raise exception 'anon gained reach into another app schema';
  end if;
end $chk$;
