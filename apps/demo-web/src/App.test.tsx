import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { DemoApiClient, DemoRun } from "./client/demoApiClient";

const demoRun: DemoRun = {
  runId: "run_mock",
  phase: "ready",
  crew: {
    steerer: {
      id: "agent_codex",
      name: "Codex Steerer",
      platform: "codex_cli",
      role: "steerer",
      status: "steering"
    },
    rowers: [
      {
        id: "agent_frontend",
        name: "Frontend Rower",
        platform: "claude_code_cli",
        role: "frontend",
        status: "ready"
      },
      {
        id: "agent_backend",
        name: "Backend Rower",
        platform: "claude_code_cli",
        role: "backend",
        status: "ready"
      },
      {
        id: "agent_qa_ops",
        name: "QA/Ops Rower",
        platform: "claude_code_cli",
        role: "qa_ops",
        status: "watching"
      }
    ]
  },
  tasks: [
    {
      id: "task_frontend",
      title: "Render command deck handoff",
      owner: "agent_frontend",
      lane: "Frontend",
      status: "ready",
      progress: 20
    },
    {
      id: "task_backend",
      title: "Publish API contract",
      owner: "agent_backend",
      lane: "Backend",
      status: "ready",
      progress: 35
    },
    {
      id: "task_qa_ops",
      title: "Verify demo run",
      owner: "agent_qa_ops",
      lane: "QA/Ops",
      status: "watching",
      progress: 45
    }
  ],
  mailbox: [
    {
      id: "msg_seed",
      from: "agent_codex",
      to: "agent_backend",
      taskId: "task_backend",
      type: "status",
      body: "Prepare the first contract handoff for the frontend rower.",
      createdAt: "2026-05-18T09:30:00.000Z"
    }
  ],
  evidence: [
    {
      id: "evidence_seed",
      taskId: "task_qa_ops",
      title: "Baseline checks queued",
      status: "pending"
    }
  ],
  agentLogs: [
    {
      id: "log_seed",
      agentId: "agent_codex",
      line: "Codex prepared the initial task graph.",
      createdAt: "2026-05-18T09:30:00.000Z"
    }
  ],
  events: [
    {
      id: "evt_seed",
      seq: 1,
      runId: "run_mock",
      type: "run.created",
      actor: "agent_system",
      createdAt: "2026-05-18T09:29:00.000Z"
    },
    {
      id: "evt_command",
      seq: 2,
      runId: "run_mock",
      type: "command.output",
      actor: "agent_codex",
      createdAt: "2026-05-18T09:30:00.000Z",
      payload: {
        line: "$ codex exec --profile steerer \"split demo web loop\""
      }
    }
  ]
};

function createFakeClient(): DemoApiClient {
  let currentRun = structuredClone(demoRun);

  return {
    loadRun: vi.fn(async () => currentRun),
    runSimulatedCrew: vi.fn(async () => {
      currentRun = {
        ...currentRun,
        phase: "reviewed",
        tasks: currentRun.tasks.map((task) => ({ ...task, status: "verified", progress: 100 })),
        evidence: [
          ...currentRun.evidence,
          {
            id: "evidence_review",
            taskId: "task_qa_ops",
            title: "Steerer review accepted",
            status: "passed"
          }
        ],
        agentLogs: [
          ...currentRun.agentLogs,
          {
            id: "log_review",
            agentId: "agent_codex",
            line: "Codex approved rower evidence and accepted the run.",
            createdAt: "2026-05-18T09:40:00.000Z"
          }
        ],
        events: [
          ...currentRun.events,
          {
            id: "evt_review",
            seq: currentRun.events.length + 1,
            runId: currentRun.runId,
            type: "steerer.review.completed",
            actor: "agent_codex",
            createdAt: "2026-05-18T09:40:00.000Z"
          }
        ]
      };

      return currentRun;
    }),
    runClaudeWorker: vi.fn(async () => {
      currentRun = {
        ...currentRun,
        tasks: currentRun.tasks.map((task) =>
          task.id === "task_qa_ops" ? { ...task, status: "evidence_submitted", progress: 90 } : task
        ),
        evidence: [
          ...currentRun.evidence,
          {
            id: "evidence_worker",
            taskId: "task_qa_ops",
            title: "Claude worker completed",
            status: "passed"
          }
        ],
        agentLogs: [
          ...currentRun.agentLogs,
          {
            id: "log_worker",
            agentId: "agent_qa_ops",
            line: "[stdout] worker stdout: qa checks passed",
            createdAt: "2026-05-18T09:45:00.000Z"
          }
        ],
        events: [
          ...currentRun.events,
          {
            id: "evt_worker",
            seq: currentRun.events.length + 1,
            runId: currentRun.runId,
            type: "evidence.submitted",
            actor: "agent_qa_ops",
            createdAt: "2026-05-18T09:45:00.000Z",
            payload: {
              title: "Claude worker completed",
              status: "passed"
            }
          }
        ]
      };

      return currentRun;
    }),
    subscribeEvents: vi.fn(() => () => undefined),
    sendMessage: vi.fn(async (input) => {
      currentRun = {
        ...currentRun,
        tasks: currentRun.tasks.map((task) => {
          if (task.id === "task_backend") {
            return { ...task, status: "handoff_sent", progress: 65 };
          }

          if (task.id === "task_frontend") {
            return { ...task, status: "contract_received", progress: 50 };
          }

          return task;
        }),
        mailbox: [
          ...currentRun.mailbox,
          {
            id: "msg_contract",
            createdAt: "2026-05-18T09:35:00.000Z",
            ...input
          }
        ]
      };

      return currentRun;
    })
  };
}

describe("DragonBoat demo command board", () => {
  it("shows the steerer, rowers, tasks, mailbox, and evidence queue", async () => {
    render(<App api={createFakeClient()} />);

    expect(await screen.findByText("Codex Steerer")).toBeInTheDocument();
    expect(screen.getByText("Frontend Rower")).toBeInTheDocument();
    expect(screen.getByText("Backend Rower")).toBeInTheDocument();
    expect(screen.getByText("QA/Ops Rower")).toBeInTheDocument();
    expect(screen.getByText("Render command deck handoff")).toBeInTheDocument();
    expect(screen.getByText("Prepare the first contract handoff for the frontend rower.")).toBeInTheDocument();
    expect(screen.getByText("Baseline checks queued")).toBeInTheDocument();
    expect(screen.getByText("Agent Console")).toBeInTheDocument();
    expect(screen.getByText("Codex prepared the initial task graph.")).toBeInTheDocument();
    expect(screen.getByText("Event Stream")).toBeInTheDocument();
    expect(screen.getByText("run.created")).toBeInTheDocument();
    expect(screen.getByText("$ codex exec --profile steerer \"split demo web loop\"")).toBeInTheDocument();
    expect(
      screen.getByText("command.output").compareDocumentPosition(screen.getByText("run.created")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("records a backend-to-frontend contract from the UI", async () => {
    const user = userEvent.setup();
    const api = createFakeClient();

    render(<App api={api} />);

    await screen.findByText("Codex Steerer");
    await user.click(screen.getByRole("button", { name: "Record backend contract" }));

    await waitFor(() => {
      expect(api.sendMessage).toHaveBeenCalledWith({
        from: "agent_backend",
        to: "agent_frontend",
        taskId: "task_backend",
        type: "contract",
        body: "GET /api/run returns crew, tasks, mailbox, and evidence arrays."
      });
    });

    expect(await screen.findByText("GET /api/run returns crew, tasks, mailbox, and evidence arrays.")).toBeInTheDocument();
    expect(screen.getByText("contract_received")).toBeInTheDocument();
  });

  it("runs a simulated crew timeline from the UI", async () => {
    const user = userEvent.setup();
    const api = createFakeClient();

    render(<App api={api} />);

    await screen.findByText("Codex Steerer");
    await user.click(screen.getByRole("button", { name: "Run simulated crew" }));

    await waitFor(() => {
      expect(api.runSimulatedCrew).toHaveBeenCalledOnce();
    });

    expect(await screen.findByText("Codex approved rower evidence and accepted the run.")).toBeInTheDocument();
    expect(screen.getByText("Steerer review accepted")).toBeInTheDocument();
    expect(screen.getByText("steerer.review.completed")).toBeInTheDocument();
  });

  it("runs a real Claude worker boundary from the UI", async () => {
    const user = userEvent.setup();
    const api = createFakeClient();

    render(<App api={api} />);

    await screen.findByText("Codex Steerer");
    await user.click(screen.getByRole("button", { name: "Run Claude worker" }));

    await waitFor(() => {
      expect(api.runClaudeWorker).toHaveBeenCalledOnce();
    });

    expect(await screen.findByText("[stdout] worker stdout: qa checks passed")).toBeInTheDocument();
    expect(screen.getByText("Claude worker completed")).toBeInTheDocument();
    expect(screen.getByText("evidence_submitted")).toBeInTheDocument();
  });
});
