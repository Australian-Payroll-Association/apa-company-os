-- Comments on board cards. Append-only for v1 (add + view; no edit/delete grant).
-- author_label is the actor's display name (team) or email (admin), stored so a
-- comment always shows an author even when the actor has no people row.
-- Applied via Supabase MCP.
create table if not exists company_os.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references company_os.tasks(id) on delete cascade,
  author_person_id uuid references company_os.people(id),
  author_label text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists task_comments_task_idx on company_os.task_comments(task_id);

alter table company_os.task_comments enable row level security;
grant select, insert on company_os.task_comments to service_role;
grant select on company_os.task_comments to supabase_read_only_user;
