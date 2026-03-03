-- ═══════════════════════════════════════════════════════════════
-- Jerusalem Builders — Migration 003: Roles & Client Portal
-- ═══════════════════════════════════════════════════════════════

-- ─── הוסף עמודת role לפרופילים ──────────────────────────────────
alter table profiles
  add column if not exists role text not null default 'field_worker'
    check (role in ('admin', 'project_manager', 'field_worker', 'client'));

-- הגדר את הראשון כ-admin
update profiles
  set role = 'admin'
  where id = (select id from profiles order by created_at limit 1);

-- ─── שיוך עובד ← משתמש ───────────────────────────────────────────
-- allows field workers to find their worker record
alter table profiles
  add column if not exists worker_id uuid references workers(id);

alter table profiles
  add column if not exists assigned_project_ids uuid[] default '{}';

-- ─── Client token לפרויקטים ─────────────────────────────────────
alter table projects
  add column if not exists client_token text unique;

alter table projects
  add column if not exists client_email text;

-- Generate tokens for existing projects
update projects
  set client_token = encode(gen_random_bytes(16), 'hex')
  where client_token is null;

-- ─── RLS עדכון — פרויקטים לפי תפקיד ─────────────────────────────
-- Project managers see only their assigned projects
drop policy if exists "users_own_projects" on projects;

create policy "admin_all_projects" on projects
  for all
  using (
    auth.uid() in (select id from profiles where role = 'admin' and id = auth.uid())
    or user_id = auth.uid()
  );

create policy "pm_own_projects" on projects
  for select
  using (
    auth.uid() in (
      select id from profiles
      where role = 'project_manager'
        and (assigned_project_ids @> array[projects.id] or user_id = auth.uid())
    )
  );

create policy "worker_assigned_project" on projects
  for select
  using (
    id in (
      select current_project_id from workers
      where user_id = auth.uid()
    )
  );

-- ─── Workers RLS ────────────────────────────────────────────────
drop policy if exists "users_own_workers" on workers;

create policy "manage_own_workers" on workers
  for all using (user_id = auth.uid());

create policy "pm_view_site_workers" on workers
  for select using (
    current_project_id in (
      select id from projects
      where user_id = auth.uid()
         or id = any((select assigned_project_ids from profiles where id = auth.uid()))
    )
  );

-- ─── Client portal access (no auth needed) ───────────────────────
-- Creates a public function to get project by token
create or replace function get_project_by_token(token text)
returns json as $$
  select row_to_json(p)
  from projects p
  where p.client_token = token
  limit 1;
$$ language sql security definer;

-- ─── Indexes ─────────────────────────────────────────────────────
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_projects_token on projects(client_token);
create index if not exists idx_workers_user on workers(user_id);

-- הודעה
do $$ begin
  raise notice 'Migration 003 complete — roles, client portal, RLS updated';
end $$;
