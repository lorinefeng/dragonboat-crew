import { createInitialDemoRun } from "../shared/seed";
import type {
  AgentLog,
  AgentStatus,
  DemoEvent,
  DemoEventType,
  DemoRun,
  EvidenceItem,
  MailboxMessage,
  SendMessageInput,
  TaskStatus
} from "../shared/types";
import type { WorkerCommandRunner } from "./claudeWorkerRunner";

type EventSubscriber = (event: DemoEvent) => void;

interface AppendEventInput {
  type: DemoEventType;
  actor: string;
  taskId?: string;
  messageId?: string;
  payload?: Record<string, unknown>;
}

const RUN_ID = "run_demo_web_loop";
const SEED_DATE = "2026-05-18T09:30:00.000Z";
const REAL_WORKER_PROMPT = [
  "You are the DragonBoat QA/Ops rower for the local demo.",
  "Do not modify files.",
  "Return a short evidence note proving the Claude Code worker process ran."
].join(" ");

export interface ClaudeWorkerTask {
  name: string;
  prompt: string;
}

export const DEFAULT_CLAUDE_WORKER_TASK: ClaudeWorkerTask = {
  name: "dragonboat-qa-ops",
  prompt: REAL_WORKER_PROMPT
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" ? value : fallback;
}

function updateTask(run: DemoRun, taskId: string, status: TaskStatus, progress: number): DemoRun {
  return {
    ...run,
    tasks: run.tasks.map((task) => (task.id === taskId ? { ...task, status, progress } : task))
  };
}

function updateCrewStatus(run: DemoRun, agentId: string, status: AgentStatus): DemoRun {
  const updateMember = (member: DemoRun["crew"]["steerer"]) =>
    member.id === agentId ? { ...member, status } : member;

  return {
    ...run,
    crew: {
      steerer: updateMember(run.crew.steerer),
      rowers: run.crew.rowers.map(updateMember)
    }
  };
}

function deriveRun(events: DemoEvent[]): DemoRun {
  let run = createInitialDemoRun();

  for (const event of events) {
    if (event.type === "run.created") {
      run = { ...run, phase: "ready" };
    }

    if (event.type === "crew.member.status_changed") {
      const agentId = asString(event.payload?.agentId);
      const status = asString(event.payload?.status) as AgentStatus;
      run = updateCrewStatus(run, agentId, status);
    }

    if (event.type === "task.status_changed") {
      const status = asString(event.payload?.status) as TaskStatus;
      const progress = asNumber(event.payload?.progress, 0);
      run = updateTask(run, event.taskId ?? "", status, progress);
    }

    if (event.type === "mailbox.message.sent") {
      run = {
        ...run,
        mailbox: [
          ...run.mailbox,
          {
            id: event.messageId ?? event.id.replace("evt_", "msg_"),
            from: asString(event.payload?.from),
            to: asString(event.payload?.to),
            taskId: event.taskId ?? asString(event.payload?.taskId),
            type: asString(event.payload?.messageType) as MailboxMessage["type"],
            body: asString(event.payload?.body),
            createdAt: event.createdAt
          }
        ]
      };
    }

    if (event.type === "command.output") {
      const log: AgentLog = {
        id: event.id.replace("evt_", "log_"),
        agentId: asString(event.payload?.agentId),
        line: asString(event.payload?.line),
        createdAt: event.createdAt
      };
      run = { ...run, agentLogs: [...run.agentLogs, log], phase: "running" };
    }

    if (event.type === "evidence.submitted") {
      const item: EvidenceItem = {
        id: event.id.replace("evt_", "evidence_"),
        taskId: event.taskId ?? asString(event.payload?.taskId),
        title: asString(event.payload?.title),
        status: asString(event.payload?.status) as EvidenceItem["status"]
      };
      run = { ...run, evidence: [...run.evidence, item] };
    }

    if (event.type === "steerer.review.completed") {
      const item: EvidenceItem = {
        id: event.id.replace("evt_", "evidence_"),
        taskId: asString(event.payload?.taskId) || "task_qa_ops",
        title: asString(event.payload?.title),
        status: asString(event.payload?.status) as EvidenceItem["status"]
      };
      run = {
        ...run,
        phase: "reviewed",
        crew: {
          steerer: { ...run.crew.steerer, status: "done" },
          rowers: run.crew.rowers.map((rower) => ({ ...rower, status: "done" }))
        },
        tasks: run.tasks.map((task) => ({ ...task, status: "verified", progress: 100 })),
        evidence: [...run.evidence, item]
      };
    }
  }

  return { ...run, events };
}

export class DemoEngine {
  private events: DemoEvent[] = [];
  private subscribers = new Set<EventSubscriber>();

  constructor() {
    this.appendSeedEvents();
  }

  snapshot(): DemoRun {
    return structuredClone(deriveRun(this.events));
  }

  listEvents(): DemoEvent[] {
    return structuredClone(this.events);
  }

  subscribe(subscriber: EventSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  sendMessage(input: SendMessageInput): DemoRun {
    const messageId = `msg_${this.events.length + 1}`;
    this.append({
      type: "mailbox.message.sent",
      actor: input.from,
      taskId: input.taskId,
      messageId,
      payload: {
        from: input.from,
        to: input.to,
        taskId: input.taskId,
        messageType: input.type,
        body: input.body
      }
    });
    this.appendTaskStatus("task_backend", "agent_backend", "handoff_sent", 65);
    this.appendTaskStatus("task_frontend", "agent_frontend", "contract_received", 50);
    this.append({
      type: "evidence.submitted",
      actor: "agent_qa_ops",
      taskId: "task_qa_ops",
      payload: {
        title: "Backend contract handoff recorded",
        status: "passed"
      }
    });

    return this.snapshot();
  }

  runSimulatedCrew(): DemoRun {
    this.append({
      type: "crew.member.status_changed",
      actor: "agent_codex",
      payload: {
        agentId: "agent_codex",
        status: "planning"
      }
    });
    this.appendCommand("agent_codex", "$ codex exec --profile steerer \"split demo web loop\"");
    this.appendCommand("agent_codex", "Codex split the run into frontend, backend, and QA/Ops rower tasks.");
    this.appendTaskStatus("task_backend", "agent_backend", "running", 55);
    this.appendCommand("agent_backend", "$ claude --agent backend --run \"publish /api/run contract\"");
    this.appendCommand("agent_backend", "Backend Rower published the /api/run contract for the frontend.");
    this.sendMessage({
      from: "agent_backend",
      to: "agent_frontend",
      taskId: "task_backend",
      type: "contract",
      body: "GET /api/run returns crew, tasks, mailbox, and evidence arrays."
    });
    this.appendTaskStatus("task_frontend", "agent_frontend", "running", 70);
    this.appendCommand("agent_frontend", "$ claude --agent frontend --run \"render command deck from /api/run\"");
    this.appendCommand("agent_frontend", "Frontend Rower rendered the command deck state from the API contract.");
    this.appendTaskStatus("task_qa_ops", "agent_qa_ops", "running", 82);
    this.appendCommand("agent_qa_ops", "$ claude --agent qa_ops --run \"npm run demo:test && npm run demo:build\"");
    this.appendCommand("agent_qa_ops", "QA/Ops Rower verified the handoff path and evidence queue.");
    this.appendCommand("agent_qa_ops", "demo:test passed; demo:build completed");
    this.append({
      type: "evidence.submitted",
      actor: "agent_qa_ops",
      taskId: "task_qa_ops",
      payload: {
        title: "QA/Ops checks passed",
        status: "passed"
      }
    });
    this.appendCommand("agent_codex", "Codex approved rower evidence and accepted the run.");
    this.append({
      type: "steerer.review.completed",
      actor: "agent_codex",
      payload: {
        taskId: "task_qa_ops",
        title: "Steerer review accepted",
        status: "passed"
      }
    });

    return this.snapshot();
  }

  async runClaudeWorker(
    workerRunner: WorkerCommandRunner,
    cwd: string,
    task: ClaudeWorkerTask = DEFAULT_CLAUDE_WORKER_TASK
  ): Promise<DemoRun> {
    this.append({
      type: "crew.member.status_changed",
      actor: "agent_codex",
      payload: {
        agentId: "agent_codex",
        status: "planning"
      }
    });
    this.appendCommand("agent_codex", "Codex steerer dispatching Claude Code QA/Ops worker.");
    this.append({
      type: "crew.member.status_changed",
      actor: "agent_qa_ops",
      payload: {
        agentId: "agent_qa_ops",
        status: "running"
      }
    });
    this.appendTaskStatus("task_qa_ops", "agent_qa_ops", "running", 65);
    this.appendCommand("agent_qa_ops", `$ claude --print --output-format text --name ${task.name}`);

    const result = await workerRunner(
      {
        agentId: "agent_qa_ops",
        taskId: "task_qa_ops",
        name: task.name,
        prompt: task.prompt,
        cwd
      },
      (chunk) => {
        this.appendCommand("agent_qa_ops", `[${chunk.stream}] ${chunk.line}`);
      }
    );
    const passed = result.exitCode === 0;

    this.appendTaskStatus("task_qa_ops", "agent_qa_ops", "evidence_submitted", passed ? 90 : 75);
    this.append({
      type: "crew.member.status_changed",
      actor: "agent_codex",
      payload: {
        agentId: "agent_codex",
        status: "reviewing"
      }
    });
    this.append({
      type: "crew.member.status_changed",
      actor: "agent_qa_ops",
      payload: {
        agentId: "agent_qa_ops",
        status: passed ? "done" : "blocked"
      }
    });
    this.append({
      type: "evidence.submitted",
      actor: "agent_qa_ops",
      taskId: "task_qa_ops",
      payload: {
        title: passed ? "Claude worker completed" : "Claude worker failed",
        status: passed ? "passed" : "failed",
        exitCode: result.exitCode,
        signal: result.signal
      }
    });

    return this.snapshot();
  }

  private appendSeedEvents() {
    this.append({
      type: "run.created",
      actor: "agent_system",
      payload: {
        title: "DragonBoat demo web loop"
      }
    });
    this.append({
      type: "task.packet.created",
      actor: "agent_codex",
      taskId: "task_frontend",
      payload: {
        title: "Render command deck handoff"
      }
    });
    this.append({
      type: "task.packet.created",
      actor: "agent_codex",
      taskId: "task_backend",
      payload: {
        title: "Publish API contract"
      }
    });
    this.append({
      type: "mailbox.message.sent",
      actor: "agent_codex",
      taskId: "task_backend",
      messageId: "msg_seed",
      payload: {
        from: "agent_codex",
        to: "agent_backend",
        taskId: "task_backend",
        messageType: "status",
        body: "Prepare the first contract handoff for the frontend rower."
      }
    });
  }

  private appendTaskStatus(taskId: string, actor: string, status: TaskStatus, progress: number) {
    this.append({
      type: "task.status_changed",
      actor,
      taskId,
      payload: {
        status,
        progress
      }
    });
  }

  private appendCommand(agentId: string, line: string) {
    this.append({
      type: "command.output",
      actor: agentId,
      payload: {
        agentId,
        line
      }
    });
  }

  private append(input: AppendEventInput): DemoEvent {
    const seq = this.events.length + 1;
    const event: DemoEvent = {
      id: `evt_${String(seq).padStart(4, "0")}`,
      seq,
      runId: RUN_ID,
      createdAt: SEED_DATE,
      ...input
    };

    this.events = [...this.events, event];
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }

    return event;
  }
}

export function toSseEvent(event: DemoEvent): string {
  return `event: dragonboat-event\ndata: ${JSON.stringify(event)}\n\n`;
}
