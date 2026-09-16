# SPEC — 001 View active survey

## Goal

End-to-end slice: a logged-in user (Member or Manager) can view their org's currently active survey and its questions.

## In scope

- `X-User-Id` guard: resolves header → user, 401 if missing/unknown.
- RLS transaction interceptor: `SET LOCAL app.tenant_id` before the handler runs.
- `GET /surveys/active` — any role.
- TDD: failing test → implementation. e2e test against real Postgres.
- Client: fetch + render the active survey (questions, types) for the logged-in user; empty state if none active. Use shadcn/ui components (`Card`, `Badge`, `Skeleton`, `Alert`) for layout/loading/empty states instead of hand-rolled markup.

## Out of scope

- All other endpoints in `specs/overall.md` (survey creation/activation, submitting responses, summary) — separate specs.
- Response submission UI (read-only view only).

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| orgId source | Always server-derived from resolved user | Prevents tenant spoofing |
| No active survey | `404` | Distinct from a survey with zero questions |
| Question ordering | Sorted by `order` asc in response | Client renders in author-defined order, no client-side sort logic |
| UI components | shadcn/ui (Tailwind already in `client`) | Copy-in, unstyled-by-default primitives avoid boilerplate for card/loading/empty states without pulling in a heavier component library |

## Data model

No schema changes — builds on the existing `api/prisma/schema.prisma`.

## API / interface surface

| Method | Route | Role | Notes |
|---|---|---|---|
| GET | `/users` | none (public) | All seeded users `{id, name, role, orgId, orgName}`, cross-org. This *is* the login mechanism — the picker needs a directory before any user is selected, so it can't require `X-User-Id` itself |
| GET | `/me` | any | Resolve header → `{id, orgId, name, role}`; needed by client to identify the caller |
| GET | `/surveys/active` | any | Org's active survey + questions (ordered); 404 if none active |

## Non-goals

- Pagination — one active survey per org by design.

## Implementation notes

- shadcn/ui initialized in `client` (`npx shadcn@latest init -t react-router -b radix`); added `card`, `badge`, `skeleton`, `alert`.
- `GET /users` is intentionally cross-org/unscoped — it's the pre-login directory the picker reads before any `X-User-Id` exists.
- Auth bootstrap chicken-and-egg (need `orgId` before `app.tenant_id` can be set) fixed by `users_self_lookup_policy` migration: widens the RLS policy to also allow a single-row match on `app.requesting_user_id`.
- **Resolved**: `pulse` was a Postgres superuser and bypassed RLS entirely. `runtime_role_no_bypass_rls` migration adds `pulse_app` (NOSUPERUSER, NOBYPASSRLS) as the API's runtime role (`RUNTIME_DATABASE_URL`); `pulse` is now migrations/seed only. `GET /users` got an explicit carve-out (`app.allow_public_directory`). See [[adr-0001-multi-tenancy-rls]]'s 2026-09-16 update.
- Client: `app/lib/api.ts`, `app/lib/session.ts`, `app/components/user-picker.tsx`, `app/components/active-survey-view.tsx`, wired into `app/routes/home.tsx`. Verified via curl + typecheck; no live browser check this session.
