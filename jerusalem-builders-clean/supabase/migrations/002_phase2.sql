-- ═══════════════════════════════════════════════════════════════
-- VISION PRO — Migration 002: Quotes + Worker enhancements
-- הרץ אחרי migration 001
-- ═══════════════════════════════════════════════════════════════

-- ─── הצעות מחיר ────────────────────────────────────────────────
-- (טבלה זו כבר קיימת ב-001, אבל אם לא הרצת אותה:)
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

-- הסר policy קיים אם יש ואז צור חדש
drop policy if exists "users_own_quotes" on quotes;
create policy "users_own_quotes" on quotes
  for all using (auth.uid() = user_id);

-- ─── Worker time logs (אם לא הרצת migration 001) ────────────────
create table if not exists worker_time_logs (
  id          uuid primary key default uuid_generate_v4(),
  worker_id   uuid not null references workers(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  date        date not null default current_date,
  hours       numeric not null default 0,
  notes       text
);

alter table worker_time_logs enable row level security;

drop policy if exists "users_own_timelogs" on worker_time_logs;
create policy "users_own_timelogs" on worker_time_logs
  for all using (
    exists (select 1 from workers w where w.id = worker_id and w.user_id = auth.uid())
  );

-- ─── Realtime על הטבלאות החדשות ─────────────────────────────────
alter publication supabase_realtime add table quotes;
alter publication supabase_realtime add table workers;
alter publication supabase_realtime add table worker_time_logs;
