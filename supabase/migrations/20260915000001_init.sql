-- TIMORA — initial schema
-- Every private table is owned by auth.users, protected by Row-Level Security,
-- and exposes only the columns a signed-in user is allowed to write.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select tz is not null
    and char_length(tz) between 1 and 64
    and exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per user: display and localisation preferences.';

create or replace function public.profiles_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_valid_timezone(new.timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_validate before insert or update on public.profiles
  for each row execute function public.profiles_validate();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- categories
-- ─────────────────────────────────────────────────────────────────────────────

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  system_key text check (
    system_key in ('home', 'vehicle', 'personal_care', 'health', 'pets', 'plants', 'documents', 'lent_items', 'other')
  ),
  name text check (name is null or (char_length(name) between 1 and 40 and name = btrim(name))),
  icon text check (icon is null or icon ~ '^[a-z0-9-]{1,32}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_label_present check (system_key is not null or name is not null),
  constraint categories_id_user_unique unique (id, user_id),
  constraint categories_system_key_unique unique (user_id, system_key)
);

comment on table public.categories is 'Starter categories (system_key, translated in the UI) and user-created categories (name).';

create unique index categories_user_name_unique on public.categories (user_id, lower(name)) where name is not null;
create index categories_user_idx on public.categories (user_id);

create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create or replace function public.categories_enforce_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.categories where user_id = new.user_id) >= 100 then
    raise exception 'category_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger categories_enforce_limit before insert on public.categories
  for each row execute function public.categories_enforce_limit();

-- ─────────────────────────────────────────────────────────────────────────────
-- items
-- ─────────────────────────────────────────────────────────────────────────────

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid,
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  note text check (note is null or char_length(note) <= 1000),
  icon text check (icon is null or icon ~ '^[a-z0-9-]{1,32}$'),
  schedule_type text not null default 'interval' check (schedule_type in ('interval', 'once', 'none')),
  interval_count integer check (interval_count between 1 and 1000),
  interval_unit text check (interval_unit in ('day', 'week', 'month', 'year')),
  due_date date check (due_date between date '1900-01-01' and date '9999-12-31'),
  due_soon_days smallint check (due_soon_days between 0 and 365),
  schedule_set_at timestamptz not null default now(),
  -- 64 hex chars from two v4 UUIDs: 244 random bits, unguessable and URL-safe.
  qr_token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    check (qr_token ~ '^[0-9a-f]{64}$'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_schedule_shape check (
    (schedule_type = 'interval' and interval_count is not null and interval_unit is not null and due_date is null)
    or (schedule_type = 'once' and due_date is not null and interval_count is null and interval_unit is null)
    or (schedule_type = 'none' and due_date is null and interval_count is null and interval_unit is null and due_soon_days is null)
  ),
  constraint items_qr_token_unique unique (qr_token),
  constraint items_id_user_unique unique (id, user_id),
  -- The category must belong to the same user; deleting it only clears category_id.
  constraint items_category_owner_fk foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete set null (category_id)
);

comment on table public.items is 'Things a user maintains. Status is derived from dates in the application, never stored.';

create index items_user_active_idx on public.items (user_id, archived_at);
create index items_category_idx on public.items (category_id);

create trigger items_updated_at before update on public.items
  for each row execute function public.set_updated_at();

create or replace function public.items_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.items where user_id = new.user_id) >= 1000 then
      raise exception 'item_limit_reached' using errcode = 'P0001';
    end if;
    new.schedule_set_at := now();
  elsif (new.schedule_type, new.interval_count, new.interval_unit, new.due_date)
        is distinct from (old.schedule_type, old.interval_count, old.interval_unit, old.due_date) then
    new.schedule_set_at := now();
  end if;
  return new;
end;
$$;

create trigger items_before_write before insert or update on public.items
  for each row execute function public.items_before_write();

-- ─────────────────────────────────────────────────────────────────────────────
-- completion_records (append-only history; undo marks a record, never deletes it)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.completion_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null,
  completed_on date not null check (completed_on >= date '1900-01-01'),
  recorded_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 500),
  source text not null default 'done_now' check (source in ('done_now', 'backdated', 'initial', 'qr')),
  undone_at timestamptz,
  constraint completion_undone_after_record check (undone_at is null or undone_at >= recorded_at),
  constraint completion_item_owner_fk foreign key (item_id, user_id)
    references public.items (id, user_id) on delete cascade
);

comment on table public.completion_records is 'Audit-friendly completion history. Records are never deleted by users; undo sets undone_at.';

create index completion_item_active_idx on public.completion_records (item_id, completed_on desc) where undone_at is null;
create index completion_user_recorded_idx on public.completion_records (user_id, recorded_at desc);

create or replace function public.completion_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.recorded_at := now();
  new.undone_at := null;

  -- No timezone on Earth is ahead of UTC+14, so nothing can legitimately be completed later than this date.
  if new.completed_on > (now() at time zone 'Etc/GMT-14')::date then
    raise exception 'completion_in_future' using errcode = '22023';
  end if;

  if exists (select 1 from public.items where id = new.item_id and archived_at is not null) then
    raise exception 'item_archived' using errcode = 'P0001';
  end if;

  -- Guard against accidental double taps on "Done now".
  if new.source in ('done_now', 'qr') and exists (
    select 1 from public.completion_records
    where item_id = new.item_id
      and undone_at is null
      and source in ('done_now', 'qr')
      and recorded_at > now() - interval '5 seconds'
  ) then
    raise exception 'duplicate_completion' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger completion_before_insert before insert on public.completion_records
  for each row execute function public.completion_before_insert();

create or replace function public.completion_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.undone_at is not null then
    raise exception 'already_undone' using errcode = 'P0001';
  end if;
  if new.undone_at is null then
    raise exception 'undo_only' using errcode = 'P0001';
  end if;
  -- Only the undo marker may change, and its time is set by the server.
  new := old;
  new.undone_at := now();
  return new;
end;
$$;

create trigger completion_before_update before update on public.completion_records
  for each row execute function public.completion_before_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- item_overview: items with their latest active completion (RLS applies via security_invoker)
-- ─────────────────────────────────────────────────────────────────────────────

create view public.item_overview
with (security_invoker = true)
as
select
  i.id,
  i.user_id,
  i.category_id,
  i.name,
  i.note,
  i.icon,
  i.schedule_type,
  i.interval_count,
  i.interval_unit,
  i.due_date,
  i.due_soon_days,
  i.schedule_set_at,
  i.qr_token,
  i.archived_at,
  i.created_at,
  i.updated_at,
  c.system_key as category_system_key,
  c.name as category_name,
  c.icon as category_icon,
  lc.last_completed_on,
  lc.latest_recorded_at,
  coalesce(lc.completion_count, 0) as completion_count
from public.items i
left join public.categories c on c.id = i.category_id
left join lateral (
  select
    max(r.completed_on) as last_completed_on,
    -- Used to resolve one-time dates: a historical "last done" entered at creation must not resolve them.
    max(r.recorded_at) filter (where r.source <> 'initial') as latest_recorded_at,
    count(*)::integer as completion_count
  from public.completion_records r
  where r.item_id = i.id and r.undone_at is null
) lc on true;

-- ─────────────────────────────────────────────────────────────────────────────
-- QR token rotation (invalidates previously printed labels)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.regenerate_qr_token(p_item_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.items
     set qr_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
   where id = p_item_id
     and user_id = auth.uid()
  returning qr_token into v_token;

  if v_token is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_token;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- New user bootstrap: profile + starter categories
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text := coalesce(new.raw_user_meta_data ->> 'locale', 'ar');
  v_timezone text := coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC');
begin
  if v_locale not in ('ar', 'en') then
    v_locale := 'ar';
  end if;
  if not public.is_valid_timezone(v_timezone) then
    v_timezone := 'UTC';
  end if;

  insert into public.profiles (id, locale, timezone)
  values (new.id, v_locale, v_timezone);

  insert into public.categories (user_id, system_key, icon)
  values
    (new.id, 'home', 'house'),
    (new.id, 'vehicle', 'car'),
    (new.id, 'personal_care', 'sparkles'),
    (new.id, 'health', 'heart-pulse'),
    (new.id, 'pets', 'paw-print'),
    (new.id, 'plants', 'sprout'),
    (new.id, 'documents', 'file-text'),
    (new.id, 'lent_items', 'hand-helping'),
    (new.id, 'other', 'shapes');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.completion_records enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "categories: read own" on public.categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy "categories: insert own" on public.categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "categories: update own" on public.categories
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "categories: delete own" on public.categories
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "items: read own" on public.items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "items: insert own" on public.items
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "items: update own" on public.items
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "items: delete own" on public.items
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "completions: read own" on public.completion_records
  for select to authenticated using (user_id = (select auth.uid()));
create policy "completions: insert own" on public.completion_records
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "completions: undo own" on public.completion_records
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Privileges: nothing for anon; column-scoped writes for authenticated
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on table public.profiles, public.categories, public.items, public.completion_records, public.item_overview
  from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, locale, timezone, theme) on table public.profiles to authenticated;

grant select, delete on table public.categories to authenticated;
grant insert (name, icon) on table public.categories to authenticated;
grant update (name, icon) on table public.categories to authenticated;

grant select, delete on table public.items to authenticated;
grant insert (category_id, name, note, icon, schedule_type, interval_count, interval_unit, due_date, due_soon_days)
  on table public.items to authenticated;
grant update (category_id, name, note, icon, schedule_type, interval_count, interval_unit, due_date, due_soon_days, archived_at)
  on table public.items to authenticated;

grant select on table public.completion_records to authenticated;
grant insert (item_id, completed_on, note, source) on table public.completion_records to authenticated;
grant update (undone_at) on table public.completion_records to authenticated;

grant select on table public.item_overview to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.profiles_validate() from public, anon, authenticated;
revoke all on function public.categories_enforce_limit() from public, anon, authenticated;
revoke all on function public.items_before_write() from public, anon, authenticated;
revoke all on function public.completion_before_insert() from public, anon, authenticated;
revoke all on function public.completion_before_update() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.regenerate_qr_token(uuid) from public, anon;
grant execute on function public.regenerate_qr_token(uuid) to authenticated;
grant execute on function public.is_valid_timezone(text) to authenticated;
