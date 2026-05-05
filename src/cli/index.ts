#!/usr/bin/env node
import { Command } from "commander";

import { createDefaultConfig } from "../config/defaults.js";
import { inspectSpec } from "../doctor/score.js";
import { loadSpecSource } from "../ingestion/source.js";
import { parseOpenApiSpec } from "../parser/openapi.js";
import { createToolPlan } from "../planner/tool-plan.js";

const program = new Command();

program
  .name("openapi-doctor")
  .description("Validate, score, curate, and safely expose OpenAPI specs as MCP tools.")
  .version("0.1.0");

program
  .command("inspect")
  .description("Inspect an OpenAPI or Swagger spec and print an initial readiness report.")
  .argument("<spec>", "Path or URL to an OpenAPI/Swagger document")
  .action(async (spec: string) => {
    const config = createDefaultConfig();
    const source = await loadSpecSource(spec);
    const document = await parseOpenApiSpec(source);
    const report = inspectSpec(document, config);
    const plan = createToolPlan(document, report);

    console.log(JSON.stringify({ report, plan }, null, 2));
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
