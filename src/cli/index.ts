#!/usr/bin/env node
import { Command } from "commander";

import { fixSpec } from "../doctor/fixSpec.js";
import { formatDoctorReport } from "../doctor/report.js";
import { scoreSpec } from "../doctor/scoreSpec.js";
import { loadSpec } from "../ingestion/loadSpec.js";
import { generateTools } from "../planner/generateTools.js";
import { formatGeneratedTools } from "../planner/report.js";
import { serveSpecOverStdio } from "../runtime/mcpServer.js";

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

program
  .command("generate")
  .description("Preview MCP tools generated from an OpenAPI or Swagger spec.")
  .argument("<spec>", "Path or URL to an OpenAPI/Swagger document")
  .option("--read-only", "Preview only SAFE_READ tools.", false)
  .option("--json", "Print full generated tool definitions as JSON.", false)
  .action(async (spec: string, options: { readOnly: boolean; json: boolean }) => {
    const loadedSpec = await loadSpec(spec);
    const tools = generateTools(loadedSpec, { readOnly: options.readOnly });

    if (options.json) {
      console.log(JSON.stringify(tools, null, 2));
      return;
    }

    console.log(formatGeneratedTools(tools));
  });

program
  .command("fix")
  .description("Generate advisory cleaned OpenAPI artifacts without modifying the original spec.")
  .argument("<spec>", "Path or URL to an OpenAPI/Swagger document")
  .requiredOption("--out <dir>", "Directory for generated advisory output files.")
  .option("--diff", "Write diff.md and diff.json comparing original and cleaned specs.", false)
  .option("--overlay", "Write mcp-overlay.yaml with advisory x-mcp metadata.", false)
  .action(async (spec: string, options: { out: string; diff: boolean; overlay: boolean }) => {
    const result = await fixSpec(spec, {
      outDir: options.out,
      diff: options.diff,
      overlay: options.overlay
    });

    console.log("Generated advisory fix outputs:");
    console.log(`- ${result.cleanedSpecPath}`);
    console.log(`- ${result.doctorReportPath}`);
    console.log(`- ${result.fixesPath}`);
    console.log(`- ${result.summaryPath}`);
    if (result.diffMarkdownPath !== undefined && result.diffJsonPath !== undefined) {
      console.log(`- ${result.diffMarkdownPath}`);
      console.log(`- ${result.diffJsonPath}`);
    }
    if (result.overlayPath !== undefined) {
      console.log(`- ${result.overlayPath}`);
    }
    console.log("");
    console.log("Original spec was not modified.");
  });

program
  .command("serve")
  .description("Serve an OpenAPI or Swagger spec as MCP tools over stdio.")
  .argument("<spec>", "Path or URL to an OpenAPI/Swagger document")
  .option("--read-only", "Expose only SAFE_READ tools.", false)
  .action(async (spec: string, options: { readOnly: boolean }) => {
    await serveSpecOverStdio(spec, {
      readOnly: options.readOnly,
      apiToken: process.env.API_TOKEN
    });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
