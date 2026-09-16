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
- Client: `app/lib/api.ts` extended with `hasResponded` on `ActiveSurvey`, `AnswerInput`/`SurveyResponse` types, and `submitSurveyResponse`. `app/components/active-survey-view.tsx` now branches on `me.role`: Managers keep the read-only card from 001; Members get a `SurveyForm` (rating rendered as 5 toggle buttons, yesNo as Yes/No buttons, both built from the existing `Button` component rather than adding a new shadcn primitive) with Submit disabled until every question has a value. A `409` on submit (duplicate this week) is treated the same as success and flips straight to the confirmation `Alert`, since it means a response already exists either way. Verified via a live run (API + client + Postgres) through Chrome DevTools MCP: Member-unanswered → form → submit → confirmation, confirmation persists across reload, Manager stays read-only.
- `app/components/user-picker.tsx`: per-user survey status badge (amber "Survey available" for `hasResponded: false`, emerald "Survey complete" for `true`), fetched by calling `getActiveSurvey(user.id)` for every Member (not Managers — they can't submit, per `@Roles('Member')`, so the status is meaningless for them and is omitted) in parallel (`Promise.allSettled`) once `GET /users` resolves — the directory endpoint itself has no bulk survey-status field, and each user's `hasResponded` is genuinely per-caller, so there's no cheaper query available today. A user whose org has no active survey (404) gets no status badge rather than a default. The Member/Manager role `Badge` moved to sit immediately after the name instead of being pushed to the card's far edge. Each org's user list is further split into "MANAGERS" and "MEMBERS" sub-headings. The org name heading was scaled up (`text-2xl font-semibold`, from `text-sm`) to read as the primary heading for each group.
