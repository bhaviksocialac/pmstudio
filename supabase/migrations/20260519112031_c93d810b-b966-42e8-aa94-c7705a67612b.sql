
-- Helper: updated_at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Enums
create type public.project_phase as enum ('Survey','Design','Procurement','Execution','Finishing','Handover');
create type public.project_health as enum ('on-track','attention','urgent');
create type public.project_type as enum ('residential','commercial');
create type public.invoice_status as enum ('draft','sent','paid','overdue');
create type public.payment_status as enum ('pending','approved','paid','held');
create type public.approval_status as enum ('pending','approved','rejected');
create type public.message_kind as enum ('client','vendor');

-- profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  email text,
  studio_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- vendors
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  category text,
  phone text,
  email text,
  rating int default 0,
  payment_terms text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  location text,
  phase public.project_phase not null default 'Survey',
  completion int not null default 0,
  spent numeric not null default 0,
  budget numeric not null default 0,
  health public.project_health not null default 'on-track',
  type public.project_type not null default 'residential',
  start_date date,
  expected_handover date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  assignee text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- photos
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid references public.projects(id) on delete cascade,
  room text,
  caption text,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- invoices
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid references public.projects(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  number text,
  milestone text,
  amount numeric not null default 0,
  sent_at date,
  due_at date,
  status public.invoice_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- approvals
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  status public.approval_status not null default 'pending',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  thread_with uuid,
  kind public.message_kind not null default 'client',
  body text not null,
  sent_at timestamptz not null default now(),
  from_me boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- payment_requests
create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  vendor_id uuid references public.vendors(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  scope text,
  amount numeric not null default 0,
  submitted_at timestamptz not null default now(),
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at triggers
do $$
declare t text;
begin
  for t in
    select unnest(array['profiles','clients','vendors','projects','tasks','photos','invoices','approvals','messages','payment_requests'])
  loop
    execute format(
      'create trigger trg_%I_updated before update on public.%I for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end$$;

-- Enable RLS + owner policies
do $$
declare t text;
begin
  for t in
    select unnest(array['profiles','clients','vendors','projects','tasks','photos','invoices','approvals','messages','payment_requests'])
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy "%s_select_own" on public.%I for select to authenticated using (auth.uid() = user_id);',
      t, t
    );
    execute format(
      'create policy "%s_insert_own" on public.%I for insert to authenticated with check (auth.uid() = user_id);',
      t, t
    );
    execute format(
      'create policy "%s_update_own" on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t, t
    );
    execute format(
      'create policy "%s_delete_own" on public.%I for delete to authenticated using (auth.uid() = user_id);',
      t, t
    );
  end loop;
end$$;

-- Indexes for common access patterns
create index idx_projects_user on public.projects(user_id);
create index idx_clients_user on public.clients(user_id);
create index idx_vendors_user on public.vendors(user_id);
create index idx_tasks_project on public.tasks(project_id);
create index idx_photos_project on public.photos(project_id);
create index idx_invoices_project on public.invoices(project_id);
create index idx_approvals_project on public.approvals(project_id);
create index idx_messages_user on public.messages(user_id);
create index idx_payment_requests_user on public.payment_requests(user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, email, studio_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    coalesce(new.raw_user_meta_data->>'studio_name', 'My Studio'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
