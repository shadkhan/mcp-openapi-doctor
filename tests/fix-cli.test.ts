import { execFile } from "node:child_process";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("fix CLI", () => {
  it("writes advisory outputs without modifying the original spec", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "openapi-doctor-fix-"));
    const specPath = join(workDir, "broken-openapi.yaml");
    const outDir = join(workDir, ".output");
    const originalSpec = [
      "openapi: 3.0.3",
      "info:",
      "  title: Broken API",
      "  version: 1.0.0",
      "paths:",
      "  /users/{id}:",
      "    get:",
      "      parameters:",
      "        - name: id",
      "          in: path",
      "          required: true",
      "          schema:",
      "            type: string",
      "      responses:",
      "        '200':",
      "          description: OK",
      "  /users:",
      "    post:",
      "      responses:",
      "        '200':",
      "          description: OK",
      ""
    ].join("\n");

    await writeFile(specPath, originalSpec, "utf8");

    const { stdout } = await execFileAsync("node", [
      "dist/cli/index.js",
      "fix",
      specPath,
      "--out",
      outDir,
      "--diff"
    ]);

    expect(stdout).toContain("Original spec was not modified.");
    expect(await readFile(specPath, "utf8")).toBe(originalSpec);

    const cleaned = parse(await readFile(join(outDir, "cleaned-openapi.yaml"), "utf8")) as {
      paths: Record<string, Record<string, Record<string, unknown>>>;
    };
    const getUser = cleaned.paths["/users/{id}"]?.get;
    const createUser = cleaned.paths["/users"]?.post;

    expect(getUser?.operationId).toBe("get_users_id");
    expect(getUser?.summary).toBe("GET /users/{id}");
    expect(getUser?.description).toBe("GET /users/{id}");
    expect(createUser?.operationId).toBe("post_users");
    expect(createUser?.requestBody).toBeDefined();

    await expect(stat(join(outDir, "doctor-report.json"))).resolves.toBeDefined();
    await expect(stat(join(outDir, "fixes.md"))).resolves.toBeDefined();
    await expect(stat(join(outDir, "summary.md"))).resolves.toBeDefined();
    await expect(stat(join(outDir, "diff.md"))).resolves.toBeDefined();
    await expect(stat(join(outDir, "diff.json"))).resolves.toBeDefined();

    const doctorReport = JSON.parse(await readFile(join(outDir, "doctor-report.json"), "utf8")) as {
      score: number;
      issues: unknown[];
    };
    expect(doctorReport.score).toBeTypeOf("number");
    expect(Array.isArray(doctorReport.issues)).toBe(true);

    const summary = await readFile(join(outDir, "summary.md"), "utf8");
    expect(summary).toContain("API Quality Report");
    expect(summary).toContain("Previous Score:");
    expect(summary).toContain("Current Score After Fix:");
    expect(summary).toContain("Top Issues Fixed");
    expect(summary).toContain("Remaining Issues");
    expect(summary).toContain("Owner Actions");

    const diff = JSON.parse(await readFile(join(outDir, "diff.json"), "utf8")) as Array<{
      path: string;
      type: string;
    }>;
    expect(diff.length).toBeGreaterThan(0);
    expect(diff).toContainEqual(expect.objectContaining({
      path: "$.paths.\"/users/{id}\".get.operationId",
      type: "added"
    }));

    const diffMarkdown = await readFile(join(outDir, "diff.md"), "utf8");
    expect(diffMarkdown).toContain("# OpenAPI Fix Diff");
    expect(diffMarkdown).toContain("ADDED $.paths.\"/users/{id}\".get.operationId");
  });
});
