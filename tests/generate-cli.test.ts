import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("generate CLI", () => {
  it("prints a human-readable tool preview", async () => {
    const { stdout } = await execFileAsync("node", [
      "dist/cli/index.js",
      "generate",
      "./examples/simple-openapi.yaml"
    ]);

    expect(stdout).toContain("Generated tools: 2");
    expect(stdout).toContain("list_users");
    expect(stdout).toContain("GET /users");
    expect(stdout).toContain("Safety: SAFE_READ");
  });

  it("prints JSON tool definitions", async () => {
    const { stdout } = await execFileAsync("node", [
      "dist/cli/index.js",
      "generate",
      "./examples/simple-openapi.yaml",
      "--json"
    ]);

    const tools = JSON.parse(stdout) as Array<{ name: string; inputSchema: unknown }>;

    expect(tools).toHaveLength(2);
    expect(tools[0]?.name).toBe("list_users");
    expect(tools[0]?.inputSchema).toBeDefined();
  });

  it("honors read-only filtering", async () => {
    const { stdout } = await execFileAsync("node", [
      "dist/cli/index.js",
      "generate",
      "./examples/risky-crm-api.yaml",
      "--read-only"
    ]);

    expect(stdout).toContain("Generated tools: 1");
    expect(stdout).toContain("GET /contacts");
    expect(stdout).not.toContain("POST /contacts");
    expect(stdout).not.toContain("DELETE /contacts/{id}");
  });
});
