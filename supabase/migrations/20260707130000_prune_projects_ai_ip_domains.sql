-- Prune unused subsystems from company_os: Projects & Delivery, AI Platform,
-- and IP & Knowledge (minus documents, which stores candidate resumes).
-- All 18 tables were empty (0 rows), had no dependent views, and no code paths.
-- These tables were created ad-hoc (no CREATE migration in git); their structural
-- snapshot is preserved in docs/db/parked-schema-2026-07-07-projects-ai-ip.sql.

begin;

-- Remove the 3 inbound FK columns on kept tables that point into the drop set
-- (all on empty tables; nothing referenced them).
alter table company_os.meeting_action_items drop column if exists task_id;
alter table company_os.content_items drop column if exists prompt_version_id;
alter table company_os.content_ideas drop column if exists source_research_note_id;

-- Drop the 18 approved tables. CASCADE resolves only intra-set FK ordering.
drop table if exists
  company_os.epic_items,
  company_os.epics,
  company_os.tasks,
  company_os.milestones,
  company_os.project_members,
  company_os.projects,
  company_os.prompt_versions,
  company_os.prompts,
  company_os.agents_registry,
  company_os.experiments,
  company_os.tools,
  company_os.app_members,
  company_os.app_environments,
  company_os.apps,
  company_os.ip_asset_usages,
  company_os.ip_asset_versions,
  company_os.research_notes,
  company_os.ip_assets
  cascade;

commit;
