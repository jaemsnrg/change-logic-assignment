# Agent workflow:

- agent: Claude CLI

# Resposibilities:

*Kept for myself*
- selection of tech, project layout
- specify guidelines required in CLAUDE.md, and guardrail config

*Delegated to Claude*
- flesh out CLAUDE.md, .claude/settings.json

# AI Workflow
- hard boundaries set at hook / settings level (see .claude/) to block destructive actions
- softer guidelines set in CLAUDE.md to adhere to workflow and architecture decisions
- documented ADRs (docs/adr) aid in guiding agents output
- spec driven development for more complex tasks, spec serves as a contract between agent and I, and is updated as work proceeds, acts as living doc of feature.
- *not in use* - as this is a small, single team project, it does not make sense to use parallel agents with git worktree pattern
