# Agent workflow:

- agent: Claude CLI

# Resposibilities:

*Kept for myself*
- writing in this document
- selection of tech, project layout
- specify guidelines required in CLAUDE.md, and guardrail config
- decisions about ambiguous requirements from assignment brief
- model the data schema in rough
- research of conventions and their subsequent tradeoffs (eg code vs RLS enforcement of multi-tenancy)

*Delegated to Claude*
- write out CLAUDE.md, .claude/settings.json based on my requirements
- after resolving questions of ambiguity around function, draft spec files for my approval
- interrogate my draft schema, and generate models and migrations based on exploration

# AI Workflow

## principles
- workflow uses documents clarifying requirements (xxx-specs), terminology (context.md) and decisions (ADRs). Specs live in commits / branches alongside the work. Amendments to documents are documented, along with decision. Addresses:
  - *implementation drift*: clarification is complete upfront, with verification against spec file, tests, and code output
  - *token spend*: spec files live as decision "artifacts" alongside feature implementation. Less spend on inference from code and commits. Less back-and-forth with implementations and creating requirements through conversation

## implementation
- hard boundaries set at hook / settings level (see .claude/) to block destructive actions
- softer guidelines set in CLAUDE.md to adhere to workflow and architecture decisions
- spec driven development for feature work, and mapped to the work via commit/branching
- commit/branching syntax allows cheap scanning of spec implemetation
- *skill use*: 
  - *grill-with-docs skill (by Matt Pocock)*: used to clarify and document requirements, as well as catch edge cases, and unconsidered implementation / feature aspects
  - *nestjs-expert*: adds layer of familiarity with key nestjs patterns
  - *domain modeling*:
- *supporting documentation*: 

- *not in use* - as this is a small, single team project, it does not make sense to use parallel agents with git worktree pattern


## Design / decision tradeoffs:
  - enforcement of multi-tenant architecture needs to be weighted to the needs of the project. I chose to use RLS as well as a orgId check. Tradeoffs considered:
    - code feels like a more natural place for this decision logic, but enforcement is less universal (scripts, third party access, etc.)
    - both patterns require some behavior to enforce it: either adding the orgId filter or the rule in the schema + interceptor. Of course a slip up on the org filter means a data breach, while a slip up on RLS is a data breach
    - if performance becomes a consideration in a setting with low security risk, code enforcement may be more suitible
    - choice of ORM based on functionality with RLS - Prisma does not have much support for it

## AI checking catches
  - agent attempts to write member check directly into controller, as this is to be used elsewhere, I think it is better written as a Guard
  - RLS enforcement found as raw SQL in interceptor, this was later found to be a limitation with Prisma's ability to implement it 
  - ensure null values not well handled in UI, had to map them to their meaning - eg. "No user submission"
  - strange decisions around code style in React: not using es6 functions, favouring loops over higher order functions etc.

## deployment to AWS
  - FE - deploy using Amplify + Github Actions when merging into target branch after CI/CD success
  - BE - NestJS Containerized and deployed to ECS on Fargate. Would need to configure load balancing, and autoscaling
  - DB - Managed RDS instance
  - Hosting company Logos - Store in private s3 bucket for cheap reads, backend serves short-lived, presigined urls for access

## ai conversation logging
  - see `./ai-logs` directory

# objectives:

### task 1: Multi-Tenant Pulse Surveys (Backend)
  - [x] pulse surveys managed by manager users at organisational level
  - [x] 1 - 5 rating, yes/no
  - [x] surveys support up to three questions
  - [-] managers can create and manage surveys for their own organization (limited to viewing + seeded creation to save time)
  - [x] members can submit one response per active week for a given survey
  - [x] 7-day/weekly summary: overall completion count and completion rate (vs. org member count)
  - [x] per-question report: rating -> average + count
  - [x] per-question report: yes/no -> counts per option
  - [x] strict data isolation across organizations enforced
  - [x] seed data for at least two organizations and a few users per role
  - [x] local-friendly way to identify current user/org (token, session, or header)

### task 2: Minimal React App (Essential Flows)
  - [x] member: view own organization's active survey
  - [x] member: submit a response
  - [x] manager: view 7-day/weekly summary for a survey
  - [x] demo flow includes at least two organizations showing isolation
  - [x] simple local "log in" (e.g. selecting a seeded user)

### task 3: Production Readiness on AWS (design-only, in SOLUTION.md)
  - [x] backend deployment approach (app container service, managed Postgres, static FE hosting)
  - [x] approach to storing/serving org logo image (bandwidth/cost minimization, secure access)
  - [x] tenancy, security, and scaling considerations prioritized

### task 4: AI-Assisted Delivery
  - [x] SOLUTION.md: end-to-end AI workflow (tools, task setup, breakdown, delegation, review/iteration, what to change next time)
  - [x] agent instructions file committed (CLAUDE.md) reflecting project constraints
  - [x] spec/plan committed before implementation commits
  - [x] SOLUTION.md: how AI output was validated (checked, rejected/rewrote, correctness)
  - [x] ai-logs/ folder with AI session transcripts (or explanation if tool can't export)

### deliverables
  - [x] single GitHub repo with all source code
  - [x] README.md with local run instructions
  - [x] SOLUTION.md covering design/trade-offs, AWS design note, AI workflow + validation
  - [x] ai-logs/ folder with session transcripts
  - [x] commit history showing progression (not squashed)
  - [x] video demo (5-10 min): working project walkthrough, architecture, design decisions/trade-offs, AI workflow in action incl. a correction/rejection
