import { afterAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

// Schema-level regression test (adr-0001): fails the moment a tenant-scoped
// table is added/migrated without RLS wired up, regardless of which
// endpoint (if any) exercises it. Complements the per-endpoint isolation
// assertions in the other *.e2e-spec.ts files, which only catch a missing
// `orgId` filter on tables they happen to cover.

// "organizations" is the tenant root and is intentionally not RLS-scoped
// (see schema.prisma and adr-0001) — everything else in `public` must be.
const EXCLUDED_TABLES = new Set(['organizations', '_prisma_migrations']);

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows: tableRows } = await client.query<{ tablename: string }>(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
);
const tenantTables = tableRows.map((t) => t.tablename).filter((name) => !EXCLUDED_TABLES.has(name));

describe('Row-level security policy coverage (e2e)', () => {
  afterAll(async () => {
    await client.end();
  });

  // Guards against this test silently checking nothing if schema
  // introspection ever breaks or the migration set changes shape.
  it('found at least one tenant-scoped table to check', () => {
    expect(tenantTables.length).toBeGreaterThan(0);
  });

  it.each(tenantTables)('%s has row-level security enabled and forced', async (tableName) => {
    const { rows } = await client.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname = $1 AND relnamespace = 'public'::regnamespace`,
      [tableName],
    );

    expect(rows[0]?.relrowsecurity, `${tableName}: ENABLE ROW LEVEL SECURITY is missing`).toBe(true);
    expect(rows[0]?.relforcerowsecurity, `${tableName}: FORCE ROW LEVEL SECURITY is missing`).toBe(true);
  });

  it.each(tenantTables)('%s has at least one RLS policy', async (tableName) => {
    const { rows } = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM pg_policies WHERE tablename = $1`,
      [tableName],
    );

    expect(Number(rows[0]?.count ?? '0'), `${tableName}: no RLS policy defined`).toBeGreaterThan(0);
  });

  it('runtime role (pulse_app) cannot bypass RLS', async () => {
    const { rows } = await client.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'pulse_app'`,
    );

    expect(rows[0], 'pulse_app role does not exist').toBeDefined();
    expect(rows[0].rolsuper, 'pulse_app must not be a superuser — it would bypass RLS entirely').toBe(false);
    expect(rows[0].rolbypassrls, 'pulse_app must not have BYPASSRLS — it would bypass RLS entirely').toBe(false);
  });
});
