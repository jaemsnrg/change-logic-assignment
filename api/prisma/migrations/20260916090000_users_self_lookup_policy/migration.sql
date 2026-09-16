-- Auth bootstrap needs a user's orgId before app.tenant_id can be set, but the
-- original policy required orgId = app.tenant_id for every read. Widen it to
-- also allow a row through by exact id match on app.requesting_user_id (set
-- by the auth guard) — single-row lookup only, no listing. Not a wider trust
-- model: adr-0002 already accepts that a valid User.id can impersonate.
DROP POLICY "tenant_isolation" ON "users";

CREATE POLICY "tenant_isolation" ON "users"
  USING (
    "orgId" = current_setting('app.tenant_id', true)
    OR "id" = current_setting('app.requesting_user_id', true)
  );
