# SPEC — Multi-tenant pulse surveys

## Goal

Managers run a weekly pulse survey (up to 3 questions) for their org; Members submit one response per calendar week; Managers get a weekly completion/rollup summary — with strict org isolation.

## In scope

- Organization/User/Survey/Question/Response/Answer model, RLS on every tenant-scoped table ([[adr-0001-multi-tenancy-rls]]).
- Manager: create survey (≤3 questions), list org's surveys, activate (auto-deactivates prior active).
- Member: fetch org's active survey, submit response (all questions required, write-once).
- Manager: current-week summary — completion count/rate (Members only) + per-question rollup.
- Header-based local auth (`X-User-Id`), [[adr-0002-header-based-local-auth]].
- Seed data: 2+ orgs, Manager + Members each, 1 active survey/org, partial responses.
- React app: seeded-user picker, Member view, Manager view.

## Out of scope

- Real auth/identity provider ([[adr-0002-header-based-local-auth]]).
- Editing/resubmitting responses; historical summaries; multiple active surveys per org; survey/question editing post-creation; org logo upload.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Week | Calendar week, Mon–Sun UTC | Deterministic, matches weekly cadence |
| Active surveys/org | Exactly one | Matches singular "active survey"; simpler API |
| Response shape | `Response` (1/user/survey/week) + child `Answer`s | One existence check + per-question rollup |
| Answer value | Generic `Json`, not typed columns | Simpler schema; rollups computed in app code |
| Completion denominator | Members only | Managers aren't the surveyed audience |
| Auth | `X-User-Id`, org server-derived | Minimal per assignment; prevents tenant spoofing |
| Response mutability | Write-once | Matches "submit" as one atomic action |
| Tenant isolation | App-layer `orgId` + Postgres RLS | Per [[adr-0001-multi-tenancy-rls]] |

## Data model

```
Organization(id, name)
User(id, orgId, name, role: Manager | Member)
Survey(id, orgId, title, isActive, createdAt)
Question(id, surveyId, type: rating | yesNo, text, order: 1..3)   — cap of 3 enforced in app code
Response(id, surveyId, userId, orgId, weekStart, submittedAt)     — unique(surveyId, userId, weekStart)
Answer(id, responseId, questionId, value: Json)                   — unique(responseId, questionId)
```

RLS: `Organization` is the tenant root. `User`/`Survey`/`Response` carry `orgId` directly; `Question`/`Answer` are scoped transitively via `Survey`/`Response`. See `api/prisma/migrations/20260915120000_init/migration.sql`.

RLS is enforced against a non-superuser runtime role (`pulse_app`); `pulse` (owner/superuser) is used only for migrations/seed — see [[adr-0001-multi-tenancy-rls]]'s 2026-09-16 update.

## API / interface surface

Built incrementally, one endpoint/feature per spec. `specs/001-view-surveys.md` covers `GET /surveys/active`; `specs/002-submit-survey-response.md` covers `POST /surveys/:id/responses` (and extends `GET /surveys/active` with `hasResponded`); `specs/003-weekly-survey-summary.md` covers `GET /surveys/:id/summary`; remaining rows below are unimplemented / future specs.

| Method | Route | Role |
|---|---|---|
| GET | `/me` | any |
| POST | `/surveys` | Manager |
| GET | `/surveys` | Manager |
| POST | `/surveys/:id/activate` | Manager |
| GET | `/surveys/active` | any |
| POST | `/surveys/:id/responses` | Member |
| GET | `/surveys/:id/summary` | Manager |

## Non-goals

- Real auth/session management ([[adr-0002-header-based-local-auth]]).
- Response editing, historical summaries, multi-active surveys, post-creation editing, org logo storage.

## Implementation notes

- Rollups computed in app code (not SQL) since `Answer.value` is generic `Json` — see `specs/001-rest-api-endpoints.md`.
- Prisma schema: `api/prisma/schema.prisma`; initial migration (hand-authored, includes RLS): `api/prisma/migrations/20260915120000_init/migration.sql`.
- Seed data: `api/prisma/seed.ts`, run via `npm run db:seed --prefix api`. Idempotent; 2 orgs, Manager + Members, active survey + partial responses per org.
