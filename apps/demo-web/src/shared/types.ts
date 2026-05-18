export type AgentPlatform = "codex_cli" | "claude_code_cli";
export type AgentRole = "steerer" | "frontend" | "backend" | "qa_ops";
export type AgentStatus =
  | "steering"
  | "ready"
  | "watching"
  | "planning"
  | "running"
  | "reviewing"
  | "done"
  | "blocked";
export type TaskStatus =
  | "ready"
  | "watching"
  | "running"
  | "handoff_sent"
  | "contract_received"
  | "evidence_submitted"
  | "reviewed"
  | "verified";
export type MessageType = "status" | "contract" | "question" | "blocker" | "review" | "evidence";
export type EvidenceStatus = "pending" | "passed" | "failed";
export type DemoPhase = "ready" | "running" | "reviewed";
export type DemoEventType =
  | "run.created"
  | "crew.member.status_changed"
  | "task.packet.created"
  | "task.status_changed"
  | "mailbox.message.sent"
  | "command.output"
  | "evidence.submitted"
  | "steerer.review.completed";

export interface CrewMember {
  id: string;
  name: string;
  platform: AgentPlatform;
  role: AgentRole;
  status: AgentStatus;
}

export interface DemoTask {
  id: string;
  title: string;
  owner: string;
  lane: string;
  status: TaskStatus;
  progress: number;
}

export interface MailboxMessage {
  id: string;
  from: string;
  to: string;
  taskId: string;
  type: MessageType;
  body: string;
  createdAt: string;
}

export interface EvidenceItem {
  id: string;
  taskId: string;
  title: string;
  status: EvidenceStatus;
}

export interface AgentLog {
  id: string;
  agentId: string;
  line: string;
  createdAt: string;
}

export interface DemoEvent {
  id: string;
  seq: number;
  runId: string;
  type: DemoEventType;
  actor: string;
  createdAt: string;
  taskId?: string;
  messageId?: string;
  payload?: Record<string, unknown>;
}

export interface DemoRun {
  runId: string;
  phase: DemoPhase;
  crew: {
    steerer: CrewMember;
    rowers: CrewMember[];
  };
  tasks: DemoTask[];
  mailbox: MailboxMessage[];
  evidence: EvidenceItem[];
  agentLogs: AgentLog[];
  events: DemoEvent[];
}

export interface SendMessageInput {
  from: string;
  to: string;
  taskId: string;
  type: MessageType;
  body: string;
}
