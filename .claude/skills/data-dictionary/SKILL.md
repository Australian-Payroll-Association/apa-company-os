---
name: data-dictionary
description: MUST be consulted before creating any database table, writing any migration containing CREATE TABLE, scaffolding a feature that stores data, or deciding where a piece of business data lives. Answers "does a table for this already exist?" and enforces the house schema conventions. Triggers - "create a table", "add a migration", "scaffold", "new feature", "where do we store X", "add a column", "save this data", any Supabase schema work in company_os or htt.
---

# Data dictionary lookup

The company database has ~200 tables and a documented history of accidental duplicates (`campaigns` next to `marketing_campaigns`, `goals` next to `objectives`). This skill exists so no table is ever created when an existing one already holds the entity at the same grain.

Canonical source: [docs/db/data-dictionary.md](../../../docs/db/data-dictionary.md). The index below is generated from it.

## Workflow

1. **Search the index below** for the business term and its synonyms (a "client" may be a company, a "user" may be a person, a "learner" is a person via platform_identities).
2. **Read the full entry** in docs/db/data-dictionary.md for anything that looks close. The entry's "Reuse" and "Do not" lines answer most questions.
3. **Check the live comments** when the entry is missing or ambiguous:
   ```sql
   select c.relname, obj_description(c.oid) from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('company_os','htt') and c.relkind = 'r'
     and (c.relname ilike '%TERM%' or obj_description(c.oid) ilike '%TERM%');
   ```
4. **Decide**: same entity at the same grain → extend the existing table. Different grain or genuinely new entity → new table is right.
5. **If creating a new table**, follow the decision rules at the top of docs/db/data-dictionary.md (spine FKs, money pattern, archived_at, `_sensitive` split, mirror pattern for external data), and ship in the same PR:
   - the dictionary entry (exact field format — the generator parses it),
   - `COMMENT ON` statements for the table and every column,
   - a regenerated index: `node scripts/data-dictionary/generate.mjs`.
   CI (`data-dictionary-gate`) fails the PR if the entry or comments are missing.
6. **Never write to graveyard tables.** The dictionary's Graveyard section lists superseded and dead tables with their replacements.

## Index

<!-- INDEX:START (generated - run scripts/data-dictionary/generate.mjs) -->
- company_os.people — one human the company has ever touched — staff, client contact, candidate who converted, event attendee, AIO participant once the bridge lands. (master · People & org structure; tier 1 spine; active)
- company_os.companies — one external organization in any relationship with us — prospect, client, learner org (post-bridge), partner. (master · Customers & partners; tier 1 spine; active)
- company_os.team_members — one employment relationship — a person in a seat at one of our legal entities; a person can appear more than once across time. (master · People & org structure; tier 1 spine; active)
- company_os.deals — one revenue opportunity with one company, moving through one pipeline's stages. (transactional · Revenue documents; tier 1 spine; active)
- htt.pull_requests — one pull request observed in a tracked client or internal repo — the raw evidence of engineering effort. (transactional · Effort & value measurement; tier 1 spine; active)
- htt.token_entries — one minted human-token record attributed to a person, repo, and client for a span of work. (transactional · Effort & value measurement; tier 1 spine; active)
- company_os.people_sensitive — one person's sensitive personal attributes, split from `people` so broad reads can never see them. (master · People & org structure; tier 3 support; active)
- company_os.candidate_sensitive — one candidate's sensitive attributes (salary expectation, recruiter-verified and AI-extracted), split from `candidate_profile` so broad ATS reads can never see them. (master · Candidates; tier 3 support; active)
- company_os.compensation_sensitive — one compensation arrangement for a team member, effective-dated with approver — real pay data. (master · People & org structure; tier 3 support; active)
- company_os.events — one event we run or speak at — workshop, retreat, talk night — with capacity, dates, and status. (master · Products & offerings; tier 2 stage engine; active)
- company_os.event_registrations — one person's registration for one event, from signup through attendance. (transactional · Revenue documents; tier 2 stage engine; active)
- company_os.marketing_content — one planned or published piece of marketing content (blog, email, social, broadcast) with channel, status, and authored body. (transactional · Marketing & content execution; tier 2 stage engine; active)
- company_os.affiliates — one affiliate partner who can be attributed on deals, orders, and subscriptions. (master · Customers & partners; tier 2 stage engine; active)
- company_os.lead — one inbound or sourced lead before qualification — the rawest stage of the funnel. (transactional · Pipeline activity; tier 2 stage engine; active)
- company_os.inquiries — one inbound inquiry from a public form or channel, with routing status. (transactional · Pipeline activity; tier 2 stage engine; active)
- company_os.interactions — one logged touch with a person or company — call, email, note, meeting reference. (transactional · Pipeline activity; tier 2 stage engine; active)
- company_os.pipelines — one sales pipeline definition (one exists today). (master · Reference & rules; tier 2 stage engine; active)
- company_os.pipeline_stages — one stage in one pipeline, ordered. (master · Reference & rules; tier 2 stage engine; active)
- company_os.tasks — one unit of internal work on a board, in a sprint, or standalone. (transactional · Client delivery & work; tier 2 stage engine; active)
- company_os.client_backlog_items — one client-visible backlog item on a client roadmap. (transactional · Client delivery & work; tier 2 stage engine; active)
- company_os.meetings — one meeting or meeting-note record — calendar meetings and folded-in notes distinguished by `source`. (transactional · Client delivery & work; tier 2 stage engine; active)
- company_os.sprints — one sprint window for the internal team. (other · Plans & designs; tier 2 stage engine; active)
- htt.man_hour_entries — one logged span of human hours with a rate, attributed to a person, repo, and client. (transactional · Effort & value measurement; tier 2 stage engine; active)
- htt.repos — one tracked repository, internal or client-owned. (master · Assets & code; tier 2 stage engine; active)
- htt.token_allocations — one allotment of tokens to a client engagement — the "allotted" side of burnt/allotted/unburnt. (other · System config & plumbing; tier 2 stage engine; active)
- htt.client_identities — one mapping from a tracker client to identifying handles (GitHub org, names) used by the sync. (master · Customers & partners; tier 2 stage engine; active)
- company_os.invoices — one invoice mirrored from QuickBooks — QuickBooks is the system of record; this row is for visibility and joins. (transactional · Revenue documents; tier 2 stage engine; active)
- company_os.orders — one Stripe checkout order for a product, with fees, tax, FX, and refunds captured. (transactional · Revenue documents; tier 2 stage engine; active)
- company_os.subscriptions — one Stripe subscription for a person and product. (transactional · Revenue documents; tier 2 stage engine; waiting)
- company_os.products — one sellable product or ticket tier, Stripe-linked, optionally tied to an event. (master · Products & offerings; tier 2 stage engine; active)
- company_os.service_lines — one service line the company sells, used to categorize deals and products. (master · Products & offerings; tier 2 stage engine; active)
- company_os.fx_rates — one currency's current rate to USD. (master · Reference & rules; tier 2 stage engine; active)
- company_os.positions — one job position definition in the org structure. (master · People & org structure; tier 3 support; active)
- company_os.departments — one department in the org structure. (master · People & org structure; tier 3 support; active)
- company_os.staff_assignments — one assignment of a team member to a client, project, or internal function for a period. (master · People & org structure; tier 3 support; active)
- company_os.person_qualifications — one durable qualification or certification held by a person. (master · People & org structure; tier 3 support; active)
- company_os.legal_entities — one of our legal entities (country, base currency, tax id). (master · People & org structure; tier 3 support; active)
- company_os.company_profile — one block of our own company profile content. (master · People & org structure; tier 3 support; active)
- company_os.core_values — one company core value. (master · People & org structure; tier 3 support; active)
- company_os.coaching_profiles — one team member's coaching profile — the standing context a coach needs. (master · People & org structure; tier 3 support; active)
- company_os.coaching_ocean_profiles — one person's OCEAN personality assessment result. (master · People & org structure; tier 3 support; active)
- company_os.person_companies — one person-to-company relationship (role, primary contact flags) — the join that makes contacts work. (master · Customers & partners; tier 3 support; active)
- company_os.candidates — one candidate in the recruiting funnel (person-like entity; becomes a `people` row on hire). (master · Candidates; tier 3 support; active)
- company_os.candidate_profile — one candidate's extended profile (resume-derived, broadly readable — nothing sensitive). (master · Candidates; tier 3 support; active)
- company_os.vendors — one vendor or supplier with contact, bank, and tax details. (master · Vendors; tier 3 support; active)
- company_os.ai_programs — one AI program engagement definition for a client. (master · Products & offerings; tier 3 support; active)
- company_os.talks — one talk in our speaking catalog. (master · Products & offerings; tier 3 support; active)
- company_os.brands — one brand we operate under. (master · Products & offerings; tier 3 support; active)
- company_os.brand_profiles — one brand's extended profile (voice, style, positioning) used by content tooling. (master · Products & offerings; tier 3 support; active)
- company_os.equipment — one physical asset we own (laptop, monitor, device). (master · Assets & code; tier 3 support; active)
- company_os.company_github_orgs — one GitHub organization mapped to a client company. (master · Assets & code; tier 3 support; active)
- company_os.person_git_emails — one git author email mapped to a person, for PR attribution. (master · Assets & code; tier 3 support; active)
- company_os.leave_policies — one leave policy (entitlement rules) applied to team members. (master · Reference & rules; tier 3 support; active)
- company_os.holidays — one public holiday relevant to leave calculation. (master · Reference & rules; tier 3 support; waiting)
- company_os.boards — one work board (kanban) definition. (master · Reference & rules; tier 3 support; active)
- company_os.board_columns — one column on one board, ordered. (master · Reference & rules; tier 3 support; active)
- company_os.board_members — one person's membership on one board. (master · Reference & rules; tier 3 support; active)
- company_os.surveys — one survey definition. (master · Reference & rules; tier 3 support; active)
- company_os.survey_fields — one question or field on one survey. (master · Reference & rules; tier 3 support; active)
- company_os.tags — one tag label (part of a generic tagging system that was never adopted). (master · Reference & rules; tier 3 support; hold)
- company_os.taggables — one tag-to-record attachment (polymorphic). (master · Reference & rules; tier 3 support; hold)
- company_os.requisition_loop_steps — one step in a requisition's interview loop plan. (master · Reference & rules; tier 3 support; hold)
- company_os.event_pnl_lines — one revenue or cost line on one event's P&L. (transactional · Revenue documents; tier 3 support; active)
- company_os.token_purchases — one purchase of human tokens by a client (the token economy's revenue record). (transactional · Revenue documents; tier 3 support; waiting)
- company_os.affiliate_commissions — one commission earned by an affiliate on an attributed sale. (transactional · Revenue documents; tier 3 support; active)
- company_os.affiliate_payouts — one payout of accumulated commissions to an affiliate. (transactional · Revenue documents; tier 3 support; waiting)
- company_os.call_transcripts — one call or meeting transcript, linked to its meeting or deal context. (transactional · Pipeline activity; tier 3 support; active)
- company_os.call_scorecards — one scored review of one call against the sales rubric. (transactional · Pipeline activity; tier 3 support; active)
- company_os.marketing_campaigns — one marketing campaign grouping content and email sends. (transactional · Marketing & content execution; tier 3 support; active)
- company_os.email_campaigns — one email campaign (broadcast) definition and send state. (transactional · Marketing & content execution; tier 3 support; active)
- company_os.email_campaign_recipients — one recipient of one email campaign send. (transactional · Marketing & content execution; tier 3 support; active)
- company_os.email_events — one email engagement event (delivery, open, click) from the send provider. (other · Logs, audit & telemetry; tier 3 support; active)
- company_os.marketing_asset_images — one image in the marketing image library, keyed to a content entry (`entry_id`). (transactional · Marketing & content execution; tier 3 support; active)
- company_os.marketing_pillars — one marketing pillar for categorizing content. (transactional · Marketing & content execution; tier 3 support; hold)
- company_os.task_comments — one comment on one task. (transactional · Client delivery & work; tier 3 support; active)
- company_os.issues — one tracked issue or bug in internal work. (transactional · Client delivery & work; tier 3 support; active)
- company_os.meeting_participants — one person's participation in one meeting. (transactional · Client delivery & work; tier 3 support; active)
- company_os.meeting_associations — one polymorphic link stating what a meeting is about — (meeting_id, entity_type, entity_id) to a deal, company, or project. (transactional · Client delivery & work; tier 3 support; active)
- company_os.meeting_action_items — one action item captured from a meeting. (transactional · Client delivery & work; tier 3 support; active)
- company_os.bookings — one external booking made against an availability block. (transactional · Client delivery & work; tier 3 support; active)
- company_os.expenses — one expense mirrored from QuickBooks — QuickBooks is the system of record. (transactional · Spend; tier 3 support; active)
- company_os.contractor_payments — one monthly payment decision for a contractor (hours, amount, status). (transactional · Spend; tier 3 support; waiting)
- company_os.contractor_work_requests — one request for contractor work with scope and rate. (transactional · Spend; tier 3 support; active)
- company_os.contractor_work_events — one event in a contractor work request's lifecycle. (transactional · Spend; tier 3 support; active)
- company_os.equipment_assignments — one assignment of one asset to one person for a period. (transactional · Spend; tier 3 support; active)
- company_os.equipment_requests — one request for equipment by a team member. (transactional · Spend; tier 3 support; active)
- company_os.time_off — one leave request with type, dates, and approval state. (transactional · People operations; tier 3 support; active)
- company_os.leave_adjustments — one manual adjustment to a person's leave balance. (transactional · People operations; tier 3 support; active)
- company_os.applications — one candidate's application to one requisition, through the funnel. (transactional · People operations; tier 3 support; active)
- company_os.application_stages — one stage instance in one application's funnel. (transactional · People operations; tier 3 support; active)
- company_os.job_requisitions — one open or closed hiring requisition. (transactional · People operations; tier 3 support; active)
- company_os.interviews — one scheduled interview for one application. (transactional · People operations; tier 3 support; active)
- company_os.interview_interviewers — one interviewer on one interview. (transactional · People operations; tier 3 support; active)
- company_os.interview_scorecards — one interviewer's scorecard for one interview. (transactional · People operations; tier 3 support; active)
- company_os.scorecard_scores — one dimension score on one scorecard. (transactional · People operations; tier 3 support; active)
- company_os.offers — one formal offer extended to a candidate. (transactional · People operations; tier 3 support; waiting)
- company_os.onboarding_plans — one onboarding plan for one new team member. (transactional · People operations; tier 3 support; active)
- company_os.onboarding_tasks — one task inside one onboarding plan. (transactional · People operations; tier 3 support; active)
- company_os.performance_reviews — one performance review record for one team member in one cycle. (transactional · People operations; tier 3 support; active)
- company_os.survey_responses — one person's response session to one survey. (transactional · People operations; tier 3 support; active)
- company_os.survey_answers — one answer to one field within one response. (transactional · People operations; tier 3 support; active)
- company_os.goals — one quarterly FAST goal for a team member, laddered to the Eight Edges tree, with member-authored measures. (transactional · People operations; tier 3 support; active)
- company_os.coaching_goal_comments — one comment on one FAST goal. (transactional · People operations; tier 3 support; active)
- company_os.coaching_checkins — one coaching check-in record. (transactional · People operations; tier 3 support; active)
- company_os.coaching_commitments — one commitment made in coaching, tracked to completion. (transactional · People operations; tier 3 support; active)
- company_os.coaching_context — one standing context note for one person's coaching. (transactional · People operations; tier 3 support; active)
- company_os.coaching_one_on_ones — one coaching one-on-one session record. (transactional · People operations; tier 3 support; active)
- company_os.coaching_priorities — one current priority for one person in coaching. (transactional · People operations; tier 3 support; active)
- company_os.coaching_talking_points — one talking point queued for one person's next one-on-one. (transactional · People operations; tier 3 support; active)
- company_os.strategies — one company strategy document record. (other · Plans & designs; tier 3 support; active)
- company_os.objectives — one company objective in the OKR tree. (other · Plans & designs; tier 3 support; active)
- company_os.key_results — one measurable key result under one objective. (other · Plans & designs; tier 3 support; active)
- company_os.client_roadmap_groups — one grouping on one client's roadmap. (other · Plans & designs; tier 3 support; active)
- company_os.client_roadmap_overview — one client roadmap's overview block. (other · Plans & designs; tier 3 support; active)
- company_os.program_plans — one AI program's plan document record. (other · Plans & designs; tier 3 support; active)
- htt.project_goals — one goal set for a tracked project in the token tracker. (other · Plans & designs; tier 3 support; active)
- company_os.event_agenda_blocks — one agenda block within one event's schedule. (other · Plans & designs; tier 3 support; active)
- company_os.event_agenda_staff — one staff assignment to one agenda block. (other · Plans & designs; tier 3 support; hold)
- company_os.event_talks — one link between an event and a talk on its program. (other · Plans & designs; tier 3 support; active)
- company_os.ideas — one captured idea in the R&D funnel. (other · Plans & designs; tier 3 support; active)
- company_os.documents — one stored document reference (file metadata, not the file itself). (other · Content & knowledge; tier 3 support; active)
- company_os.company_information — one general company reference fact (slug, title, category, body, tags) surfaced to the /team assistant. (other · Content & knowledge; tier 3 support; active)
- company_os.books — one book in the publishing effort. (other · Content & knowledge; tier 3 support; active)
- company_os.book_chapters — one chapter of one book. (other · Content & knowledge; tier 3 support; active)
- company_os.program_documents — one document attached to an AI program. (other · Content & knowledge; tier 3 support; active)
- company_os.gallery_photos — one photo in the company gallery. (other · Content & knowledge; tier 3 support; active)
- company_os.gallery_photo_people — one person tagged in one gallery photo. (other · Content & knowledge; tier 3 support; active)
- company_os.audit_log — one audited admin action (who did what to which record). (other · Logs, audit & telemetry; tier 3 support; active)
- company_os.portal_assume_sessions — one assume-identity session by an admin in the portal. (other · Logs, audit & telemetry; tier 3 support; active)
- company_os.application_stage_log — one logged stage transition of one application. (other · Logs, audit & telemetry; tier 3 support; active)
- company_os.task_stage_log — one logged stage move of one task. (other · Logs, audit & telemetry; tier 3 support; active)
- company_os.lifecycle_transitions — one logged lifecycle change of a person (candidate to hire, active to alumni). (other · Logs, audit & telemetry; tier 3 support; active)
- company_os.kr_logs — one progress log entry on one key result. (other · Logs, audit & telemetry; tier 3 support; active)
- htt.sync_runs — one run of the nightly GitHub sync with its outcome. (other · Logs, audit & telemetry; tier 3 support; active)
- company_os.sync_packets — one integration sync packet record. (other · Logs, audit & telemetry; tier 3 support; active)
- company_os.assistant_conversations — one conversation session with an in-app AI assistant. (other · Logs, audit & telemetry; tier 3 support; active)
- company_os.dayoff_snapshot — one snapshotted leave-balance state for one person on one date — derived, rebuildable. (other · Logs, audit & telemetry; tier 3 support; active)
- company_os.coaching_trends — one derived trend summary over coaching data — rebuildable. (other · Logs, audit & telemetry; tier 3 support; active)
- company_os.idea_trend_reports — one derived trend report over ideas — rebuildable. (other · Logs, audit & telemetry; tier 3 support; active)
- htt.project_summaries — one generated summary of a tracked project — rebuildable. (other · Logs, audit & telemetry; tier 3 support; active)
- company_os.qbo_connection — one QuickBooks OAuth connection with live access and refresh tokens. (other · System config & plumbing; tier 3 support; active)
- company_os.integration_sources — one configured external integration source. (other · System config & plumbing; tier 3 support; active)
- company_os.admins — one admin user of the portal. (other · System config & plumbing; tier 3 support; active)
- company_os.portal_members — one person's membership and role in the portal. (other · System config & plumbing; tier 3 support; active)
- company_os.availability_blocks — one recurring availability window offered for external booking. (other · System config & plumbing; tier 3 support; active)
- company_os.platform_identities — one mapping between a person or company here and their identity on an external platform. (master · Customers & partners; tier 1 spine; dead)
<!-- INDEX:END -->

Tables not yet in the index exist but are undocumented — check live comments (step 3) and add an entry when you touch one.
