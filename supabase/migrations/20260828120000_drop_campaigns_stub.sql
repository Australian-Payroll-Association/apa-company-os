-- Drop the generic company_os.campaigns stub.
--
-- "Marketing Campaigns" in the app is backed by company_os.email_campaigns
-- (+ email_campaign_recipients). company_os.campaigns was a separate generic
-- name/channel/status/budget_cents record that never got wired to anything:
-- zero rows, zero code references. Removing it so there is one campaigns
-- concept, not two.
drop table if exists company_os.campaigns;
