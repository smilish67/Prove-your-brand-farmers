-- PYBF v1 initial schema
-- 5 tables: user_profile, style_preset, channel_credentials, draft, publication
-- Single-user app with RLS limiting access to auth.uid() = user_id.

-- Helper: updated_at trigger
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===== user_profile =====
create table public.user_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  context_text text not null default '',
  default_style_id uuid,
  updated_at timestamptz not null default now()
);

create trigger user_profile_updated_at
  before update on public.user_profile
  for each row execute function set_updated_at();

alter table public.user_profile enable row level security;
create policy user_profile_owner on public.user_profile
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ===== style_preset =====
create table public.style_preset (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  prompt text not null,
  source text not null check (source in ('manual', 'analyzed')),
  created_at timestamptz not null default now()
);

create index style_preset_user_idx on public.style_preset (user_id);

alter table public.style_preset enable row level security;
create policy style_preset_owner on public.style_preset
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- user_profile.default_style_id FK now that table exists
alter table public.user_profile
  add constraint user_profile_default_style_fk
  foreign key (default_style_id) references public.style_preset(id) on delete set null;

-- ===== channel_credentials =====
create table public.channel_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('meta', 'band')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  account_ids jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create trigger channel_credentials_updated_at
  before update on public.channel_credentials
  for each row execute function set_updated_at();

alter table public.channel_credentials enable row level security;
create policy channel_credentials_owner on public.channel_credentials
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ===== draft =====
create table public.draft (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  media jsonb not null default '[]'::jsonb,
  user_text text not null default '',
  style_id uuid references public.style_preset(id) on delete set null,
  style_freestyle text,
  generations jsonb,
  status text not null default 'generated'
    check (status in ('generated', 'failed_generation', 'media_cleaned')),
  media_cleaned_at timestamptz
);

create index draft_user_created_idx on public.draft (user_id, created_at desc);

alter table public.draft enable row level security;
create policy draft_owner on public.draft
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ===== publication =====
create table public.publication (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.draft(id) on delete cascade,
  channel text not null check (channel in ('instagram', 'facebook', 'threads', 'band')),
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed', 'auth_expired')),
  post_url text,
  error_message text,
  attempted_at timestamptz not null default now()
);

create index publication_draft_idx on public.publication (draft_id);

alter table public.publication enable row level security;
create policy publication_owner on public.publication
  using (exists (
    select 1 from public.draft
    where draft.id = publication.draft_id and draft.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.draft
    where draft.id = publication.draft_id and draft.user_id = auth.uid()
  ));
