-- Hardening the send path against three ways it could mail somebody twice, and
-- two ways the stats could silently lie. Found in review before any real send.
--
-- 1. CONCURRENT TICKS. The sender selected pending rows and only marked them
--    after the send returned. Vercel starts a new invocation on schedule
--    regardless of whether the previous one finished, so two ticks could select
--    the same rows and mail them both. Fixed with an atomic claim: a row moves
--    to 'claimed' in the same statement that selects it, so a second tick sees
--    nothing to take.
--
-- 2. MID-BATCH TEARDOWN. If the function is killed between Resend accepting and
--    the row being marked 'sent', the row stayed 'pending' and the next tick
--    re-sent it. Claimed rows now carry claimed_at; a claim older than the
--    reclaim window goes back to pending exactly once, and rows whose send
--    already succeeded are already 'sent' so they are never revisited.
--
-- 3. WEBHOOK RETRIES WITHOUT A TIMESTAMP. Dedupe keyed on
--    (resend_email_id, event_type, occurred_at), but occurred_at fell back to
--    now() when the payload carried no timestamp, so retries of such an event
--    each got a fresh key and double-counted. svix_id is stable across retries
--    of the same event and is the proper idempotency key.
--
-- 4 & 5. Aggregates were computed by fetching every row and counting in JS,
--    which PostgREST silently truncates at its row cap. One 185-person campaign
--    produces roughly five events per email, so two campaigns would have taken
--    the deliverability card past the cap and started understating bounces with
--    no error shown. The two functions below aggregate in SQL instead.
-- Applied via Supabase MCP.

alter table company_os.email_campaign_recipients
  add column if not exists claimed_at timestamptz;

alter table company_os.email_campaign_recipients
  drop constraint if exists email_campaign_recipients_status_check;
alter table company_os.email_campaign_recipients
  add constraint email_campaign_recipients_status_check
  check (status in ('pending', 'claimed', 'sent', 'skipped', 'failed'));

alter table company_os.email_events
  add column if not exists svix_id text;

-- Partial unique: rows predating this column (and any event delivered without a
-- svix id) keep relying on the composite index below.
create unique index if not exists email_events_svix_idx
  on company_os.email_events (svix_id)
  where svix_id is not null;

-- Atomically claim the next batch. Everything happens in one statement, so two
-- concurrent callers cannot take the same row.
create or replace function company_os.claim_campaign_batch(
  p_campaign_id uuid,
  p_limit integer,
  p_reclaim_after interval default interval '30 minutes'
)
returns table (id uuid, person_id uuid, email text)
language plpgsql
security definer
set search_path = company_os, public, extensions
as $$
begin
  -- A claim older than the window belongs to an invocation that died. Its send
  -- either never happened (safe to retry) or completed and already flipped the
  -- row to 'sent', which this does not match.
  update company_os.email_campaign_recipients r
  set status = 'pending', claimed_at = null
  where r.campaign_id = p_campaign_id
    and r.status = 'claimed'
    and r.claimed_at < now() - p_reclaim_after;

  return query
  update company_os.email_campaign_recipients r
  set status = 'claimed', claimed_at = now()
  where r.id in (
    select r2.id
    from company_os.email_campaign_recipients r2
    where r2.campaign_id = p_campaign_id
      and r2.status = 'pending'
    order by r2.created_at, r2.id
    limit p_limit
    for update skip locked
  )
  returning r.id, r.person_id, r.email;
end;
$$;

-- Delivery aggregates in SQL. Counts DISTINCT emails, not event rows: one email
-- fires 'opened' every time it is reopened, which would push the rate past 100%.
create or replace function company_os.email_delivery_stats(
  p_since timestamptz default null,
  p_campaign_id uuid default null
)
returns table (event_type text, unique_emails bigint)
language sql
stable
security definer
set search_path = company_os, public, extensions
as $$
  select e.event_type, count(distinct e.resend_email_id) as unique_emails
  from company_os.email_events e
  where (p_since is null or e.occurred_at >= p_since)
    and (p_campaign_id is null or e.campaign_id = p_campaign_id)
  group by e.event_type;
$$;

-- Recipient status counts for one campaign, aggregated in SQL for the same reason.
create or replace function company_os.campaign_recipient_stats(p_campaign_id uuid)
returns table (status text, n bigint)
language sql
stable
security definer
set search_path = company_os, public, extensions
as $$
  select r.status, count(*) as n
  from company_os.email_campaign_recipients r
  where r.campaign_id = p_campaign_id
  group by r.status;
$$;

revoke all on function company_os.claim_campaign_batch(uuid, integer, interval) from public;
revoke all on function company_os.email_delivery_stats(timestamptz, uuid) from public;
revoke all on function company_os.campaign_recipient_stats(uuid) from public;

grant execute on function company_os.claim_campaign_batch(uuid, integer, interval) to service_role;
grant execute on function company_os.email_delivery_stats(timestamptz, uuid) to service_role;
grant execute on function company_os.campaign_recipient_stats(uuid) to service_role;
