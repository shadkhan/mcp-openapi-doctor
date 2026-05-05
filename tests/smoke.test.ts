import { describe, expect, it } from "vitest";

import { createDefaultConfig } from "../src/config/defaults.js";
import { inspectSpec } from "../src/doctor/score.js";
import { createToolPlan } from "../src/planner/tool-plan.js";

describe("OpenAPI Doctor foundation", () => {
  it("creates a placeholder report and empty tool plan", () => {
    const parsed = {
      sourceLocation: "memory://example",
      document: { openapi: "3.1.0", info: { title: "Example", version: "1.0.0" }, paths: {} }
    };

    const report = inspectSpec(parsed, createDefaultConfig());
    const plan = createToolPlan(parsed, report);

    expect(report.findings).toHaveLength(1);
    expect(plan.tools).toEqual([]);
  });
});
