import { describe, expect, it } from "vitest";
import { buildClaudeCodeArgs } from "./claudeWorkerRunner";

describe("Claude Code worker runner", () => {
  it("builds a non-interactive Claude Code command without touching user configuration", () => {
    expect(
      buildClaudeCodeArgs({
        name: "dragonboat-qa-ops",
        prompt: "Return one evidence line."
      })
    ).toEqual([
      "--print",
      "--output-format",
      "text",
      "--name",
      "dragonboat-qa-ops",
      "--no-session-persistence",
      "Return one evidence line."
    ]);
  });
});
