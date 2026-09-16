# SPEC — 003 Weekly survey summary

## Goal

A Manager views the current-week completion rollup and per-question breakdown for their org's active survey.

## In scope

- `GET /surveys/:id/summary` — Manager only, current calendar week (Mon–Sun UTC, per `getWeekStart()`).
- Overall: completion count + completion rate, denominator = org's Members (not Managers).
- Per-question rollup: `rating` → average + count; `yesNo` → counts per option (`true`/`false`).
- Survey must belong to caller's org (RLS + `orgId` check) and must be the org's currently-active survey.
- TDD: failing test → implementation. e2e against real Postgres.
- Client: Manager summary view — completion count/rate + per-question rollup cards, reachable from the Manager's existing survey view.

## Out of scope

- Historical (non-current-week) summaries, and summaries for inactive/past surveys — see "Which surveys are summarizable" below for why this isn't just deferred but actively excluded for now.
- Summary for surveys outside the caller's org (`404`, invisible under RLS).
- Real-time/live-updating summary (polling or websockets) — plain fetch-on-load.
- Per-member breakdown (who responded) — only aggregate counts.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Week | Current calendar week (Mon–Sun UTC) | Matches `getWeekStart()` already used for responses; no new "which week" param |
| Which surveys are summarizable | Only the org's currently-active survey; `409` for an inactive survey id | Considered opening this up to any org survey (so Managers could review a just-deactivated survey's "final numbers"), but the summary is always computed for *this calendar week*, and `submitResponse` requires `isActive` — so an inactive survey can never have this-week responses. Summarizing one would deterministically return all-zero counts, which reads as broken rather than as a real "final" result. Revisit if/when a historical per-week summary is built. |
| Completion denominator | Count of `User` where `orgId` = survey's org and `role = Member` | Matches `overall.md`'s decision; Managers aren't surveyed |
| Completion numerator | Count of distinct `Response` for this survey with `weekStart` = current week | One response per Member per week, so count = distinct responders |
| Rollup computation | App code, not SQL aggregation | `Answer.value` is generic `Json`; matches 001/002's precedent (`overall.md` implementation notes) |
| yesNo counts shape | `{ true: number, false: number }` (JSON string keys `"true"`/`"false"`) | Mirrors the stored boolean `Answer.value` 1:1; avoids introducing a yes/no vocabulary that doesn't exist elsewhere in the domain |
| rating rollup shape | `{ average: number \| null, count: number }` | `average` is `null` (not `0`, not omitted) when `count` is `0` — `0` would misleadingly read as a real low rating. `average` is rounded to 2 decimal places server-side when present. |
| Question rollup includes `text`/`order` | Yes | No `GET /surveys` (list) or `GET /surveys/:id` (fetch-one) endpoint exists yet, so the summary must be self-sufficient for the Manager UI to label rollups without a second request |
| Completion rate on zero Members | `rate: null` (not `0`) | Same "not applicable" null pattern as rating average; `0` would misleadingly read as "0% completed" |
| Wrong org / unknown survey id | `404` | Invisible under RLS — consistent with 002's `POST /responses` |
| Member/wrong-role calls endpoint | `403` | `RolesGuard` + `@Roles('Manager')`, reusing 002's guard |
| No responses yet this week | `200` with zero counts, not `404`/`204` | A survey with no responses still has a valid (empty) summary |

## Data model

No schema changes — computed from existing `Survey`/`Question`/`Response`/`Answer`/`User` tables.

## API / interface surface

| Method | Route | Role | Notes |
|---|---|---|---|
| GET | `/surveys/:id/summary` | Manager | Active survey + current week only; `409` if the survey exists but is inactive. Response: `{ surveyId, weekStart, completion: { count, total, rate: number \| null }, questions: [{ questionId, type, text, order, rating?: { average: number \| null, count }, yesNo?: { true, false } }] }` |

## Non-goals

- Historical/past-week summaries, summaries of inactive surveys, survey-level trend charts, per-member response detail.

## Implementation notes

- `api/src/surveys/week.ts` — reuse existing `getWeekStart()`, no changes needed.
- `api/src/surveys/surveys.service.ts` — add `getSurveySummary(tx, orgId, surveyId)`: fetch survey + questions scoped by `{ id: surveyId, orgId }` (404 if missing), `409` if `!survey.isActive`, count Members via `tx.user.count({ where: { orgId, role: 'Member' } })`, count distinct current-week responses via `tx.response.count`, then one `tx.answer.findMany` (via `question: { surveyId } `) joined to compute per-question rollups in app code. Round rating averages to 2 decimal places; use `null` for zero-count averages and zero-Member completion rate.
- `api/src/surveys/surveys.controller.ts` — add `GET :id/summary` under `@Roles('Manager')` + existing `RolesGuard`/`AuthGuard`/`TenantTransactionInterceptor`.
- Tests: extend `api/src/surveys/surveys.service.spec.ts` and `surveys.controller.spec.ts`; add `api/test/surveys-summary.e2e-spec.ts`. Written before implementation (TDD). Cover: zero-response summary, zero-Member org, inactive-survey `409`, cross-org `404`, rating rounding.
- Client: `app/lib/api.ts` gets `SurveySummary` type + `getSurveySummary`. New component (e.g. `app/components/survey-summary-view.tsx`) rendered for Managers, using existing shadcn/ui primitives (`Card`, `Badge`) consistent with 001/002. Must render `average: null` / `rate: null` as an explicit "no data yet" state (e.g. em dash or "No responses yet"), not fall through to `0` or a blank/misleading chart.

### API implementation notes (as built)

- `SurveysService.getSurveySummary(tx, orgId, surveyId)` implemented as specced: `survey.findFirst({ id, orgId })` (404 if missing), `409` if `!isActive`, then `Promise.all` of Member `user.count`, current-week `response.count`, and one `answer.findMany` scoped to `{ response: { surveyId, weekStart } }`.
- Per-question rollups are computed by sorting `survey.questions` by `order` in app code (not relying on the DB `orderBy` alone) — the unit tests mock `findFirst` directly, so the mocked question array order must be corrected in-service regardless of what a real Prisma `orderBy` would do. Matches the "rollup computation in app code" decision already in this spec.
- `completion.rate` is `null` only when `total` (Member count) is `0`; a `0/N` completion where `N > 0` returns `rate: 0`, not `null` — this matches the e2e test expectations and is the "not applicable" null pattern applied strictly to the zero-denominator case, not to a legitimately-zero numerator.
- `SurveysController.getSummary` added as `GET :id/summary`, guarded by `RolesGuard` + `@Roles('Manager')`, alongside the existing `AuthGuard`/`TenantTransactionInterceptor` at the controller level.
- All pre-existing service/controller/e2e tests for `getSurveySummary` (written ahead of this implementation) pass unchanged; no test edits were needed to make the implementation fit.

### Client implementation notes (as built)

- `app/lib/api.ts` gets a `SurveySummary` type (mirroring the API response exactly) and `getSurveySummary(userId, surveyId)`.
- `app/components/survey-summary-view.tsx`: fetches and renders completion count/rate (`Badge` + rate text) and per-question rollup cards (`Card`, reusing the `QUESTION_TYPE_LABEL` pattern from `active-survey-view.tsx`). `rate: null` renders as "No data yet"; `rating.average: null` renders as "No responses yet" — both explicit non-numeric states per the spec, not a fallthrough to `0`.
- `app/components/active-survey-view.tsx`: the Manager's existing read-only survey card (the `!showForm` branch) gets a "View summary" / "Hide summary" toggle button that shows `SurveySummaryView` inline below the card. No new route was added — the app has a single index route, so this matches the existing shape rather than introducing router changes for one view.
- Verified live (API + client + Postgres) via Chrome DevTools MCP: Manager toggles summary open/closed with correct completion and rollup numbers; Members see no summary button. No client test suite exists in this repo (per 002's precedent) — verification was live-browser only, no automated frontend tests added.
- Found and fixed an unrelated pre-existing bug during verification: `api/prisma/seed.ts` stored answer values as `{ rating: N }` / `{ yesNo: bool }` objects instead of raw `number`/`boolean`, causing all seeded rating averages to compute as `NaN` (serialized as `null`). Fixed and reseeded (see `ai-logs/transcript.md` for detail); not a 003-spec change, just a local dev-data fix needed to verify the summary UI end-to-end with real numbers.
