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

- `api/src/surveys/surveys.service.ts` — `getSurveySummary(tx, orgId, surveyId)`: `survey.findFirst({ id, orgId })` (404 if missing), `409` if `!isActive`, then `Promise.all` of Member `user.count`, current-week `response.count`, and one `answer.findMany` scoped to `{ response: { surveyId, weekStart } }`, rolled up per-question in app code. `survey.questions` are sorted by `order` in app code rather than relying solely on DB `orderBy` (unit tests mock `findFirst` directly). Rating averages rounded to 2 decimals; `null` used for zero-count averages and for `completion.rate` only when the Member total is `0` (a legitimate `0/N` with `N > 0` returns `rate: 0`).
- `api/src/surveys/surveys.controller.ts` — `GET :id/summary` under `@Roles('Manager')` + existing `RolesGuard`/`AuthGuard`/`TenantTransactionInterceptor`.
- Tests (TDD): extended `surveys.service.spec.ts`/`surveys.controller.spec.ts`, added `api/test/surveys-summary.e2e-spec.ts`. Cover zero-response summary, zero-Member org, inactive-survey `409`, cross-org `404`, rating rounding.
- Client: `app/lib/api.ts` gets a `SurveySummary` type + `getSurveySummary(userId, surveyId)`. `survey-summary-view.tsx` renders completion count/rate (`Badge`) and per-question rollup cards (`Card`, reusing `active-survey-view.tsx`'s `QUESTION_TYPE_LABEL` pattern); `rate: null` → "No data yet", `rating.average: null` → "No responses yet" (never falls through to `0`). `active-survey-view.tsx`'s Manager read-only card gets a "View summary"/"Hide summary" toggle rendering `SurveySummaryView` inline (no new route — single index route). Verified live (API + client + Postgres via Chrome DevTools MCP): toggle shows correct completion/rollup numbers, hidden for Members; no client test suite (per 002's precedent).
- Fixed an unrelated pre-existing bug found during verification: `api/prisma/seed.ts` stored answer values as `{ rating: N }`/`{ yesNo: bool }` objects instead of raw `number`/`boolean`, making seeded rating averages compute as `NaN` → `null`. Fixed and reseeded (detail in `ai-logs/transcript.md`).
