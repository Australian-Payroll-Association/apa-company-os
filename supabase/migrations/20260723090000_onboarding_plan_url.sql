-- Onboarding plan becomes a pasted link (Google Doc / Lark doc), not a file
-- upload. plan_path never held data (0 rows at migration time), so it is
-- dropped cleanly; plan_uploaded_by / plan_uploaded_at keep recording who set
-- the link and when.
alter table company_os.onboarding_plans add column if not exists plan_url text;
alter table company_os.onboarding_plans drop column if exists plan_path;
