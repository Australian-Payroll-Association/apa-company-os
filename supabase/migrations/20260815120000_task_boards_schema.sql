-- Task boards schema (company_os). Additive only; applied out-of-band via Supabase MCP.
-- tasks/projects never existed live (the dbml designed them at 0 rows); tasks is created
-- fresh here around what boards need, reusing the dbml's subject_type/subject_id link slot.
-- Grant convention: service_role S/I/U (no DELETE; soft-delete via archived_at), except
-- board_members which gets DELETE (membership removal is a hard delete on a join table).
-- chatbot_reader/chatbot_writer auto-inherit S/I/U via schema default privileges.

create table if not exists company_os.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  client_company_id uuid references company_os.companies(id),
  owner_id uuid references company_os.people(id),
  status text not null default 'active',
  sort_order int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  archived_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists boards_client_idx on company_os.boards(client_company_id);

create table if not exists company_os.board_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references company_os.boards(id) on delete cascade,
  name text not null,
  position int not null default 0,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists board_columns_board_idx on company_os.board_columns(board_id);

create table if not exists company_os.board_members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references company_os.boards(id) on delete cascade,
  person_id uuid not null references company_os.people(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (board_id, person_id)
);
create index if not exists board_members_board_idx on company_os.board_members(board_id);
create index if not exists board_members_person_idx on company_os.board_members(person_id);

create table if not exists company_os.sprints (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references company_os.boards(id) on delete cascade,
  name text not null,
  goal text,
  starts_on date,
  ends_on date,
  status text not null default 'active',
  closed_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sprints_board_idx on company_os.sprints(board_id);

create table if not exists company_os.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  board_id uuid references company_os.boards(id) on delete cascade,
  board_column_id uuid references company_os.board_columns(id),
  sprint_id uuid references company_os.sprints(id),
  position double precision not null default 0,
  assignee_id uuid references company_os.people(id),
  created_by uuid references company_os.people(id),
  status text not null default 'open',
  priority text not null default 'p3',
  due_date date,
  completed_at timestamptz,
  internal boolean not null default false,
  subject_type text,
  subject_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  archived_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_board_idx on company_os.tasks(board_id);
create index if not exists tasks_column_idx on company_os.tasks(board_column_id);
create index if not exists tasks_assignee_idx on company_os.tasks(assignee_id);
create index if not exists tasks_sprint_idx on company_os.tasks(sprint_id);
create index if not exists tasks_subject_idx on company_os.tasks(subject_type, subject_id);

create table if not exists company_os.task_stage_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references company_os.tasks(id) on delete cascade,
  from_column_id uuid references company_os.board_columns(id),
  to_column_id uuid references company_os.board_columns(id),
  from_sprint_id uuid references company_os.sprints(id),
  to_sprint_id uuid references company_os.sprints(id),
  kind text not null default 'move',
  moved_by uuid references company_os.people(id),
  note text,
  moved_at timestamptz not null default now()
);
create index if not exists task_stage_log_task_idx on company_os.task_stage_log(task_id);

drop trigger if exists set_boards_updated_at on company_os.boards;
create trigger set_boards_updated_at before update on company_os.boards
  for each row execute function company_os.handle_updated_at();
drop trigger if exists set_board_columns_updated_at on company_os.board_columns;
create trigger set_board_columns_updated_at before update on company_os.board_columns
  for each row execute function company_os.handle_updated_at();
drop trigger if exists set_sprints_updated_at on company_os.sprints;
create trigger set_sprints_updated_at before update on company_os.sprints
  for each row execute function company_os.handle_updated_at();
drop trigger if exists set_tasks_updated_at on company_os.tasks;
create trigger set_tasks_updated_at before update on company_os.tasks
  for each row execute function company_os.handle_updated_at();

alter table company_os.boards enable row level security;
alter table company_os.board_columns enable row level security;
alter table company_os.board_members enable row level security;
alter table company_os.sprints enable row level security;
alter table company_os.tasks enable row level security;
alter table company_os.task_stage_log enable row level security;

grant select, insert, update on company_os.boards to service_role;
grant select, insert, update on company_os.board_columns to service_role;
grant select, insert, update, delete on company_os.board_members to service_role;
grant select, insert, update on company_os.sprints to service_role;
grant select, insert, update on company_os.tasks to service_role;
grant select, insert on company_os.task_stage_log to service_role;

grant select on company_os.boards, company_os.board_columns, company_os.board_members,
  company_os.sprints, company_os.tasks, company_os.task_stage_log to supabase_read_only_user;
