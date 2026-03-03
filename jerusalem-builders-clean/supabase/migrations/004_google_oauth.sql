-- ═══════════════════════════════════════════════════════════════
-- Jerusalem Builders — Migration 004: Google OAuth
-- יוצר פרופיל אוטומטי בכניסה ראשונה עם Google
-- ═══════════════════════════════════════════════════════════════

-- ─── Trigger: צור פרופיל אחרי Google OAuth ───────────────────────
create or replace function handle_new_user()
returns trigger as $$
begin
  -- בדוק אם פרופיל כבר קיים
  if not exists (select 1 from public.profiles where id = new.id) then
    insert into public.profiles (id, email, full_name, role)
    values (
      new.id,
      new.email,
      -- שלוף שם מ-Google metadata
      coalesce(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
      ),
      -- הראשון שנרשם = admin, כולם אחריו = field_worker
      case
        when (select count(*) from public.profiles) = 0 then 'admin'
        else 'field_worker'
      end
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- הסר trigger קיים אם יש
drop trigger if exists on_auth_user_created on auth.users;

-- צור trigger חדש
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- ─── הוסף avatar_url לפרופיל (מ-Google) ─────────────────────────
alter table profiles
  add column if not exists avatar_url text;

-- עדכן trigger לכלול avatar
create or replace function handle_new_user()
returns trigger as $$
begin
  if not exists (select 1 from public.profiles where id = new.id) then
    insert into public.profiles (id, email, full_name, avatar_url, role)
    values (
      new.id,
      new.email,
      coalesce(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
      ),
      new.raw_user_meta_data->>'avatar_url',
      case
        when (select count(*) from public.profiles) = 0 then 'admin'
        else 'field_worker'
      end
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- ─── הודעה ─────────────────────────────────────────────────────
do $$ begin
  raise notice '
  Migration 004 complete!
  
  עכשיו צריך להפעיל Google OAuth ב-Supabase:
  1. Supabase Dashboard → Authentication → Providers → Google
  2. הכנס Client ID + Secret מ-Google Cloud Console
  3. הוסף Authorized redirect URI:
     https://[project].supabase.co/auth/v1/callback
  ';
end $$;
