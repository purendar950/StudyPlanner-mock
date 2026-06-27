-- ════════════════════════════════════════════════════════════════════════
--  StudyPlanner Mock — SCHEMA v2 (Testbook-style structure)
--  Adds: exam_categories → exams → folders (nested, any depth) → tests.
--  Run AFTER schema.sql. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════
create extension if not exists "pgcrypto";

-- Admin allow-list + helper (idempotent; in case Step A wasn't run)
create table if not exists public.admins (
  email text primary key,
  created_at timestamptz default now()
);
alter table public.admins enable row level security;
drop policy if exists "admins_self_read" on public.admins;
create policy "admins_self_read" on public.admins
  for select to authenticated using (email = (auth.jwt() ->> 'email'));

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.email = (auth.jwt() ->> 'email'));
$$;

-- ── 1. Exam categories (SSC, Railway, State…) ──────────────────────────────
create table if not exists public.exam_categories (
  id              text primary key,           -- slug e.g. 'ssc'
  name            text not null,
  subtitle        text,
  icon_url        text,
  order_index     integer default 0,
  is_coming_soon  boolean default false,
  is_published    boolean default true,
  created_at      timestamptz default now()
);

-- ── 2. Exams (SSC CGL, CHSL, Subject-wise…) ────────────────────────────────
create table if not exists public.exams (
  id            text primary key,             -- slug e.g. 'cgl'
  category_id   text references public.exam_categories(id) on delete cascade,
  name          text not null,
  subtitle      text,
  icon_url      text,
  order_index   integer default 0,
  is_published  boolean default true,
  created_at    timestamptz default now()
);
create index if not exists idx_exams_category on public.exams(category_id);

-- ── 3. Folders — nested tabs of ANY depth (PYQ Mock → Tier I → 2025 → …) ────
create table if not exists public.folders (
  id           uuid primary key default gen_random_uuid(),
  exam_id      text not null references public.exams(id) on delete cascade,
  parent_id    uuid references public.folders(id) on delete cascade,
  name         text not null,
  order_index  integer default 0,
  created_at   timestamptz default now()
);
create index if not exists idx_folders_exam on public.folders(exam_id);
create index if not exists idx_folders_parent on public.folders(parent_id);

-- ── 4. Extend mock_tests to live inside the tree ───────────────────────────
alter table public.mock_tests add column if not exists exam_id   text references public.exams(id) on delete set null;
alter table public.mock_tests add column if not exists folder_id uuid references public.folders(id) on delete set null;
alter table public.mock_tests add column if not exists is_free   boolean default true;
alter table public.mock_tests add column if not exists language  text default 'English, Hindi';
create index if not exists idx_mock_tests_exam   on public.mock_tests(exam_id);
create index if not exists idx_mock_tests_folder on public.mock_tests(folder_id);

-- ════════════════════════════════════════════════════════════════════════
--  RLS — public can read published structure; only admins can write.
-- ════════════════════════════════════════════════════════════════════════
alter table public.exam_categories enable row level security;
alter table public.exams           enable row level security;
alter table public.folders         enable row level security;

-- exam_categories
drop policy if exists "cat_public_read" on public.exam_categories;
drop policy if exists "cat_admin_all"   on public.exam_categories;
create policy "cat_public_read" on public.exam_categories
  for select using (is_published = true);
create policy "cat_admin_all" on public.exam_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- exams
drop policy if exists "exam_public_read" on public.exams;
drop policy if exists "exam_admin_all"   on public.exams;
create policy "exam_public_read" on public.exams
  for select using (is_published = true);
create policy "exam_admin_all" on public.exams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- folders (structure is readable by everyone; only admins write)
drop policy if exists "folder_public_read" on public.folders;
drop policy if exists "folder_admin_all"   on public.folders;
create policy "folder_public_read" on public.folders
  for select using (true);
create policy "folder_admin_all" on public.folders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
