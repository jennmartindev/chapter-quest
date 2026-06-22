-- ============================================================
-- Grant table privileges to the Supabase API roles.
-- These tables were created over a direct postgres connection, which skips
-- the automatic grants the dashboard would normally apply — so the API's
-- "authenticated"/"anon" roles got "permission denied for table ...".
-- Row-Level Security is still enabled and still restricts every row; these
-- grants only let the roles reach the tables so RLS can do its job.
-- ============================================================
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;

-- Future tables/sequences created by this role inherit the same grants.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines  to anon, authenticated, service_role;
