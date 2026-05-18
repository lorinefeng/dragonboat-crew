import { describe, expect, it } from "vitest";
import { createDemoApi } from "./demoApi";

describe("DragonBoat demo API", () => {
  it("returns a crew run with Codex steering three Claude Code rowers", async () => {
    const app = createDemoApi();

    const response = await app.request("/api/run");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.crew.steerer.platform).toBe("codex_cli");
    expect(body.crew.rowers).toHaveLength(3);
    expect(body.crew.rowers.map((rower: { role: string }) => rower.role)).toEqual([
      "frontend",
      "backend",
      "qa_ops"
    ]);
    expect(body.tasks.map((task: { owner: string }) => task.owner)).toEqual([
      "agent_frontend",
      "agent_backend",
      "agent_qa_ops"
    ]);
  });

  it("records a backend contract handoff and exposes it in the mailbox timeline", async () => {
    const app = createDemoApi();

    const response = await app.request("/api/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: "agent_backend",
        to: "agent_frontend",
        taskId: "task_backend",
        type: "contract",
        body: "GET /api/run returns crew, tasks, mailbox, and evidence arrays."
      })
    });

    expect(response.status).toBe(201);

    const snapshot = await app.request("/api/run");
    const body = await snapshot.json();

    expect(body.mailbox).toHaveLength(2);
    expect(body.mailbox.at(-1)).toMatchObject({
      from: "agent_backend",
      to: "agent_frontend",
      type: "contract"
    });
    expect(body.tasks.find((task: { id: string }) => task.id === "task_backend")).toMatchObject({
      status: "handoff_sent"
    });
    expect(body.tasks.find((task: { id: string }) => task.id === "task_frontend")).toMatchObject({
      status: "contract_received"
    });
  });

  it("exposes an ordered local event log for command deck replay", async () => {
    const app = createDemoApi();

    const response = await app.request("/api/events");
    const events = await response.json();

    expect(response.status).toBe(200);
    expect(events.at(0)).toMatchObject({
      seq: 1,
      type: "run.created",
      runId: "run_demo_web_loop"
    });
    expect(events.map((event: { seq: number }) => event.seq)).toEqual([1, 2, 3, 4]);
  });

  it("runs a simulated crew timeline with console output and final review evidence", async () => {
    const app = createDemoApi();

    const response = await app.request("/api/demo-run", {
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.agentLogs.map((log: { agentId: string }) => log.agentId)).toContain("agent_codex");
    expect(body.agentLogs.map((log: { agentId: string }) => log.agentId)).toContain("agent_frontend");
    expect(body.agentLogs.map((log: { agentId: string }) => log.agentId)).toContain("agent_backend");
    expect(body.agentLogs.map((log: { agentId: string }) => log.agentId)).toContain("agent_qa_ops");
    expect(body.agentLogs.map((log: { line: string }) => log.line)).toContain(
      "$ claude --agent qa_ops --run \"npm run demo:test && npm run demo:build\""
    );
    expect(body.evidence.at(-1)).toMatchObject({
      title: "Steerer review accepted",
      status: "passed"
    });

    const eventsResponse = await app.request("/api/events");
    const events = await eventsResponse.json();

    expect(events.map((event: { type: string }) => event.type)).toContain("command.output");
    expect(events.at(-1)).toMatchObject({
      type: "steerer.review.completed"
    });
  });

  it("runs a Claude Code worker and records stdout, stderr, and evidence", async () => {
    const app = createDemoApi({
      workerRunner: async (input, onOutput) => {
        expect(input.agentId).toBe("agent_qa_ops");
        expect(input.taskId).toBe("task_qa_ops");
        expect(input.prompt).toContain("DragonBoat");

        onOutput({
          stream: "stdout",
          line: "worker stdout: qa checks passed"
        });
        onOutput({
          stream: "stderr",
          line: "worker stderr: no files changed"
        });

        return {
          exitCode: 0
        };
      }
    });

    const response = await app.request("/api/worker-run", {
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.agentLogs.map((log: { line: string }) => log.line)).toContain(
      "[stdout] worker stdout: qa checks passed"
    );
    expect(body.agentLogs.map((log: { line: string }) => log.line)).toContain(
      "[stderr] worker stderr: no files changed"
    );
    expect(body.evidence.at(-1)).toMatchObject({
      title: "Claude worker completed",
      status: "passed"
    });
    expect(body.crew.steerer.status).toBe("reviewing");

    const eventsResponse = await app.request("/api/events");
    const events = await eventsResponse.json();

    expect(events.map((event: { type: string }) => event.type)).toContain("command.output");
    expect(events.at(-1)).toMatchObject({
      actor: "agent_qa_ops",
      type: "evidence.submitted"
    });
  });

  it("passes a structured task packet prompt into the Claude Code worker", async () => {
    const app = createDemoApi({
      workerRunner: async (input, onOutput) => {
        expect(input.prompt).toBe("Report a one-line DragonBoat worker heartbeat.");

        onOutput({
          stream: "stdout",
          line: "worker stdout: custom prompt received"
        });

        return {
          exitCode: 0
        };
      }
    });

    const response = await app.request("/api/worker-run", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        prompt: "Report a one-line DragonBoat worker heartbeat."
      })
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.agentLogs.map((log: { line: string }) => log.line)).toContain(
      "[stdout] worker stdout: custom prompt received"
    );
  });

  it("rejects blank Claude worker task prompts", async () => {
    const app = createDemoApi();

    const response = await app.request("/api/worker-run", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        prompt: "  "
      })
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Worker task prompt cannot be blank.");
  });

  it("rejects malformed Claude worker task prompts", async () => {
    const app = createDemoApi();

    const response = await app.request("/api/worker-run", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        prompt: 42
      })
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Worker task prompt must be a string.");
  });

  it("serves an SSE endpoint for live cockpit updates", async () => {
    const app = createDemoApi();

    const response = await app.request("/api/events/stream");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
  });

  it("rejects blank mailbox handoffs so rowers cannot emit empty coordination events", async () => {
    const app = createDemoApi();

    const response = await app.request("/api/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: "agent_backend",
        to: "agent_frontend",
        taskId: "task_backend",
        type: "contract",
        body: "   "
      })
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Message body is required.");
  });
});
