export interface OpenApiDoctorConfig {
  maxTools: number;
  allowDestructiveOperations: boolean;
  requireOperationIds: boolean;
  redactSecrets: boolean;
}

export interface ParsedOpenApiDocument {
  sourceLocation: string;
  document: unknown;
}

export type FindingSeverity = "info" | "warning" | "error";

export interface DoctorFinding {
  severity: FindingSeverity;
  code: string;
  message: string;
}

export interface DoctorReport {
  sourceLocation: string;
  score: number;
  findings: DoctorFinding[];
}

export interface PlannedTool {
  name: string;
  description: string;
  method: string;
  path: string;
  destructive: boolean;
}

export interface ToolPlan {
  sourceLocation: string;
  tools: PlannedTool[];
  blocked: DoctorFinding[];
}

export interface OperationPolicy {
  allowRead: boolean;
  allowWrite: boolean;
  allowDelete: boolean;
  requireConfirmation: boolean;
}
