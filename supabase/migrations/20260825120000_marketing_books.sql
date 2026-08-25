-- Books: the long-form manuscripts (nonfiction field guides and the fable)
-- imported from the aio-website working repo. The rendered single-file HTML
-- readers live in public/books/; the chapters here are the markdown source of
-- truth the content pipeline (blog posts, social, future EPUB/KDP export)
-- draws from. Brand-scoped like the rest of the marketing section.
-- Applied via Supabase MCP.

create table if not exists company_os.books (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references company_os.brands(id),
  slug text not null unique,
  title text not null,
  subtitle text,
  format text not null default 'nonfiction'
    check (format in ('nonfiction', 'fable')),
  audience text,          -- who the edition is written for
  description text,       -- one-paragraph pitch, shown on the admin card
  reader_path text,       -- self-contained HTML reader under public/ (e.g. /books/slug.html)
  status text not null default 'draft'
    check (status in ('draft', 'published_web', 'published_amazon')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists company_os.book_chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references company_os.books(id) on delete cascade,
  sort_order int not null,
  part text,              -- part/section the chapter sits in, when the book has parts
  title text not null,
  body_md text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, sort_order)
);

drop trigger if exists set_books_updated_at on company_os.books;
create trigger set_books_updated_at before update on company_os.books
  for each row execute function company_os.handle_updated_at();

drop trigger if exists set_book_chapters_updated_at on company_os.book_chapters;
create trigger set_book_chapters_updated_at before update on company_os.book_chapters
  for each row execute function company_os.handle_updated_at();

alter table company_os.books enable row level security;
alter table company_os.book_chapters enable row level security;

grant select, insert, update, delete on company_os.books to service_role;
grant select, insert, update, delete on company_os.book_chapters to service_role;
grant select on company_os.books to supabase_read_only_user;
grant select on company_os.book_chapters to supabase_read_only_user;
