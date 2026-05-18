import { Hono } from "hono";
import type { MessageType, SendMessageInput } from "../shared/types";
import { DemoEngine, toSseEvent } from "./demoEngine";

const MESSAGE_TYPES = new Set<MessageType>([
  "status",
  "contract",
  "question",
  "blocker",
  "review",
  "evidence"
]);

function isMessageType(value: unknown): value is MessageType {
  return typeof value === "string" && MESSAGE_TYPES.has(value as MessageType);
}

function parseMessageInput(value: unknown): SendMessageInput | { error: string } {
  if (!value || typeof value !== "object") {
    return { error: "Message payload is required." };
  }

  const payload = value as Record<string, unknown>;
  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  if (!body) {
    return { error: "Message body is required." };
  }

  if (
    typeof payload.from !== "string" ||
    typeof payload.to !== "string" ||
    typeof payload.taskId !== "string" ||
    !isMessageType(payload.type)
  ) {
    return { error: "Message routing fields are invalid." };
  }

  return {
    from: payload.from,
    to: payload.to,
    taskId: payload.taskId,
    type: payload.type,
    body
  };
}

export function createDemoApi() {
  const app = new Hono();
  const engine = new DemoEngine();

  app.get("/api/run", (context) => context.json(engine.snapshot()));

  app.get("/api/events", (context) => context.json(engine.listEvents()));

  app.get("/api/events/stream", () => {
    const encoder = new TextEncoder();
    let unsubscribe: () => void = () => undefined;

    const stream = new ReadableStream({
      start(controller) {
        for (const event of engine.listEvents()) {
          controller.enqueue(encoder.encode(toSseEvent(event)));
        }

        unsubscribe = engine.subscribe((event) => {
          controller.enqueue(encoder.encode(toSseEvent(event)));
        });
      },
      cancel() {
        unsubscribe();
      }
    });

    return new Response(stream, {
      headers: {
        "cache-control": "no-cache",
        "content-type": "text/event-stream; charset=utf-8",
        connection: "keep-alive"
      }
    });
  });

  app.post("/api/demo-run", (context) => context.json(engine.runSimulatedCrew(), 201));

  app.post("/api/messages", async (context) => {
    const payload = await context.req.json().catch(() => null);
    const input = parseMessageInput(payload);

    if ("error" in input) {
      return context.json({ error: input.error }, 400);
    }

    return context.json(engine.sendMessage(input), 201);
  });

  return app;
}
