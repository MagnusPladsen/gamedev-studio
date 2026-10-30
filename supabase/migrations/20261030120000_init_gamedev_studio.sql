-- GameDev Studio — Supabase schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: everything uses "if not exists" / "or replace".
--
-- Data model: one row per project, one row per asset. Asset bodies are stored as JSON
-- (sprites keep their frames as small PNG data URLs), so new asset types need no migration.
-- Row Level Security makes every row visible only to the user who owns it.

create table if not exists public.projects (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  name       text        not null default '',
  data       jsonb       not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.assets (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  project_id text        not null,
  collection text        not null check (collection in (
               'sprites', 'sounds', 'music', 'diagrams', 'stories',
               'tilemaps', 'dialogues', 'palettes', 'spritesheets', 'links')),
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, project_id) references public.projects (user_id, id) on delete cascade
);

create index if not exists assets_project_idx on public.assets (user_id, project_id, collection);

alter table public.projects enable row level security;
alter table public.assets   enable row level security;

drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own assets" on public.assets;
create policy "own assets" on public.assets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Keep anonymous (not signed in) visitors out entirely.
revoke all on public.projects from anon;
revoke all on public.assets   from anon;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.assets   to authenticated;

-- Stop a single row from growing without bound (roughly 5 MB of JSON per asset).
create or replace function public.check_asset_size() returns trigger
language plpgsql set search_path = '' as $$
begin
  if pg_column_size(new.data) > 5 * 1024 * 1024 then
    raise exception 'Asset % is too large (max 5 MB)', new.id;
  end if;
  return new;
end $$;

drop trigger if exists assets_size_limit on public.assets;
create trigger assets_size_limit before insert or update on public.assets
  for each row execute function public.check_asset_size();
