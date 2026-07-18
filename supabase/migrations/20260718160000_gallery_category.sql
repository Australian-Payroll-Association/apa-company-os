-- 20260718160000_gallery_category.sql
-- Tag each gallery photo with one of three categories (nullable = untagged).
alter table company_os.gallery_photos
  add column if not exists category text
  check (category is null or category in ('workshops', 'clients', 'team'));
