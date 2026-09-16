# change-logic-assignment

A multi-tenant survey app. Frontend (`/client`) is React + Vite; backend (`/api`) is NestJS + Vite; db is Postgres via `docker-compose.yml`.

## Spec-driven workflow

Work is spec-driven. Before implementing a feature or change, find or write its spec in `specs/` (use `templates/spec_template.md` as the starting point).

- Specs are living documents, not one-off planning artifacts: as implementation proceeds and decisions are made or revised, update the spec — don't let it drift out of sync with the code. Record implementation notes (what was actually built, deviations from the original plan, and why) in the spec itself, not just in commit messages or PR descriptions.
- Before starting work, cross-check `docs/adr/` for any existing architecture decision that governs the area you're touching (e.g. multi-tenancy, data access patterns). A spec must be consistent with accepted ADRs; if a spec's approach conflicts with an existing ADR, resolve the conflict (update the spec, or raise a new ADR) before implementing. If new work makes a decision worth recording at the architecture level, write a new ADR in `docs/adr/` rather than only capturing it in the spec.

## Multi-tenancy

This project is multi-tenant. Every tenant-scoped table (and every query that touches one) must take `orgId` as a required parameter — never optional, never inferred implicitly. When adding a new table, endpoint, or query, confirm whether it's tenant-scoped and thread `orgId` through accordingly.

Tenant isolation is enforced at two layers (see `docs/adr/adr-0001-multi-tenancy-rls.md`):
- **Application layer**: explicit `orgId` on every tenant-scoped query, as above.
- **Database layer**: Postgres Row-Level Security (RLS) on every tenant-scoped table, backed by Prisma. A NestJS interceptor/middleware sets the tenant context at the top of each request via `SET LOCAL app.tenant_id` inside a transaction wrapper, so RLS policies constrain every query for that request even if an `orgId` filter is ever missed in application code. Every new tenant-scoped table's migration must enable RLS and add its policy alongside the schema change.

## Code style

- Client (`/client`): prefer ES6 arrow functions (`const Foo = () => {}`) over `function` declarations for components, hooks, and helpers. Exception: files generated/managed by `shadcn` CLI (`app/components/ui/*`) — leave their style as generated so re-running `shadcn add` doesn't produce noisy diffs.

## Testing

- All endpoints must be tested.
- Write tests first (TDD): write a failing test for the behavior, then implement until it passes.

## AI agent transcripts

Any conversation with an AI agent (e.g. Claude Code) used to produce work in this repo must be logged to `ai-logs/transcript.md`.
