
create type public.email_kind as enum ('welcome', 'invoice', 'milestone', 'weekly_summary');
create type public.email_status as enum ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed');

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid references public.projects(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  kind public.email_kind not null,
  recipient_email text not null,
  recipient_name text,
  subject text,
  status public.email_status not null default 'queued',
  provider_id text,
  error text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_log_user_idx on public.email_log(user_id, created_at desc);
create index email_log_provider_idx on public.email_log(provider_id);
create index email_log_project_idx on public.email_log(project_id);

alter table public.email_log enable row level security;

create policy "Users can view their own email log"
  on public.email_log for select
  using (auth.uid() = user_id);

create trigger email_log_set_updated_at
  before update on public.email_log
  for each row execute function public.set_updated_at();
