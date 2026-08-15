-- Subtasks: a task may be a child of another task (a checklist under a card).
-- Children carry parent_task_id and no column placement; they render inside the
-- parent card's drawer, not as their own board cards. Applied via Supabase MCP.
alter table company_os.tasks
  add column if not exists parent_task_id uuid references company_os.tasks(id) on delete cascade;
create index if not exists tasks_parent_idx on company_os.tasks(parent_task_id);
