#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"
command="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"

if [ -z "$command" ]; then
  exit 0
fi

patterns=(
  'DROP[[:space:]]+(TABLE|DATABASE|SCHEMA|INDEX|VIEW)'
  'TRUNCATE[[:space:]]+TABLE'
  'DELETE[[:space:]]+FROM'
  'UPDATE[[:space:]].*SET[[:space:]]'
  'prisma[[:space:]]+migrate[[:space:]]+reset'
  'prisma[[:space:]]+db[[:space:]]+push[[:space:]]+--force-reset'
  'rm[[:space:]]+-rf([[:space:]]|$)'
)

for pattern in "${patterns[@]}"; do
  if printf '%s' "$command" | grep -Eqi "$pattern"; then
    reason="Blocked potentially destructive database/filesystem command (matched: $pattern)"
    jq -n --arg reason "$reason" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: $reason
      }
    }'
    exit 0
  fi
done

exit 0
