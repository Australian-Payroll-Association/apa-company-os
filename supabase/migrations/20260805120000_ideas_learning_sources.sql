-- Ideas that Spark Solutions: let a "What have I learned?" submission cite
-- where it came from — zero or more source URLs (an article, a doc, a Slack
-- thread). Build ideas don't use this column; it's learning-specific.
-- Applied 2026-08-05.

alter table company_os.ideas add column source_urls text[];
