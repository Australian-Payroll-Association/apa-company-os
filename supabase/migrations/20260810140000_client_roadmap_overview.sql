-- 20260810140000_client_roadmap_overview.sql
-- Per-client roadmap overview: one client-facing intro blob shown at the top of
-- the roadmap (portal) and edited in admin (Edges > Client Roadmaps). One row per
-- client company. Body is light markdown rendered by the shared BotText renderer.
-- company_os convention: RLS on, no policies, service-role grant only.

create table if not exists company_os.client_roadmap_overview (
  company_id uuid primary key references company_os.companies(id) on delete cascade,
  body text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table company_os.client_roadmap_overview enable row level security;
grant select, insert, update, delete on company_os.client_roadmap_overview to service_role;

-- Seed: Bstore Pty Ltd roadmap overview (client-facing).
insert into company_os.client_roadmap_overview (company_id, body, updated_by)
values (
  '47ea790d-ec5f-4c6c-8352-6457456d0132',
  '**What this roadmap is**
This roadmap turns your team''s own work into a plan. Over the past few weeks your people mapped how they actually work, role by role: retail management, customer service, dispatch, ecommerce, marketing and the stock team. Every opportunity those audits surfaced is gathered here in one place, grouped and ranked, so we can decide together what to build first.

**What we found**
Two systems run the business: MYOB Acumatica for finance, stock and payroll, and Shopify for online sales. Around them sit the tools your team uses every day, from Wageloch and Axonify to Metronome, Klaviyo and REDO. Almost every time drain in the audits comes down to one of two things: people re-checking the same order or number across several systems by hand, or people building one weekly report out of many separate sources. Those two patterns repeat in nearly every role.

**How the plan works**
Step 1 is the foundation. We get your data flowing into one central database that you own, read-only and safely masked, so the numbers finally live in one place instead of scattered across tools. That single move is what makes the reports below possible. Step 2 is automation. Once the foundation is proving itself, we choose a short list of workflows to automate properly, together.

**Your part**
Set your own priority on any item with the Now, Next, Later and Park buttons, and propose anything we have missed. Two teams, Warehouse and Finance, have not completed a workflow audit yet; when they do, their opportunities join this list.',
  'seed'
)
on conflict (company_id) do update set body = excluded.body, updated_at = now();
