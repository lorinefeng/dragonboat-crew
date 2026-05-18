import { spawn } from "node:child_process";

export type WorkerOutputStream = "stdout" | "stderr";

export interface WorkerCommandInput {
  agentId: string;
  taskId: string;
  name: string;
  prompt: string;
  cwd: string;
}

export interface WorkerOutputChunk {
  stream: WorkerOutputStream;
  line: string;
}

export interface WorkerCommandResult {
  exitCode: number;
  signal?: string;
}

export type WorkerCommandRunner = (
  input: WorkerCommandInput,
  onOutput: (chunk: WorkerOutputChunk) => void
) => Promise<WorkerCommandResult>;

interface ClaudeCodeArgsInput {
  name: string;
  prompt: string;
}

interface ClaudeCodeWorkerRunnerOptions {
  command?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 45_000;

export function buildClaudeCodeArgs(input: ClaudeCodeArgsInput) {
  return [
    "--print",
    "--output-format",
    "text",
    "--name",
    input.name,
    "--no-session-persistence",
    input.prompt
  ];
}

function emitLines(stream: WorkerOutputStream, chunk: Buffer, onOutput: (chunk: WorkerOutputChunk) => void) {
  for (const line of chunk.toString("utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (trimmedLine) {
      onOutput({ stream, line: trimmedLine });
    }
  }
}

export function createClaudeCodeWorkerRunner(options: ClaudeCodeWorkerRunnerOptions = {}): WorkerCommandRunner {
  const command = options.command ?? process.env.DRAGONBOAT_CLAUDE_BIN ?? "claude";
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async (input, onOutput) =>
    new Promise<WorkerCommandResult>((resolve) => {
      const child = spawn(command, buildClaudeCodeArgs(input), {
        cwd: input.cwd,
        env: {
          ...process.env,
          ...options.env
        },
        stdio: ["ignore", "pipe", "pipe"]
      });
      let settled = false;
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        onOutput({
          stream: "stderr",
          line: `Claude worker timed out after ${timeoutMs}ms`
        });
        child.kill("SIGTERM");
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        emitLines("stdout", chunk, onOutput);
      });

      child.stderr.on("data", (chunk: Buffer) => {
        emitLines("stderr", chunk, onOutput);
      });

      child.once("error", (cause) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        onOutput({
          stream: "stderr",
          line: cause.message
        });
        resolve({ exitCode: 127 });
      });

      child.once("close", (code, signal) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        resolve({
          exitCode: code ?? (timedOut ? 124 : 1),
          signal: signal ?? undefined
        });
      });
    });
}
