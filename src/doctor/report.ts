import type { DoctorIssue, DoctorIssueSeverity, DoctorReport } from "../types/index.js";

const SEVERITIES: readonly DoctorIssueSeverity[] = ["error", "warning", "info"];

export function formatDoctorReport(report: DoctorReport): string {
  const lines = [
    `Overall quality score: ${report.score}/100`,
    `Total operations: ${report.totalOperations}`,
    `Read operations: ${report.readOperations}`,
    `Write operations: ${report.writeOperations}`,
    `Destructive operations: ${report.destructiveOperations}`,
    "",
    "Issues:"
  ];

  for (const severity of SEVERITIES) {
    const issues = report.issuesBySeverity[severity];
    lines.push(`${capitalize(severity)} (${issues.length}):`);

    if (issues.length === 0) {
      lines.push("  - None");
      continue;
    }

    for (const issue of issues) {
      lines.push(`  - ${formatIssue(issue)}`);
    }
  }

  return lines.join("\n");
}

function formatIssue(issue: DoctorIssue): string {
  return `${issue.method.toUpperCase()} ${issue.path} [${issue.code}] ${issue.message}`;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
