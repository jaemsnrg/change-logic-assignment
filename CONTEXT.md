# Change Logic — Pulse Surveys

A multi-tenant SaaS where organizations run weekly pulse surveys to their people and see rollup insights.

## Language

**Organization**:
The tenant boundary. Owns its own Users, Surveys, and Responses; no data crosses organizations.
_Avoid_: Tenant, company, account (use Organization in code and API).

**User**:
A person belonging to exactly one Organization, with exactly one role: Manager or Member.
_Avoid_: Account, profile.

**Manager**:
A User role that can create and manage Surveys for their own Organization, and view weekly summaries.
_Avoid_: Admin, owner.

**Member**:
A User role that can view their Organization's active Survey and submit one Response to it per calendar week. Members are the denominator for completion rate — Managers are not counted.
_Avoid_: Employee, respondent (respondent is fine in prose, but code/API use Member).

**Survey**:
A named set of up to three Questions, owned by one Organization. At most one Survey per Organization is active at a time.
_Avoid_: Pulse, poll (Pulse Survey is fine as a product term; "Survey" is the entity name).

**Active survey**:
The single Survey per Organization with `isActive = true`. Activating a Survey auto-deactivates whichever Survey was previously active for that Organization — the invariant is enforced server-side, never left to caller discipline.

**Question**:
One item on a Survey, of type `rating` (1–5) or `yesNo`. A Survey has up to three Questions.

**Response**:
One Member's submission to a Survey for a given calendar week — a parent record with one child Answer per Question. Write-once: once submitted, a Response cannot be edited or resubmitted for that week. Existence of a Response for (member, survey, week) is what "completed this week" means.

**Answer**:
One Question's value within a Response — a rating (1–5) or a yes/no boolean, depending on the Question's type.

**Calendar week**:
Monday–Sunday, UTC. The unit "this week" refers to throughout the app — chosen over a rolling 7-day window for determinism (tests don't depend on "now" drifting) and because it matches the weekly-cadence framing of pulse surveys.

**Completion rate**:
For a Survey's current calendar week: count of Members with a Response, divided by count of Members in the Survey's Organization (Managers excluded from both numerator and denominator).
