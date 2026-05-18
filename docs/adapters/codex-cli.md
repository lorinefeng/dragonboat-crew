# Codex CLI Adapter Boundary

Codex is the initial DragonBoat steerer for v0.1.

This document defines how DragonBoat should use Codex without making Codex the whole product.

## Role

Codex acts as the steerer.

It should:

- read the user's goal
- inspect the local repo
- produce or revise a task graph
- create task packets
- approve rower plans
- review evidence bundles
- make the final acceptance recommendation

## Observed Local CLI Surface

On the local machine, `codex exec --help` exposes the key surfaces DragonBoat needs:

- `codex exec` for non-interactive runs
- `--json` for JSONL event output
- `--output-schema <FILE>` for structured final output
- `-o, --output-last-message <FILE>` for saving the final message
- `-C, --cd <DIR>` for setting the working root
- `-m, --model <MODEL>` for model selection
- `-p, --profile <CONFIG_PROFILE>` for user-owned configuration profiles

DragonBoat should prefer user-owned profiles for model and reasoning configuration. For the v0.1 demo, the intended steerer setup is GPT-5.5 with xhigh reasoning, but the adapter should not hard-code credentials or account assumptions.

## Invocation Boundary

DragonBoat may generate a steerer prompt and run Codex in one of two modes:

```bash
codex exec \
  --json \
  --cd <repo> \
  --profile <dragonboat-steerer-profile> \
  --output-schema <schema> \
  --output-last-message <file> \
  <prompt>
```

or:

```bash
codex exec \
  --json \
  --cd <repo> \
  --model <model-from-user-config> \
  --output-schema <schema> \
  --output-last-message <file> \
  <prompt>
```

The profile form is preferred because the user owns model, effort, approval, and provider choices.

## What DragonBoat Records

DragonBoat should record:

- adapter name
- command path
- working directory
- selected profile or model label
- start and finish timestamps
- exit code
- JSONL output path
- final response path

DragonBoat must not record secrets, API keys, bearer tokens, or private provider configuration.

## What Codex Should Produce

The steerer output should be structured:

- run plan
- crew roles
- task packets
- plan approvals or rejections
- final review
- acceptance decision

Codex should not be the source of truth for event storage. DragonBoat writes events after validating Codex output.

## Non-Goals

The v0.1 adapter should not:

- manage Codex login
- update Codex
- rewrite user Codex config
- depend on interactive TUI behavior
- require Codex-specific semantics in task packet or evidence schemas
- hide approval or sandbox behavior from the user

## Design Rule

Codex is the first steerer implementation. DragonBoat's core model must still make sense if another user chooses Claude Code, Gemini CLI, OpenCode, or a future tool as steerer.
