# DragonBoat Demo Web App

This app is the first practice slice for DragonBoat v0.1.

It is intentionally small: a full-stack command board that proves the basic crew-loop shape before the real DragonBoat runtime exists.

## What It Demonstrates

- Codex appears as the steerer.
- Three Claude Code rowers appear as frontend, backend, and QA/Ops workers.
- The frontend loads a run snapshot from a Hono API.
- The UI can record a backend-to-frontend contract handoff.
- The API updates task status, mailbox timeline, and evidence state.
- The API exposes an ordered local event log and an SSE endpoint.
- The UI shows an agent console and event stream for live cockpit monitoring.
- A simulated crew run button demonstrates the intended realtime flow before real Codex/Claude subprocesses are attached.
- A real Claude worker button invokes the local `claude` CLI with `--print`, records stdout/stderr as `command.output`, and submits `evidence.submitted`.
- Tests cover backend behavior, frontend behavior, and the client-to-API contract.

## Commands

From the repository root:

```bash
npm run demo:dev
npm run demo:test
npm run demo:build
```

The dev server starts:

- frontend: `http://127.0.0.1:5173/`
- API: `http://127.0.0.1:8787`

The real worker smoke path uses the user's existing Claude Code CLI setup. The API accepts a minimal structured task packet:

```bash
curl -X POST http://127.0.0.1:8787/api/worker-run \
  -H 'content-type: application/json' \
  -d '{"prompt":"Report a one-line DragonBoat worker heartbeat."}'
```

DragonBoat passes `prompt` to `claude --print ... <prompt>`. It does not parse free-form Codex prose in this slice; the intended next step is for Codex to emit a structured task packet that DragonBoat can validate.

Override the binary or worker cwd when needed:

```bash
DRAGONBOAT_CLAUDE_BIN=/path/to/claude DRAGONBOAT_WORKER_CWD=/path/to/worktree npm run demo:dev
```

## Why This Came Before The Runtime

The implementation plan starts with schemas and core runtime primitives.

For this slice, we intentionally started with a runnable full-stack mock because DragonBoat's core value needs a visible workflow: crew, tasks, mailbox, evidence, and acceptance flow.

This does not replace the plan. It gives the plan a concrete target to serve.
