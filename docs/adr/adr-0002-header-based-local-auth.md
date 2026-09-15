# ADR-0002: Header-based local auth (no real identity provider)

## Status

Accepted — 2026-09-15

## Context

The assignment requires the app to run locally "without external identity providers or paid cloud services," and only needs a "local-friendly way to identify the current user and organization." This is a take-home vetting slice, not a production auth system — but the choice still needs to be deliberate and its limits explicit, since a reviewer (or future engineer) will otherwise wonder why there's no login/session handling.

## Decision

The API trusts an `X-User-Id` request header naming a seeded `User.id`. A NestJS middleware/guard looks that user up in the database on every request, and derives `orgId` and `role` server-side from that lookup — the client never asserts org or role directly, only which seeded user it's acting as. The derived `orgId` is what gets passed into the RLS transaction wrapper from [[ADR-0001]], so a client cannot spoof its way into another organization's data by sending an arbitrary header value; it can only impersonate a user, and only as far as that user's real org/role permit.

The client "login" is a picker over seeded users, storing the chosen user id in `localStorage` and sending it as the header.

## Consequences

- No password, session, or token — anyone with API access can act as any user by guessing/enumerating a `User.id`. Acceptable for a local take-home demo; **not** acceptable to ship as-is.
- Before any real deployment this must be replaced with real session/JWT-based auth backed by an identity provider — noted in SOLUTION.md's AWS design section as a first-priority gap, not a nice-to-have.
- Keeps the RLS/tenant-isolation story ([[ADR-0001]]) intact: the trust boundary is "which user," not "which org," so tenant spoofing is still prevented even though user identity is not authenticated.
