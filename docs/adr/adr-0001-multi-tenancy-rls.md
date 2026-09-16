# ADR-0001: Multi-tenancy via Prisma + Postgres Row-Level Security

## Status

Accepted — 2026-09-15

## Context

This app is multi-tenant: every tenant-scoped table must be isolated per organization. Relying solely on application code to filter every query by `orgId` is fragile — a single missed `WHERE orgId = ...` clause in a service, script, or future endpoint leaks data across tenants, and that mistake is easy to make and hard to catch in review or tests.

We want tenant isolation enforced at the database layer, not just in application code, while still keeping `orgId` explicit and required in application code per the existing multi-tenancy rule in `CLAUDE.md`.

## Decision

Use Postgres Row-Level Security (RLS) as the enforcement boundary, with Prisma as the ORM:

- Every tenant-scoped table has an RLS policy that restricts rows to the current tenant, based on a Postgres session variable (e.g. `app.tenant_id`).
- A NestJS interceptor (or middleware) sets that session variable at the start of each request, scoped to a database transaction, via `SET LOCAL app.tenant_id = '<orgId>'`. `SET LOCAL` is used (not `SET`) so the value is automatically scoped to the transaction and cannot leak across pooled connections or requests.
- All request handling that touches tenant-scoped tables runs inside that transaction, so every query — including ones written without an explicit `orgId` filter — is constrained by the RLS policy.
- Application code still passes `orgId` explicitly wherever required (per `CLAUDE.md`); RLS is a defense-in-depth backstop, not a replacement for that discipline.
- `orgId` for the request is derived from authenticated request context (not client-supplied query/body params) before being set as the session variable, to prevent tenant spoofing.

## Update — 2026-09-16

Resolved: `pulse_app` (NOSUPERUSER, NOBYPASSRLS, not the owner) is now the
runtime role (`RUNTIME_DATABASE_URL`); `pulse` is migrations/seed only. See
`runtime_role_no_bypass_rls` migration.

## Consequences

- Requires every tenant-scoped query to run through the transaction wrapper that sets `app.tenant_id`; connection-pooled or raw queries that bypass this wrapper will either see no rows (if RLS defaults to deny) or must be explicitly excluded and justified.
- Migrations must include the RLS policy (and `ENABLE ROW LEVEL SECURITY`) alongside each new tenant-scoped table — this becomes part of the standard migration checklist.
- Adds a small amount of overhead per request (opening a transaction, running `SET LOCAL`) and a new failure mode to test for: requests that reach the DB without tenant context set should be denied, not silently return unscoped data. This must be covered by tests, not just assumed.
- Superuser/admin DB roles bypass RLS by default in Postgres — the app's runtime DB role must not be a superuser/table owner, or RLS provides no protection.

## Alternatives considered

- **Application-layer filtering only** (current baseline): every query manually includes `orgId`. Simple, but a single missed filter is a full tenant data leak with no backstop. Rejected as the sole mechanism, though it remains required in addition to RLS.
- **Separate database/schema per tenant**: strongest isolation, but operationally heavy (per-tenant migrations, connection management) and disproportionate for this project's scale.
