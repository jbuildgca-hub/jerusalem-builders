-- ═══════════════════════════════════════════════════════════════
-- VISION PRO — Database Schema
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Profiles ───────────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null,
  company_name text,
  phone       text,
  avatar_url  text,
  created_at  timestamptz default now()
);
alter table profiles enable row level security;
create policy "users_own_profile" on profiles
  for all using (auth.uid() = id);

-- ─── Projects ───────────────────────────────────────────────────
create table if not exists projects (
  id             uuid primary key default uuid_generate_v4(),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  user_id        uuid not null references profiles(id) on delete cascade,
  name           text not null,
  address        text not null default '',
  client_name    text not null default '',
  client_email   text,
  client_phone   text,
  area_sqm       numeric not null default 0,
  work_type      text not null default 'שיפוץ פנים',
  contract_value numeric not null default 0,
  actual_cost    numeric not null default 0,
  progress_pct   integer not null default 0 check (progress_pct between 0 and 100),
  status         text not null default 'active'
                   check (status in ('active','delayed','on_hold','completed','bid')),
  start_date     date not null default current_date,
  end_date       date not null default (current_date + interval '6 months'),
  notes          text
);
alter table projects enable row level security;
create policy "users_own_projects" on projects
  for all using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

-- ─── Invoices ───────────────────────────────────────────────────
create table if not exists invoices (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  user_id         uuid not null references profiles(id) on delete cascade,
  project_id      uuid references projects(id) on delete set null,
  supplier_name   text not null default '',
  invoice_number  text not null default '',
  invoice_date    date not null default current_date,
  description     text not null default '',
  subtotal        numeric not null default 0,
  tax             numeric not null default 0,
  total           numeric not null default 0,
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected')),
  image_url       text,
  ai_extracted    boolean not null default false
);
alter table invoices enable row level security;
create policy "users_own_invoices" on invoices
  for all using (auth.uid() = user_id);

-- ─── Workers ────────────────────────────────────────────────────
create table if not exists workers (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz default now(),
  user_id             uuid not null references profiles(id) on delete cascade,
  name                text not null,
  role                text not null default '',
  hourly_rate         numeric not null default 0,
  phone               text,
  status              text not null default 'off_site'
                        check (status in ('on_site','off_site','unavailable')),
  current_project_id  uuid references projects(id) on delete set null,
  hours_this_month    numeric not null default 0
);
alter table workers enable row level security;
create policy "users_own_workers" on workers
  for all using (auth.uid() = user_id);

-- ─── Worker Time Logs ────────────────────────────────────────────
create table if not exists worker_time_logs (
  id          uuid primary key default uuid_generate_v4(),
  worker_id   uuid not null references workers(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  date        date not null default current_date,
  hours       numeric not null default 0,
  notes       text
);
alter table worker_time_logs enable row level security;
create policy "users_own_timelogs" on worker_time_logs
  for all using (
    exists (select 1 from workers w where w.id = worker_id and w.user_id = auth.uid())
  );

-- ─── Alerts ─────────────────────────────────────────────────────
create table if not exists alerts (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz default now(),
  user_id     uuid not null references profiles(id) on delete cascade,
  project_id  uuid references projects(id) on delete cascade,
  type        text not null check (type in ('budget_overrun','delay','invoice_pending','worker','material')),
  severity    text not null default 'info' check (severity in ('critical','warning','info')),
  title       text not null,
  message     text not null default '',
  is_read     boolean not null default false
);
alter table alerts enable row level security;
create policy "users_own_alerts" on alerts
  for all using (auth.uid() = user_id);

-- ─── Quotes ─────────────────────────────────────────────────────
create table if not exists quotes (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz default now(),
  user_id       uuid not null references profiles(id) on delete cascade,
  client_name   text not null default '',
  project_name  text not null default '',
  area_sqm      numeric not null default 0,
  work_type     text not null default '',
  description   text not null default '',
  amount        numeric not null default 0,
  valid_days    integer not null default 30,
  status        text not null default 'draft'
                  check (status in ('draft','sent','accepted','rejected','expired')),
  sent_at       timestamptz
);
alter table quotes enable row level security;
create policy "users_own_quotes" on quotes
  for all using (auth.uid() = user_id);

-- ─── Storage Buckets ────────────────────────────────────────────
-- Run these in Supabase Dashboard → Storage
-- 1. Create bucket: "invoice-images" (public)
-- 2. Create bucket: "plan-files" (public)
-- Or via SQL:
insert into storage.buckets (id, name, public)
  values ('invoice-images', 'invoice-images', true)
  on conflict do nothing;
insert into storage.buckets (id, name, public)
  values ('plan-files', 'plan-files', true)
  on conflict do nothing;

create policy "users_upload_invoices" on storage.objects
  for insert with check (bucket_id = 'invoice-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "public_read_invoices" on storage.objects
  for select using (bucket_id = 'invoice-images');

create policy "users_upload_plans" on storage.objects
  for insert with check (bucket_id = 'plan-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "public_read_plans" on storage.objects
  for select using (bucket_id = 'plan-files');

-- ─── Realtime ───────────────────────────────────────────────────
-- Enable realtime on key tables (Dashboard → Database → Replication)
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table invoices;
alter publication supabase_realtime add table alerts;
