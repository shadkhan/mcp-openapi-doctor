import { detectIssues } from "./detectIssues.js";
import type {
  DoctorIssue,
  DoctorIssueSeverity,
  DoctorReport,
  NormalizedOpenApiSpec
} from "../types/index.js";

const ISSUE_PENALTIES: Record<DoctorIssue["code"], number> = {
  missing_operation_id: 8,
  missing_summary: 3,
  missing_description: 3,
  missing_parameter_description: 2,
  missing_request_body_schema: 8,
  missing_response_schema: 7,
  missing_error_responses: 5,
  destructive_endpoint: 10,
  write_endpoint: 4,
  auth_missing: 8,
  auth_ambiguous: 6
};

export function scoreSpec(spec: NormalizedOpenApiSpec): DoctorReport {
  const issues = detectIssues(spec);
  const penalty = issues.reduce((total, issue) => total + ISSUE_PENALTIES[issue.code], 0);

  return {
    score: Math.max(0, 100 - penalty),
    totalOperations: spec.operations.length,
    readOperations: spec.operations.filter((operation) => operation.method === "get").length,
    writeOperations: spec.operations.filter((operation) => ["post", "put", "patch"].includes(operation.method)).length,
    destructiveOperations: spec.operations.filter((operation) => operation.method === "delete").length,
    issues,
    issuesBySeverity: groupIssuesBySeverity(issues)
  };
}

function groupIssuesBySeverity(issues: DoctorIssue[]): Record<DoctorIssueSeverity, DoctorIssue[]> {
  return {
    error: issues.filter((issue) => issue.severity === "error"),
    warning: issues.filter((issue) => issue.severity === "warning"),
    info: issues.filter((issue) => issue.severity === "info")
  };
}
