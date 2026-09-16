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
- *supporting documentation*: 

- *not in use* - as this is a small, single team project, it does not make sense to use parallel agents with git worktree pattern
