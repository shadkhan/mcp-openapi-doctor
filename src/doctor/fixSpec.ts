import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { stringify as stringifyYaml } from "yaml";

import { formatDoctorReport } from "./report.js";
import { scoreSpec } from "./scoreSpec.js";
import { loadSpec, loadSpecDocument } from "../ingestion/loadSpec.js";
import { normalizeSpec } from "../ingestion/normalizeSpec.js";
import { normalizeToolName } from "../planner/nameTools.js";
import {
  HTTP_METHODS,
  type DoctorIssue,
  type DoctorReport,
  type HttpMethod,
  type OpenApiDocument
} from "../types/index.js";

const WRITE_METHODS = new Set<HttpMethod>(["post", "put", "patch"]);

export interface FixSpecOptions {
  outDir: string;
  diff?: boolean;
}

export interface FixSpecResult {
  outDir: string;
  cleanedSpecPath: string;
  doctorReportPath: string;
  fixesPath: string;
  summaryPath: string;
  diffMarkdownPath?: string;
  diffJsonPath?: string;
  report: DoctorReport;
  cleanedReport: DoctorReport;
  fixes: string[];
  diff?: SpecDiffEntry[];
}

export interface SpecDiffEntry {
  path: string;
  type: "added" | "changed" | "removed";
  before?: unknown;
  after?: unknown;
}

/** Generates advisory fixed-spec artifacts without modifying the original spec. */
export async function fixSpec(specLocation: string, options: FixSpecOptions): Promise<FixSpecResult> {
  const [loadedSpec, loadedDocument] = await Promise.all([
    loadSpec(specLocation),
    loadSpecDocument(specLocation)
  ]);
  const report = scoreSpec(loadedSpec);
  const originalDocument = deepClone(loadedDocument.document);
  const cleanedDocument = deepClone(loadedDocument.document);
  const fixes = applyMetadataFixes(cleanedDocument);
  const cleanedReport = scoreSpec(normalizeSpec(cleanedDocument, { source: `${specLocation}#cleaned` }));
  const diff = options.diff === true ? diffValues(originalDocument, cleanedDocument) : undefined;
  const outDir = resolve(options.outDir);

  await mkdir(outDir, { recursive: true });

  const cleanedSpecPath = resolve(outDir, "cleaned-openapi.yaml");
  const doctorReportPath = resolve(outDir, "doctor-report.json");
  const fixesPath = resolve(outDir, "fixes.md");
  const summaryPath = resolve(outDir, "summary.md");
  const diffMarkdownPath = options.diff === true ? resolve(outDir, "diff.md") : undefined;
  const diffJsonPath = options.diff === true ? resolve(outDir, "diff.json") : undefined;

  const writes = [
    writeFile(cleanedSpecPath, stringifyYaml(cleanedDocument), "utf8"),
    writeFile(doctorReportPath, JSON.stringify(report, null, 2), "utf8"),
    writeFile(fixesPath, formatFixesMarkdown(fixes), "utf8"),
    writeFile(summaryPath, formatSummaryMarkdown(report, cleanedReport), "utf8")
  ];

  if (diff !== undefined && diffMarkdownPath !== undefined && diffJsonPath !== undefined) {
    writes.push(
      writeFile(diffMarkdownPath, formatDiffMarkdown(diff), "utf8"),
      writeFile(diffJsonPath, JSON.stringify(diff, null, 2), "utf8")
    );
  }

  await Promise.all(writes);

  return {
    outDir,
    cleanedSpecPath,
    doctorReportPath,
    fixesPath,
    summaryPath,
    diffMarkdownPath,
    diffJsonPath,
    report,
    cleanedReport,
    fixes,
    diff
  };
}

function applyMetadataFixes(document: OpenApiDocument): string[] {
  const fixes: string[] = [];
  const usedOperationIds = new Set<string>();

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    if (!isRecord(pathItem)) {
      continue;
    }

    fixParameterDescriptions(pathItem.parameters, path, fixes);

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isRecord(operation)) {
        continue;
      }

      const fallbackName = normalizeToolName(`${method}_${path}`);
      const nextOperationId = uniqueOperationId(
        normalizeToolName(typeof operation.operationId === "string" ? operation.operationId : fallbackName),
        usedOperationIds
      );

      if (operation.operationId !== nextOperationId) {
        operation.operationId = nextOperationId;
        fixes.push(`${method.toUpperCase()} ${path}: set operationId to \`${nextOperationId}\`.`);
      }

      if (!hasText(operation.summary)) {
        operation.summary = `${method.toUpperCase()} ${path}`;
        fixes.push(`${method.toUpperCase()} ${path}: added fallback summary.`);
      }

      if (!hasText(operation.description)) {
        operation.description = operation.summary;
        fixes.push(`${method.toUpperCase()} ${path}: added fallback description.`);
      }

      fixParameterDescriptions(operation.parameters, path, fixes, method);

      if (WRITE_METHODS.has(method) && !hasRequestBodySchema(operation)) {
        addPlaceholderRequestBodySchema(operation, document.swagger === "2.0");
        fixes.push(`${method.toUpperCase()} ${path}: added placeholder request body schema.`);
      }

      if (!hasResponseSchema(operation)) {
        addPlaceholderResponseSchema(operation, document.swagger === "2.0");
        fixes.push(`${method.toUpperCase()} ${path}: added placeholder response schema.`);
      }
    }
  }

  return fixes;
}

function fixParameterDescriptions(
  parameters: unknown,
  path: string,
  fixes: string[],
  method?: HttpMethod
): void {
  if (!Array.isArray(parameters)) {
    return;
  }

  for (const parameter of parameters) {
    if (!isRecord(parameter) || hasText(parameter.description)) {
      continue;
    }

    const name = typeof parameter.name === "string" ? parameter.name : "parameter";
    const location = typeof parameter.in === "string" ? parameter.in : "request";
    parameter.description = `The ${name} ${location} parameter.`;

    const prefix = method ? `${method.toUpperCase()} ${path}` : `Path ${path}`;
    fixes.push(`${prefix}: added description for parameter \`${name}\`.`);
  }
}

function hasRequestBodySchema(operation: Record<string, unknown>): boolean {
  if (hasOpenApiRequestBodySchema(operation.requestBody)) {
    return true;
  }

  return Array.isArray(operation.parameters) && operation.parameters.some((parameter) => {
    return isRecord(parameter) && parameter.in === "body" && isRecord(parameter.schema);
  });
}

function hasOpenApiRequestBodySchema(requestBody: unknown): boolean {
  if (!isRecord(requestBody) || !isRecord(requestBody.content)) {
    return false;
  }

  return Object.values(requestBody.content).some((mediaType) => {
    return isRecord(mediaType) && isRecord(mediaType.schema);
  });
}

function addPlaceholderRequestBodySchema(operation: Record<string, unknown>, isSwagger2: boolean): void {
  if (isSwagger2) {
    const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];
    operation.parameters = parameters;
    parameters.push({
      name: "body",
      in: "body",
      required: false,
      description: "Request body payload.",
      schema: placeholderSchema()
    });
    return;
  }

  operation.requestBody = {
    required: false,
    content: {
      "application/json": {
        schema: placeholderSchema()
      }
    }
  };
}

function hasResponseSchema(operation: Record<string, unknown>): boolean {
  if (!isRecord(operation.responses)) {
    return false;
  }

  return Object.entries(operation.responses).some(([statusCode, response]) => {
    return /^2\d\d$/.test(statusCode) && statusCode !== "204" && responseHasSchema(response);
  });
}

function responseHasSchema(response: unknown): boolean {
  if (!isRecord(response)) {
    return false;
  }

  if (isRecord(response.schema)) {
    return true;
  }

  if (!isRecord(response.content)) {
    return false;
  }

  return Object.values(response.content).some((mediaType) => {
    return isRecord(mediaType) && isRecord(mediaType.schema);
  });
}

function addPlaceholderResponseSchema(operation: Record<string, unknown>, isSwagger2: boolean): void {
  const responses = isRecord(operation.responses) ? operation.responses : {};
  operation.responses = responses;

  const responseEntry = Object.entries(responses).find(([statusCode]) => /^2\d\d$/.test(statusCode) && statusCode !== "204");
  const statusCode = responseEntry?.[0] ?? "200";
  const response = isRecord(responseEntry?.[1]) ? responseEntry[1] : { description: "Successful response." };
  responses[statusCode] = response;

  if (!hasText(response.description)) {
    response.description = "Successful response.";
  }

  if (isSwagger2) {
    response.schema = placeholderSchema();
    return;
  }

  response.content = {
    ...(isRecord(response.content) ? response.content : {}),
    "application/json": {
      schema: placeholderSchema()
    }
  };
}

function placeholderSchema(): Record<string, unknown> {
  return {
    type: "object",
    description: "Placeholder schema added by OpenAPI Doctor. Replace with the real schema when available.",
    additionalProperties: true
  };
}

function uniqueOperationId(operationId: string, usedOperationIds: Set<string>): string {
  let candidate = operationId.length > 0 ? operationId : "unnamed_operation";
  let suffix = 2;

  while (usedOperationIds.has(candidate)) {
    candidate = `${operationId}_${suffix}`;
    suffix += 1;
  }

  usedOperationIds.add(candidate);
  return candidate;
}

function formatFixesMarkdown(fixes: string[]): string {
  const lines = ["# Fixes", ""];

  if (fixes.length === 0) {
    lines.push("- No metadata fixes were needed.");
    return `${lines.join("\n")}\n`;
  }

  lines.push(...fixes.map((fix) => `- ${fix}`));
  return `${lines.join("\n")}\n`;
}

function formatSummaryMarkdown(previousReport: DoctorReport, currentReport: DoctorReport): string {
  const fixedIssues = summarizeFixedIssues(previousReport, currentReport);
  const remainingIssues = unique(currentReport.issues.map((issue) => humanizeIssueCode(issue.code)));
  const recommendations = unique(currentReport.issues.slice(0, 8).map(recommendationForIssue));

  return [
    "# API Quality Report",
    "",
    `Previous Score: ${previousReport.score}/100`,
    `Current Score After Fix: ${currentReport.score}/100`,
    "",
    "## Top Issues Fixed",
    "",
    ...(fixedIssues.length > 0 ? fixedIssues.map((issue) => `- ${issue}`) : ["- No automatically fixable issues were changed."]),
    "",
    "## Remaining Issues",
    "",
    ...(remainingIssues.length > 0 ? remainingIssues.map((issue) => `- ${issue}`) : ["- No remaining issues detected by the current doctor rules."]),
    "",
    "## Owner Actions",
    "",
    ...(recommendations.length > 0 ? recommendations.map((recommendation) => `- ${recommendation}`) : ["- Review generated placeholders and replace them with precise API-specific schemas where needed."]),
    ""
  ].join("\n");
}

function summarizeFixedIssues(previousReport: DoctorReport, currentReport: DoctorReport): string[] {
  const currentCounts = countIssueCodes(currentReport.issues);
  const fixed: string[] = [];

  for (const [code, previousCount] of countIssueCodes(previousReport.issues)) {
    const currentCount = currentCounts.get(code) ?? 0;
    const fixedCount = previousCount - currentCount;

    if (fixedCount > 0) {
      fixed.push(`${humanizeIssueCode(code)} (${fixedCount})`);
    }
  }

  return fixed;
}

function countIssueCodes(issues: DoctorIssue[]): Map<DoctorIssue["code"], number> {
  const counts = new Map<DoctorIssue["code"], number>();

  for (const issue of issues) {
    counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
  }

  return counts;
}

function recommendationForIssue(issue: DoctorIssue): string {
  switch (issue.code) {
    case "missing_operation_id":
      return "Add operationId for all endpoints.";
    case "missing_summary":
      return "Add concise summaries for agent-readable tool previews.";
    case "missing_description":
      return "Add descriptions that explain when each operation should be used.";
    case "missing_parameter_description":
      return "Describe parameters so agents know what values to provide.";
    case "missing_request_body_schema":
      return "Add JSON request schemas for write endpoints.";
    case "missing_response_schema":
      return "Add response schemas for successful responses.";
    case "missing_error_responses":
      return "Document 4xx/5xx responses for safer error handling.";
    case "destructive_endpoint":
      return "Avoid exposing DELETE endpoints to agents unless policy allows it.";
    case "write_endpoint":
      return "Review write endpoints before enabling them for agents.";
    case "auth_missing":
    case "auth_ambiguous":
      return "Declare authentication requirements clearly.";
  }
}

function humanizeIssueCode(code: DoctorIssue["code"]): string {
  return code
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function diffValues(before: unknown, after: unknown, path = "$"): SpecDiffEntry[] {
  if (Object.is(before, after)) {
    return [];
  }

  if (isRecord(before) && isRecord(after)) {
    const keys = unique([...Object.keys(before), ...Object.keys(after)]).sort();
    return keys.flatMap((key) => {
      const childPath = `${path}.${escapePathSegment(key)}`;

      if (!(key in before)) {
        return [{ path: childPath, type: "added", after: after[key] } satisfies SpecDiffEntry];
      }

      if (!(key in after)) {
        return [{ path: childPath, type: "removed", before: before[key] } satisfies SpecDiffEntry];
      }

      return diffValues(before[key], after[key], childPath);
    });
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const maxLength = Math.max(before.length, after.length);
    return Array.from({ length: maxLength }, (_, index) => {
      const childPath = `${path}[${index}]`;

      if (index >= before.length) {
        return [{ path: childPath, type: "added", after: after[index] } satisfies SpecDiffEntry];
      }

      if (index >= after.length) {
        return [{ path: childPath, type: "removed", before: before[index] } satisfies SpecDiffEntry];
      }

      return diffValues(before[index], after[index], childPath);
    }).flat();
  }

  return [
    {
      path,
      type: "changed",
      before,
      after
    }
  ];
}

function formatDiffMarkdown(diff: SpecDiffEntry[]): string {
  const lines = ["# OpenAPI Fix Diff", "", `Total changes: ${diff.length}`, ""];

  if (diff.length === 0) {
    lines.push("- No differences detected.");
    return `${lines.join("\n")}\n`;
  }

  for (const entry of diff) {
    lines.push(`## ${entry.type.toUpperCase()} ${entry.path}`);

    if (entry.type !== "added") {
      lines.push("", "Before:", "", "```json", JSON.stringify(entry.before, null, 2), "```");
    }

    if (entry.type !== "removed") {
      lines.push("", "After:", "", "```json", JSON.stringify(entry.after, null, 2), "```");
    }

    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function escapePathSegment(segment: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment) ? segment : JSON.stringify(segment);
}

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
