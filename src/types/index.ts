export type HttpMethod =
  | "get"
  | "put"
  | "post"
  | "delete"
  | "options"
  | "head"
  | "patch"
  | "trace";

export const HTTP_METHODS: readonly HttpMethod[] = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace"
];

export interface OpenApiInfo {
  title?: string;
  version?: string;
}

export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: unknown[];
  requestBody?: unknown;
  responses?: Record<string, unknown>;
  security?: unknown[];
  [key: string]: unknown;
}

export interface OpenApiPathItem {
  [methodOrExtension: string]: unknown;
}

export interface OpenApiDocument {
  openapi?: string;
  swagger?: string;
  info?: OpenApiInfo;
  paths?: Record<string, OpenApiPathItem>;
  [key: string]: unknown;
}

export type OpenApiDialect = "openapi-3" | "swagger-2";

export interface NormalizedSpecSummary {
  title: string;
  version: string;
  openApiVersion: string;
  pathCount: number;
  operationCount: number;
}

export interface NormalizedOperation {
  method: HttpMethod;
  path: string;
  operation: OpenApiOperation;
  pathParameters: unknown[];
}

export interface NormalizedOpenApiSpec extends NormalizedSpecSummary {
  source: string;
  dialect: OpenApiDialect;
  document: OpenApiDocument;
  operations: NormalizedOperation[];
}

export interface NormalizeSpecOptions {
  source: string;
}

export type DoctorIssueSeverity = "error" | "warning" | "info";

export type DoctorIssueCode =
  | "missing_operation_id"
  | "missing_summary"
  | "missing_description"
  | "missing_parameter_description"
  | "missing_request_body_schema"
  | "missing_response_schema"
  | "missing_error_responses"
  | "destructive_endpoint"
  | "write_endpoint"
  | "auth_missing"
  | "auth_ambiguous";

export interface DoctorIssue {
  severity: DoctorIssueSeverity;
  code: DoctorIssueCode;
  message: string;
  method: HttpMethod;
  path: string;
}

export interface DoctorReport {
  score: number;
  totalOperations: number;
  readOperations: number;
  writeOperations: number;
  destructiveOperations: number;
  issues: DoctorIssue[];
  issuesBySeverity: Record<DoctorIssueSeverity, DoctorIssue[]>;
}
