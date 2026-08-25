-- OKR + Metrics restructure, Phase 1 (drop half).
-- Apply ONLY after the app deploy that stops selecting business_line
-- (same PR as 20260825170000) is live, or prod objectives queries 500.
alter table company_os.objectives drop column if exists business_line;
