import type {
  DoctorReport,
  ParsedOpenApiDocument,
  ToolPlan
} from "../types/openapi-doctor.js";

export function createToolPlan(
  parsed: ParsedOpenApiDocument,
  report: DoctorReport
): ToolPlan {
  return {
    sourceLocation: parsed.sourceLocation,
    tools: [],
    blocked: report.findings.filter((finding) => finding.severity === "error")
  };
}
