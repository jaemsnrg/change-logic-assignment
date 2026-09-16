# api

NestJS + Prisma backend, Postgres with Row-Level Security ([adr-0001](../docs/adr/adr-0001-multi-tenancy-rls.md)).

## Development

```sh
npm install
npm run start:dev
```

See the root `README.md` to run this alongside the client and DB.

## Tests

```sh
npm run test       # unit
npm run test:e2e   # e2e, requires the Postgres container running
npm run test:cov   # coverage
```

## Database

```sh
npx prisma migrate dev        # apply pending migrations
npm run db:seed               # seed dummy orgs/users/surveys/responses
```
