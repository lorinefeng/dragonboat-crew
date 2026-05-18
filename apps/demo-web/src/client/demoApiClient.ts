import type { DemoEvent, DemoRun, SendMessageInput } from "../shared/types";

export type { DemoEvent, DemoRun, SendMessageInput } from "../shared/types";

export interface DemoApiClient {
  loadRun(): Promise<DemoRun>;
  sendMessage(input: SendMessageInput): Promise<DemoRun>;
  runSimulatedCrew(): Promise<DemoRun>;
  runClaudeWorker(): Promise<DemoRun>;
  subscribeEvents?(onEvent: (event: DemoEvent) => void): () => void;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    const message = typeof body.error === "string" ? body.error : "Request failed.";
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function endpoint(baseUrl: string, path: string) {
  return baseUrl ? new URL(path, baseUrl).toString() : path;
}

export function createHttpDemoApiClient(fetcher: Fetcher = fetch, baseUrl = ""): DemoApiClient {
  return {
    async loadRun() {
      const response = await fetcher(endpoint(baseUrl, "/api/run"));
      return readJson<DemoRun>(response);
    },

    async sendMessage(input) {
      const response = await fetcher(endpoint(baseUrl, "/api/messages"), {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(input)
      });

      return readJson<DemoRun>(response);
    },

    async runSimulatedCrew() {
      const response = await fetcher(endpoint(baseUrl, "/api/demo-run"), {
        method: "POST"
      });

      return readJson<DemoRun>(response);
    },

    async runClaudeWorker() {
      const response = await fetcher(endpoint(baseUrl, "/api/worker-run"), {
        method: "POST"
      });

      return readJson<DemoRun>(response);
    },

    subscribeEvents(onEvent) {
      if (baseUrl || typeof EventSource === "undefined") {
        return () => undefined;
      }

      const source = new EventSource("/api/events/stream");

      source.addEventListener("dragonboat-event", (message) => {
        onEvent(JSON.parse(message.data) as DemoEvent);
      });

      return () => {
        source.close();
      };
    }
  };
}

export const httpDemoApiClient: DemoApiClient = createHttpDemoApiClient();
