-- 20260718140000_gallery_no_size_limit.sql
-- Photos now upload straight from the browser to storage (signed upload URLs),
-- so there's no serverless-function body limit in the way. Drop the bucket's
-- 10 MB cap so full-resolution photos go through. Mime allowlist stays.
update storage.buckets set file_size_limit = null where id = 'gallery';
