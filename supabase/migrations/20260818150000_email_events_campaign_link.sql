-- email_events.campaign_id is filled two ways and both were blocked by the
-- original grant, which was select+insert only:
--
-- 1. The webhook resolves the campaign at insert time by looking the Resend
--    email id up in email_campaign_recipients.
-- 2. The send cron backfills any event that arrived before its recipient row
--    had been stamped with the Resend id (the 'sent' webhook can beat the
--    sender's own UPDATE by milliseconds).
--
-- Path 2 needs UPDATE, which service_role did not have, so campaign results
-- would have silently stayed empty.
--
-- Now that campaign_id is a real reference, give it the FK it always implied.
-- Applied via Supabase MCP.

grant update on company_os.email_events to service_role;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'email_events_campaign_fk'
  ) then
    alter table company_os.email_events
      add constraint email_events_campaign_fk
      foreign key (campaign_id) references company_os.email_campaigns(id) on delete set null;
  end if;
end $$;
