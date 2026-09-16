# SPEC — 002 Submit survey response

## Goal

A Member submits answers to their org's active survey — one Response per Member per Survey per calendar week, write-once.

## In scope

- `POST /surveys/:id/responses` — Member only, error codes per Key decisions.
- Extend `GET /surveys/active` with `hasResponded: boolean` (caller + current week).
- Validation: exactly one answer per question, no unknowns; `rating` 1–5 int, `yesNo` boolean.
- `weekStart`/`orgId`/`userId` server-derived, reusing 001's `X-User-Id` guard + RLS interceptor.
- TDD: failing test → implementation. e2e against real Postgres.
- Client: submission form on the Member's active-survey view (rating 1–5 buttons, yes/no toggle), submit disabled until all answered. Success or pre-existing `hasResponded` → confirmation state instead of form. shadcn/ui, matching 001's components.

## Out of scope

- Editing/resubmitting responses; viewing past answer content (only `hasResponded` is exposed).
- Manager summary view (`GET /surveys/:id/summary`) — future spec.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Answer wire format | `{ answers: [{ questionId, value }] }` | REST-conventional; `value` type implied by question type |
| Must be active survey | Yes | Members submit to *the* active survey, not any survey id |
| Wrong org / unknown survey id | `404` | Invisible under RLS — same as not-found |
| Survey visible but inactive | `409` | State conflict |
| Duplicate response this week | `409` | Matches `unique(surveyId, userId, weekStart)` |
| Missing/extra/invalid-type answers | `400` | Client-correctable |
| Manager submits | `403` | `RolesGuard` + `@Roles('Member')` — `overall.md`'s API table has 3 more role-scoped endpoints coming, so the guard pays for itself immediately |
| `hasResponded` | Boolean only, no content | Minimal; past-answer viewing out of scope |
| Success response | `201` + created `Response`/`answers` | Matches `GET /surveys/active`'s nested shape |

## Data model

No schema changes — `Response`/`Answer` already modeled in `api/prisma/schema.prisma`.

## API / interface surface

| Method | Route | Role | Notes |
|---|---|---|---|
| GET | `/surveys/active` | any | **Extended**: adds `hasResponded: boolean` |
| POST | `/surveys/:id/responses` | Member | Body: `{ answers: [{ questionId, value }] }` → `201` + created `Response` |

## Implementation notes

- `api/src/surveys/week.ts` — `getWeekStart()`, pure function, Monday 00:00 UTC.
- `api/src/surveys/surveys.service.ts` — `getActiveSurvey` extended with `hasResponded`; `submitResponse` does existence/active/answer-shape/value-type validation then `tx.response.create` with nested `answers.create`, mapping a Prisma `P2002` unique-violation (duplicate week) to `ConflictException`.
- Role enforcement moved from an inline controller check to `RolesGuard` (`api/src/auth/roles.guard.ts`) + `@Roles()` decorator (`api/src/auth/roles.decorator.ts`), reading required roles via `Reflector` off handler/class metadata — reusable for the Manager-only endpoints still to come (`POST /surveys`, `POST /surveys/:id/activate`, `GET /surveys/:id/summary`).
- Tests: `api/src/surveys/{week,surveys.service,surveys.controller}.spec.ts`, `api/src/auth/roles.guard.spec.ts`, `api/test/surveys-responses.e2e-spec.ts`. All written before the implementation (TDD), confirmed red, then made green.
