# change-logic-assignment

A multi-tenant survey app. See `specs/overall.md` for the domain/feature spec and `docs/adr/` for architecture decisions.

## Architecture

- Frontend (`/client`) — React (TS) + Vite
- Backend (`/api`) — NestJS (TS) + Vite
- DB (`docker-compose.yml`) — Postgres 16 (alpine), in Docker

## Development

*Runs install / dev across front and backend*
```sh
npm run install:all
npm run dev
```

Starts the API (http://localhost:3000) and client (http://localhost:5173) concurrently.

*Other useful scripts:*

while checked out in /api directory (backend):
- `npm run db:up` / `npm run db:down` — start/stop the Postgres container
- `npx prisma migrate dev` — apply pending migrations to your local dev database
- `npm run db:seed` — populate dummy orgs/users/surveys/responses for local dev (also resets if required)
