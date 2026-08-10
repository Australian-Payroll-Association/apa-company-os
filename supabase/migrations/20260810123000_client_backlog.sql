-- 20260810123000_client_backlog.sql
-- Client-scoped AI Program / automation backlog. One row per backlog item,
-- keyed to a client company. Edge8 authors items and proposes a priority
-- (edge8_priority); the client re-prioritises (client_priority) and can propose
-- their own items (source='client', status='proposed') for Edge8 to accept.
-- Surfaced in admin (Operations > Client Backlog) and in the client portal.
--
-- Company_os convention: RLS on, no policies, reached only via the service-role
-- client. Without the explicit grant the app cannot see the table at all.

create table if not exists company_os.client_backlog_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company_os.companies(id) on delete cascade,
  group_key text not null
    check (group_key in ('foundation','reports','assist','automation','north')),
  ref text,                                  -- 'F1','R1'… for Edge8-seeded items; null for client-proposed
  title text not null,
  who text,
  today_state text,
  build_desc text,
  needs text[] not null default '{}',
  token_low int,
  token_high int,
  edge8_priority text not null default 'later'
    check (edge8_priority in ('now','next','later','park')),
  client_priority text
    check (client_priority is null or client_priority in ('now','next','later','park')),
  client_note text,
  source text not null default 'edge8' check (source in ('edge8','client')),
  status text not null default 'accepted'
    check (status in ('proposed','accepted','active','shipped','parked')),
  sort_order int not null default 0,
  archived_at timestamptz,
  archived_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotent seed key: one Edge8 ref per company. Client-proposed items (ref null)
-- are exempt, so many can coexist.
create unique index if not exists client_backlog_items_company_ref_key
  on company_os.client_backlog_items (company_id, ref) where ref is not null;
create index if not exists client_backlog_items_company_idx
  on company_os.client_backlog_items (company_id);
create index if not exists client_backlog_items_company_group_idx
  on company_os.client_backlog_items (company_id, group_key, sort_order);

alter table company_os.client_backlog_items enable row level security;
grant select, insert, update, delete on company_os.client_backlog_items to service_role;
insert into company_os.client_backlog_items
  (company_id, group_key, ref, title, who, today_state, build_desc, needs, token_low, token_high, edge8_priority, source, status, sort_order)
values
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'foundation', 'F1', 'MYOB Acumatica sync (sales, stock on hand, orders, POs, products, employees)', 'Everyone', 'System of record. Every role''s audit shows manual exports, report refreshes and re-keying out of MYOB.', 'Daily read-only sync of the core entities into the central database, masked in transit. First task is an API research spike on the Acumatica contract-based REST API.', array['API research', 'MYOB read']::text[], 20, 40, 'now', 'edge8', 'accepted', 0),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'foundation', 'F2', 'Master data spine: employees, stores, brands, products, suppliers', 'Everyone', 'No single source of truth linking people, stores and products across systems.', 'The hierarchy layer of the database, per the scope call: master and relationship data first, salaried employees before casual staff.', array['MYOB read', 'Wageloch read']::text[], 10, 20, 'now', 'edge8', 'accepted', 10),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'foundation', 'F3', 'Wageloch sync (hours, rosters, labour cost)', 'Malin, Sean, Shannon', 'Labour data lives apart from revenue data, so labour-vs-revenue checks are manual.', 'Read-only sync of time and attendance data. Wageloch has no public API docs; access is on request, so this starts with a vendor conversation.', array['API research', 'Wageloch read']::text[], 8, 20, 'now', 'edge8', 'accepted', 20),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'foundation', 'F4', 'Shopify sync (orders, fulfilment status, catalog)', 'Erin, Jessie, Brenda', 'Orders are looked up separately in Shopify, then again in MYOB, for every return and dispatch check.', 'Read-only sync via Shopify''s well-documented API. Unlocks the cross-system order view.', array['Shopify read']::text[], 8, 16, 'next', 'edge8', 'accepted', 30),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'foundation', 'F5', 'REDO returns sync', 'Erin', 'Return requests live only in REDO; every return means a third lookup.', 'Read-only sync of return requests and statuses so a return, its order and its ERP record sit in one row.', array['API research', 'REDO read']::text[], 6, 14, 'next', 'edge8', 'accepted', 40),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'foundation', 'F6', 'Marketing platform pulls (Klaviyo, Google, Meta, Pinterest, TikTok, AfterPay)', 'Brenda, Megan', 'The weekly Gecko report is copy-pasted together from up to nine platforms.', 'Scheduled read-only pulls of the reporting metrics each platform exposes, landing in reporting tables.', array['Platform APIs']::text[], 12, 24, 'next', 'edge8', 'accepted', 50),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'foundation', 'F7', 'Metronome data ingest', 'Leadership', 'Metronome consumes numbers but has no public API.', 'Export-based ingest at best for now. Kept on the list so the constraint is visible; revisit if Metronomics opens an API.', array['No API available']::text[], 6, 16, 'park', 'edge8', 'accepted', 60),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'reports', 'R1', 'Monday weekly retail report', 'Sean', 'About 3 hours every Monday; roughly half auto-pulls over ODBC, the rest is manual Excel work.', 'Priority Workflow 1 from the scope call: the full report prepared automatically each Monday from ERP and labour data, with draft commentary.', array['F1', 'F3']::text[], 8, 16, 'now', 'edge8', 'accepted', 0),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'reports', 'R2', 'Metronome update pack', 'Leadership (about 10 people)', 'Around 10 people each spend an hour a week keying the Monday numbers into Metronome.', 'Priority Workflow 2: generate every Metronome value paste-ready from the Monday report data. True auto-entry is blocked by the missing API, so this cuts the hour to minutes rather than to zero.', array['R1']::text[], 6, 14, 'next', 'edge8', 'accepted', 10),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'reports', 'R3', 'Weekly retail KPI email to store managers', 'Malin', 'Collect Super Duper, Fast/Slow and Labour Cost reports, analyse, combine into one report, draft and send the email.', 'One generated weekly pack combining the three reports with drafted store-manager email ready for Malin''s review and send.', array['F1', 'F3']::text[], 8, 16, 'now', 'edge8', 'accepted', 20),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'reports', 'R4', 'Stock reporting stack: Fast/Slow, stock and sales, warehouse holding', 'Kim, stock team', 'About 4 hours a week across refreshing macros, updating parameters, pasting values, validating and distributing (SOP refs STK-REP-001 to 005).', 'Auto-prepared weekly stock reports with validation checks, week-on-week exception ranking and drafted commentary for the leadership meeting.', array['F1']::text[], 10, 20, 'now', 'edge8', 'accepted', 30),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'reports', 'R5', 'Gecko weekly marketing report', 'Brenda, Megan', 'Pull data from Shopify plus up to eight marketing platforms, paste into the Gecko sheet, interpret, share.', 'Auto-compiled weekly marketing report with drafted insights, from the platform pulls in F6.', array['F4', 'F6']::text[], 8, 18, 'next', 'edge8', 'accepted', 40),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'reports', 'R6', 'Labour cost vs revenue roster check', 'Malin', 'Review each store''s roster and compare planned labour cost to revenue by hand.', 'Per-store weekly view of planned labour vs revenue with flagged outliers and suggested adjustments to discuss with SMs.', array['F1', 'F3']::text[], 6, 12, 'next', 'edge8', 'accepted', 50),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'reports', 'R7', 'Stock Q&A assistant', 'Kim, stock team, stores', 'Ad hoc requests (check stock for a style, stock by size, brand performance) trigger manual pivot pulls and one-off analysis.', 'A chat assistant over the central database that answers stock and sales questions on demand, read-only.', array['F1']::text[], 6, 12, 'next', 'edge8', 'accepted', 60),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'reports', 'R8', 'Rolling stocktake results report', 'Shin Yi', 'Meant to run weekly; skipped since the MYOB migration because there is no time.', 'Auto-generated weekly stocktake results by store and brand, restoring a control that has quietly lapsed.', array['F1']::text[], 4, 10, 'later', 'edge8', 'accepted', 70),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'assist', 'S1', 'Product descriptions and fit notes', 'Brenda', 'Top two recurring activities in the Ecomm audit; written by hand per product.', 'A house-style writing assistant: product info in, on-brand description and fit note out, human QA before publish.', array['No sync needed']::text[], 2, 6, 'now', 'edge8', 'accepted', 0),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'assist', 'S2', 'PDP QA checklist agent', 'Brenda', 'Manual completeness checks before publishing product pages.', 'A checklist agent that reviews a draft PDP against the standard and lists what is missing.', array['No sync needed']::text[], 2, 6, 'next', 'edge8', 'accepted', 10),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'assist', 'S3', 'Social captions and campaign copy', 'Robynn, Megan', 'Captions, copy variations and post ideas written manually; flagged ''Easy / Very High'' in Bstore''s own opportunity table.', 'Campaign-aware copy assistant producing caption and copy options in brand voice for scheduling in Sked Social.', array['No sync needed']::text[], 2, 6, 'now', 'edge8', 'accepted', 20),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'assist', 'S4', 'Briefs: campaign, influencer, supplier', 'Robynn, Megan', 'Every campaign starts with hand-written briefs and asset requests.', 'Brief templates plus an assistant that drafts each brief from the campaign calendar entry.', array['No sync needed']::text[], 2, 6, 'now', 'edge8', 'accepted', 30),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'assist', 'S5', 'Recurring comms templates', 'Malin', 'Typing recurring emails from scratch; a named bottleneck in the Retail Manager audit.', 'A template library plus drafting assistant for the weekly KPI email, confirmations, approvals and follow-ups.', array['No sync needed']::text[], 2, 6, 'now', 'edge8', 'accepted', 40),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'assist', 'S6', 'Training SOPs and Axonify content', 'Malin', 'Building training docs, checklists, KLPs and quiz questions by hand before loading to Axonify.', 'An assistant that turns a rough process outline into an SOP, KLPs and quiz questions ready to load.', array['No sync needed']::text[], 2, 6, 'now', 'edge8', 'accepted', 50),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'assist', 'S7', 'Recruitment: ads, screening summaries, scorecards', 'Malin', 'Typing ads, chasing GM wording approval, filtering applicants by hand.', 'Drafted job ads in house style, applicant screening summaries against the Metronome scorecard, interview question packs.', array['No sync needed']::text[], 2, 8, 'next', 'edge8', 'accepted', 60),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'assist', 'S8', 'VM instructions and store comms', 'Malin', 'Typing up VM setup instructions per store/window/section and the emails that go with them (MMX).', 'Drafted VM instructions and store emails from the guideline plus the marketing calendar entry.', array['No sync needed']::text[], 2, 6, 'next', 'edge8', 'accepted', 70),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'assist', 'S9', 'Meeting notes to actions', 'Everyone', 'Manual recaps and follow-up chasing across departments.', 'Standard practice taught in certification: notes in, owners, actions and drafted follow-ups out.', array['No sync needed']::text[], 1, 4, 'now', 'edge8', 'accepted', 80),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'automation', 'A1', 'Returns command centre', 'Erin', 'Every return means the same order looked up in Shopify, REDO and MYOB, cross-checked, then statuses and financial adjustments keyed into each. Six of the audit''s top ten activities.', 'One screen per return showing all three systems, with the agent preparing status updates and MYOB adjustments for one-click human approval. The leading Step 2 candidate.', array['F1', 'F4', 'F5', 'MYOB write']::text[], 30, 60, 'next', 'edge8', 'accepted', 0),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'automation', 'A2', 'Dispatch order match and validation', 'Jessie', 'Matching Shopify and MYOB orders and checking products against the order is the top recurring dispatch task.', 'Pre-matched order pairs with mismatches flagged before picking starts; dispatch confirms instead of compares.', array['F1', 'F4']::text[], 20, 40, 'later', 'edge8', 'accepted', 10),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'automation', 'A3', 'Backorder and aged-order triage', 'Jessie', 'Working oldest orders one at a time across both systems, deciding reallocate, transfer, refund or wait.', 'A daily triage list with stock, age, value and location already assembled and a recommended action per order; human decides, agent executes the routine follow-through.', array['F1', 'F4', 'MYOB write']::text[], 16, 32, 'later', 'edge8', 'accepted', 20),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'automation', 'A4', 'New product creation into MYOB and Shopify', 'Shin Yi, Sarah', '20 to 30 minutes per item; seasonal entry runs to 10 hours, and ''a day'' per week in the WILO.', 'Supplier data in, validated product records created in MYOB and Shopify with barcodes and pricing checked.', array['MYOB write', 'Shopify write']::text[], 16, 32, 'later', 'edge8', 'accepted', 30),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'automation', 'A5', 'Price update automation', 'Shin Yi, Sarah, Maria', 'Price changes appear in every stock team member''s WILO, hours per week combined, ''depending how slow MYOB decides to be''.', 'A price change list approved once, applied everywhere by the agent, with a change log.', array['MYOB write']::text[], 12, 24, 'later', 'edge8', 'accepted', 40),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'automation', 'A6', 'MYOB weekly PO cleanup', 'Kim, stock team', 'A weekly rules-based cleanup routine (Steve Brown workflow 4).', 'The rules encoded and run automatically with an exception list for human review.', array['MYOB write']::text[], 8, 16, 'later', 'edge8', 'accepted', 50),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'automation', 'A7', 'New employee onboarding flow', 'Malin', 'Application form, then accounts created by hand in Axonify and Wageloch, welcome email, retail code, and lag between team, Malin and finance.', 'One intake form that triggers account creation, welcome email and a status tracker everyone can see. Depends on what Axonify and Wageloch expose.', array['API research', 'Axonify', 'Wageloch write']::text[], 16, 32, 'later', 'edge8', 'accepted', 60),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'automation', 'A8', 'Balance backs and replenishment assist', 'Sarah, Shin Yi, Maria', 'The single biggest time pool in the WILO: 4 to 6 hours per allocation day for FitFlop alone, plus daily runs across a dozen brands.', 'Research-heavy: encode the allocation logic, generate proposed balance backs for approval, then execute. High reward, approached carefully after the easier MYOB write-backs prove out.', array['F1', 'MYOB write']::text[], 40, 80, 'later', 'edge8', 'accepted', 70),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'automation', 'A9', 'Support ticket reply drafting with order context', 'Erin', 'Ticket queue handled reply by reply, choosing between macros and custom responses.', 'Drafted replies with the customer''s order and return status already looked up; Erin reviews and sends.', array['F4', 'F5']::text[], 12, 24, 'later', 'edge8', 'accepted', 80),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'automation', 'A10', 'Influencer send-out coordination', 'Robynn, Megan', 'Requesting shoes through MYOB, chasing dispatch details, sending tracking to influencers by hand.', 'A send-out tracker that raises the MYOB request, watches dispatch and drafts the tracking email.', array['MYOB write', 'F4']::text[], 12, 24, 'park', 'edge8', 'accepted', 90),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'north', 'N1', 'Bstore portal: role-based views with a database chatbot', 'Everyone', 'The north star from the scope call: Revenue / Talent / Operations / Innovation views over the owned database.', 'Built module by module on top of the central database once syncs and first reports are live.', array['F1-F6']::text[], 40, 80, 'later', 'edge8', 'accepted', 0),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'north', 'N2', 'In-house Metronome replacement', 'Leadership', 'Named in the scope call as a candidate to eventually build in-house.', 'Scorecards and KPI tracking inside the portal, fed live from the database instead of keyed weekly.', array['N1']::text[], 40, 80, 'park', 'edge8', 'accepted', 10),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'north', 'N3', 'Warehouse workflows - audit missing', 'Miles, Harsh', 'Miles and Harsh are on the certification list but no Step 1 audit exists for the warehouse.', 'Bstore action: run the same Step 1 audit for the warehouse team, then fold the findings into this backlog.', array['Bstore input']::text[], null, null, 'park', 'edge8', 'accepted', 20),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'north', 'N4', 'Finance workflows - audit missing', 'Shannon', 'No Step 1 audit exists for finance; ProSpend and payroll touchpoints appear only in other roles'' audits.', 'Bstore action: run the Step 1 audit for finance, then fold the findings into this backlog.', array['Bstore input']::text[], null, null, 'park', 'edge8', 'accepted', 30),
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'north', 'N5', 'Shopify POS cutover support', 'Leadership', '1Retail is the current store POS; Shopify POS is listed as the future one.', 'When the cutover is scheduled, the central database absorbs the reporting impact so store data keeps flowing.', array['Bstore decision']::text[], null, null, 'park', 'edge8', 'accepted', 40)
on conflict (company_id, ref) where ref is not null do update set
  group_key = excluded.group_key, title = excluded.title, who = excluded.who,
  today_state = excluded.today_state, build_desc = excluded.build_desc, needs = excluded.needs,
  token_low = excluded.token_low, token_high = excluded.token_high,
  edge8_priority = excluded.edge8_priority, sort_order = excluded.sort_order,
  updated_at = now();

