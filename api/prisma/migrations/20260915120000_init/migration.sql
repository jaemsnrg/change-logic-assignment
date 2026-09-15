-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Manager', 'Member');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('rating', 'yesNo');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responses" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_orgId_idx" ON "users"("orgId");

-- CreateIndex
CREATE INDEX "surveys_orgId_idx" ON "surveys"("orgId");

-- CreateIndex
CREATE INDEX "surveys_orgId_isActive_idx" ON "surveys"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "questions_surveyId_idx" ON "questions"("surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "responses_surveyId_userId_weekStart_key" ON "responses"("surveyId", "userId", "weekStart");

-- CreateIndex
CREATE INDEX "responses_orgId_idx" ON "responses"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "answers_responseId_questionId_key" ON "answers"("responseId", "questionId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "responses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================
-- Row-Level Security (docs/adr/adr-0001-multi-tenancy-rls.md)
--
-- Tenant context is set per-request via `SET LOCAL app.tenant_id = '<orgId>'`
-- inside a transaction (NestJS interceptor/middleware — not part of this
-- migration). current_setting(..., true) returns NULL when unset, which
-- makes every policy below evaluate to false/NULL — i.e. deny by default —
-- for any query that reaches the DB without tenant context set.
--
-- "organizations" is the tenant root and is intentionally NOT RLS-scoped.
--
-- KNOWN GAP (tracked, not resolved by this migration): RLS policies do not
-- protect against a table owner or superuser role. docker-compose's single
-- "pulse" Postgres role currently both owns these tables and would be used
-- as the app's runtime role, which — per the ADR's own stated consequence —
-- means RLS provides no real protection yet. This needs a separate
-- non-owner runtime role (GRANT SELECT/INSERT/UPDATE/DELETE only, no
-- ownership) before RLS is a real boundary rather than documentation.
-- FORCE ROW LEVEL SECURITY is applied below as defense-in-depth regardless.
-- =====================================================================

-- users
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "users"
  USING ("orgId" = current_setting('app.tenant_id', true));

-- surveys
ALTER TABLE "surveys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "surveys" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "surveys"
  USING ("orgId" = current_setting('app.tenant_id', true));

-- responses
ALTER TABLE "responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "responses" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "responses"
  USING ("orgId" = current_setting('app.tenant_id', true));

-- questions — no direct orgId column; scoped transitively via parent Survey
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "questions"
  USING (
    EXISTS (
      SELECT 1 FROM "surveys" s
      WHERE s."id" = "questions"."surveyId"
        AND s."orgId" = current_setting('app.tenant_id', true)
    )
  );

-- answers — no direct orgId column; scoped transitively via parent Response
ALTER TABLE "answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "answers" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "answers"
  USING (
    EXISTS (
      SELECT 1 FROM "responses" r
      WHERE r."id" = "answers"."responseId"
        AND r."orgId" = current_setting('app.tenant_id', true)
    )
  );
