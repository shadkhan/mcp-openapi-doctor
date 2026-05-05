#!/usr/bin/env node
import { Command } from "commander";

import { formatDoctorReport } from "../doctor/report.js";
import { scoreSpec } from "../doctor/scoreSpec.js";
import { loadSpec } from "../ingestion/loadSpec.js";

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
    const loadedSpec = await loadSpec(spec);

    console.log(`API title: ${loadedSpec.title}`);
    console.log(`Version: ${loadedSpec.version}`);
    console.log(`Paths: ${loadedSpec.pathCount}`);
    console.log(`Operations: ${loadedSpec.operationCount}`);
    console.log(`OpenAPI version: ${loadedSpec.openApiVersion}`);
    console.log("");
    console.log(formatDoctorReport(scoreSpec(loadedSpec)));
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
