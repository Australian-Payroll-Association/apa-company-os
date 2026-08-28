-- Rename marketing_calendar -> marketing_content (a row is a piece of content,
-- not a calendar slot), add body_html (the authored email/content HTML that
-- references images by URL), and backfill the single-pointer image_url into the
-- existing image library (marketing_asset_images) so every content piece with an
-- image also has a selected library row.
--
-- Applied to prod via Supabase MCP (staged, zero-downtime): the rename hides
-- behind a passthrough compat view named marketing_calendar so already-deployed
-- code keeps working until this branch's code (which reads marketing_content)
-- ships. Phase 2 (drop the view) runs after that deploy — see the bottom.
--
-- NOTE: the image library table marketing_asset_images is deliberately left
-- named as-is (lib/admin/marketing-images.ts + the campaign asset detail depend
-- on it, keyed by entry_id). No columns are dropped: image_url is the selected-
-- image mirror the board reads, not dead weight.

-- 1. Rename the content table.
alter table company_os.marketing_calendar rename to marketing_content;

-- 2. Rename indexes + check constraints off the old table name (cosmetic).
alter index company_os.marketing_calendar_pkey rename to marketing_content_pkey;
alter index company_os.marketing_calendar_publish_idx rename to marketing_content_publish_idx;
alter index company_os.marketing_calendar_brand_idx rename to marketing_content_brand_idx;
alter index company_os.marketing_calendar_status_idx rename to marketing_content_status_idx;
alter index company_os.marketing_calendar_pillar_idx rename to marketing_content_pillar_idx;
alter index company_os.marketing_calendar_broadcast_idx rename to marketing_content_broadcast_idx;
alter index company_os.marketing_calendar_campaign_idx rename to marketing_content_campaign_idx;
alter index company_os.marketing_calendar_blog_slug_key rename to marketing_content_blog_slug_key;
alter table company_os.marketing_content rename constraint marketing_calendar_channel_check to marketing_content_channel_check;
alter table company_os.marketing_content rename constraint marketing_calendar_status_check to marketing_content_status_check;

-- 3. Compatibility view: deployed code still reads/writes "marketing_calendar"
--    until the new code ships. Auto-updatable (plain select *). Dropped in Phase 2.
create view company_os.marketing_calendar as select * from company_os.marketing_content;
grant select, insert, update, delete on company_os.marketing_calendar to service_role;

-- 4. Store the authored email/content HTML (references library images by URL).
alter table company_os.marketing_content add column if not exists body_html text;

-- 5. Backfill: single-pointer image_url -> a selected image-library row, only for
--    content that has no library row yet (keeps the image_url mirror invariant).
insert into company_os.marketing_asset_images (entry_id, url, is_selected, created_by, created_at)
select c.id, c.image_url, true, 'backfill', now()
from company_os.marketing_content c
where c.image_url is not null
  and not exists (select 1 from company_os.marketing_asset_images i where i.entry_id = c.id);

-- ── Phase 2 (run AFTER this branch's code deploys; not part of this migration) ──
-- drop view company_os.marketing_calendar;
