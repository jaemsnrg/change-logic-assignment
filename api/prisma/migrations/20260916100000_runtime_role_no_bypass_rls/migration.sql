-- docker-compose's "pulse" role is a Postgres superuser, which bypasses RLS
-- unconditionally (see adr-0001). Add "pulse_app" — NOSUPERUSER, NOBYPASSRLS,
-- not the table owner — as the role the running API connects as
-- (RUNTIME_DATABASE_URL); "pulse" stays owner, used only for migrations/seed.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pulse_app') THEN
    CREATE ROLE "pulse_app" LOGIN PASSWORD 'pulse_app' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO "pulse_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "pulse_app";

-- Auto-grant pulse_app on tables from future migrations too.
ALTER DEFAULT PRIVILEGES FOR ROLE "pulse" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "pulse_app";

-- GET /users is a deliberately cross-org pre-login directory with no
-- tenant/user session var set. UsersService sets app.allow_public_directory
-- for just that query.
DROP POLICY "tenant_isolation" ON "users";

CREATE POLICY "tenant_isolation" ON "users"
  USING (
    "orgId" = current_setting('app.tenant_id', true)
    OR "id" = current_setting('app.requesting_user_id', true)
    OR current_setting('app.allow_public_directory', true) = 'true'
  );
