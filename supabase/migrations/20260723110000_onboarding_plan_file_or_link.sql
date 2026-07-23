-- Onboarding plan accepts a pasted link OR an uploaded file (markdown
-- preferred, rendered in-app). plan_path returns alongside plan_url; the app
-- keeps exactly one of the two set. Bucket gains markdown/plain-text MIME.
alter table company_os.onboarding_plans add column if not exists plan_path text;
update storage.buckets
set allowed_mime_types = array[
  'text/markdown','text/x-markdown','text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg','image/png','image/webp'
]
where id = 'onboarding-plans';
