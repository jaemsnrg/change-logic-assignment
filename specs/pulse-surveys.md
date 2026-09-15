# SPEC — Multi-tenant pulse surveys

## Goal

Let Managers run a weekly pulse survey (up to 3 questions) for their Organization, let Members submit one response per calendar week, and give Managers a weekly completion/rollup summary — with strict data isolation between Organizations.

## In scope

- Organization, User (Manager/Member), Survey, Question, Response, Answer data model with Postgres RLS ([[adr-0001-multi-tenancy-rls]]) on every tenant-scoped table.
- Manager-guarded endpoints to create a Survey (up to 3 Questions), list their org's Surveys, and activate a Survey (auto-deactivating any currently-active one for that org).
- Member endpoint to fetch their org's active Survey and submit a Response (all questions required, write-once).
- Manager endpoint for the current calendar week's summary: completion count/rate (Members only) + per-question rollup (rating avg+count, yes/no counts).
- Header-based local auth (`X-User-Id`) per [[adr-0002-header-based-local-auth]].
- Seed data: at least 2 orgs, a few Members + at least 1 Manager per org, at least one active Survey per org, some seeded Responses to make the summary non-trivial.
- React app: seeded-user picker (login), Member view (active survey + submit), Manager view (weekly summary).

## Out of scope

- Real authentication/identity provider (see [[adr-0002-header-based-local-auth]]).
- Editing/resubmitting a Response once submitted.
- Historical (past-week) summaries — current week only.
- Multiple concurrently-active surveys per org.
- Survey/Question editing after creation (e.g. changing question text or type on an existing Survey) — creating a new Survey is the path for changes.
- Organization logo upload/serving (covered as a design note only, per Task 3).

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Week definition | Calendar week, Mon–Sun UTC | Deterministic, no "now"-drift in tests; matches weekly cadence |
| Active surveys per org | Exactly one | Matches "view your organization's active survey" (singular); simpler API |
| Survey lifecycle | Boolean `isActive` | No behavior needs draft/closed states in this slice |
| Response shape | `Response` (1 per user/survey/week) with child `Answer` rows | Single existence check for completion; child `Answer`s for per-question rollups |
| Answer value storage | Generic `value: Json` (`{rating}` or `{yesNo}`), not typed columns | Simpler schema for two question types; trades SQL-aggregate rollups for app-code aggregation (see Implementation notes) |
| Completion denominator | Members only (Managers excluded) | Matches "how many of my people responded"; Managers aren't the surveyed audience |
| Auth | `X-User-Id` header, server resolves org/role | Minimal per assignment constraints; org is server-derived, not client-asserted — see [[adr-0002-header-based-local-auth]] |
| Survey creation | Real Manager-guarded endpoints, not seed-only | "Managers can create and manage surveys" is a stated business requirement, not just a UI nicety |
| Response mutability | Write-once, locked after submit | Matches "submit your response" as one atomic action; avoids edit/versioning scope |
| Question required-ness | All questions required to submit | Submission is all-or-nothing; keeps rollup counts unambiguous |
| Activating a new survey while one is active | Auto-deactivate the previous one | Server enforces the "one active survey" invariant instead of relying on caller discipline |
| Summary scope | Current week only, no week selector | Matches the assignment's stated flow; historical summaries are a named non-goal |
| Tenant isolation | App-layer `orgId` + Postgres RLS | Per [[adr-0001-multi-tenancy-rls]], already accepted |

## Data model

```
Organization(id, name)

User(id, orgId, name, role: Manager | Member)

Survey(id, orgId, title, isActive: boolean, createdAt)

Question(id, surveyId, type: rating | yesNo, text, order: 1..3)
  — cap of 3 questions enforced in app code (POST /surveys), not a DB constraint

Response(id, surveyId, userId, orgId, weekStart: date, submittedAt)
  — unique(surveyId, userId, weekStart)
  — weekStart = Monday (UTC) of the calendar week submitted in

Answer(id, responseId, questionId, value: Json)
  — unique(responseId, questionId)
  — value shape depends on the parent Question's type: {"rating": 1-5} or {"yesNo": true|false}
  — validated against Question.type in app code on write, not DB-constrained
```

RLS: `Organization` is the tenant root (not itself RLS-scoped); `User`, `Survey`, `Response` carry `orgId` directly; `Question` and `Answer` have no `orgId` column and are scoped transitively via their parent's `orgId` in the RLS policy (`Question` → `Survey`, `Answer` → `Response`) per [[adr-0001-multi-tenancy-rls]]. See `api/prisma/migrations/20260915120000_init/migration.sql` for the policies.

**Known gap** (tracked in the migration, not yet resolved): RLS policies don't protect against a table-owner or superuser DB role, and docker-compose's single `pulse` Postgres role currently plays both parts. A non-owner runtime role (DML grants only, no ownership) is needed before RLS is a real boundary rather than documentation — see [[adr-0001-multi-tenancy-rls]]'s own stated consequence.

## API / interface surface

| Method | Route | Role | Notes |
|---|---|---|---|
| GET | `/me` | any | Resolves `X-User-Id` → user, org, role |
| POST | `/surveys` | Manager | Create survey + up to 3 questions, for caller's org |
| GET | `/surveys` | Manager | List caller's org's surveys |
| POST | `/surveys/:id/activate` | Manager | Activate; auto-deactivates prior active survey in org |
| GET | `/surveys/active` | Member, Manager | Caller's org's currently active survey (with questions) |
| POST | `/surveys/:id/responses` | Member | Submit response for current calendar week; 409 if one already exists |
| GET | `/surveys/:id/summary` | Manager | Current week: completion count/rate + per-question rollups |

All routes require `X-User-Id`; org is always derived server-side from that user, never taken from the request body/query.

## Non-goals

- Real auth/session management (deferred, see [[adr-0002-header-based-local-auth]]).
- Editing responses, historical summaries, multi-active surveys, survey/question editing post-creation — all named above under Out of scope.
- Org logo storage/serving implementation (design note only).

## Implementation notes

- **Rollup computation happens in app code, not SQL.** Because `Answer.value` is a generic `Json` column rather than typed `ratingValue`/`yesNoValue` columns, Postgres can't `AVG()`/`COUNT()` it directly without per-row JSON-operator casts. The `GET /surveys/:id/summary` handler fetches all `Answer` rows for the current week's `Response`s and computes rating averages / yes-no counts per question in the service layer. Revisit if this becomes a performance concern at scale (a JSON-operator SQL query, or a move to typed columns, are both fallbacks).
- Prisma schema: `api/prisma/schema.prisma`. Initial migration (hand-authored, includes RLS policies not generated by Prisma): `api/prisma/migrations/20260915120000_init/migration.sql`. Prisma is not yet installed in `api/package.json` — run `npm install prisma @prisma/client --prefix api` before applying.
- **Seed data**: `api/prisma/seed.ts`, run via `npm run db:seed --prefix api` (wired through `prisma.config.ts`'s `migrations.seed`, executed directly by Node's native TS stripping — no `ts-node`/`tsx`). Seeds 2 orgs (Acme Robotics, Globex Analytics), 1 Manager + several Members each, 1 active Survey per org, and partial-completion `Response`/`Answer` rows for the current calendar week so the summary endpoint has non-trivial data. Idempotent (deletes prior seeded orgs by name before recreating). Because every tenant-scoped table has `FORCE ROW LEVEL SECURITY`, all writes/deletes run inside a transaction that issues `SET LOCAL app.tenant_id = '<orgId>'` first, mirroring what the real per-request interceptor will need to do.
