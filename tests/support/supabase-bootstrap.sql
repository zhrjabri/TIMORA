-- Minimal stand-in for the parts of Supabase the migrations depend on:
-- the anon/authenticated roles, auth.users, auth.uid(), and Supabase's default grants
-- (which give anon/authenticated ALL on new public tables — the migration must revoke
-- them explicitly, and the tests prove it does).
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
