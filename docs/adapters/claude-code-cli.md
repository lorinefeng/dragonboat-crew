# Claude Code CLI Adapter Boundary

Claude Code is the initial DragonBoat rower surface for v0.1.

This document defines how DragonBoat should run multiple Claude Code workers while keeping DragonBoat's core semantics cross-platform.

## Role

Claude Code acts as rower workers.

The v0.1 demo uses three rowers:

- frontend rower
- backend rower
- QA/Ops rower

All rowers can use the same local Claude Code configuration. Their identities come from their worktree, session name, task packet, mailbox identity, and evidence bundle.

## Observed Local CLI Surface

On the local machine, `claude --help` exposes the key surfaces DragonBoat needs:

- `-p, --print` for non-interactive output
- `--output-format json` for single structured output
- `--output-format stream-json` for incremental output
- `--json-schema <schema>` for structured final output validation
- `--session-id <uuid>` for stable session identity
- `-n, --name <name>` for readable worker identity
- `--mcp-config <configs...>` for exposing DragonBoat tools
- `--include-hook-events` with `stream-json` for richer lifecycle output
- `--debug-file <path>` for logs
- `--permission-mode <mode>` for execution permissions
- `--worktree [name]` for Claude-managed worktrees

DragonBoat v0.1 should prefer DragonBoat-managed git worktrees for predictable paths and replay. Claude-managed worktrees can remain a future adapter option.

## Invocation Boundary

DragonBoat should run each rower from its assigned worktree:

```bash
cd <rower-worktree>

claude \
  --print \
  --output-format stream-json \
  --json-schema <evidence-bundle-schema> \
  --name <dragonboat-rower-name> \
  --session-id <uuid> \
  --mcp-config <dragonboat-mcp-config> \
  --debug-file <run-log-path> \
  <task-packet-prompt>
```

For the earliest file-polling prototype, `--mcp-config` can be omitted and the task packet can instruct the rower to read and write the local mailbox files. MCP should become the cleaner adapter path once the broker exists.

## Worktree Boundary

Each rower gets:

- one git worktree
- one task packet
- one agent id
- one inbox/outbox stream
- one evidence output path

The rower may inspect the repo and run checks, but it should only modify files allowed by its task packet.

## Plan-First Rule

Each rower must submit a plan before implementation.

The steerer can approve, reject, or revise the plan. This protects v0.1 from uncontrolled parallel edits and makes the desktop trace more understandable.

## Evidence Rule

Each rower must submit an evidence bundle that validates against `dragonboat.evidence_bundle.v0`.

The rower cannot complete with a bare natural-language "done" message.

## Mailbox Boundary

Rower-to-rower communication should flow through DragonBoat, not through ad hoc terminal text.

For v0.1, two delivery paths are acceptable:

- MCP tools such as `send_message`, `poll_inbox`, `report_status`, and `submit_evidence`
- file polling through `.dragonboat/runs/<run_id>/mailbox/`

The event log remains the source of truth in both cases.

## Permissions

The default should be conservative.

DragonBoat should not require global permission bypass. If a fully automated local demo uses permissive mode inside disposable worktrees, the command and risk should be visible in the event log.

## Non-Goals

The v0.1 adapter should not:

- manage Claude Code auth
- change the user's model provider
- assume Anthropic-hosted models
- depend on Claude Code Agent Teams as the core product
- require Claude-specific fields in task packet or evidence schemas
- run multiple rowers inside one shared worktree

## Design Rule

Claude Code is the first rower implementation. DragonBoat's rower contract must remain portable to future Codex, Gemini CLI, OpenCode, OpenClaw, and local-model adapters.
