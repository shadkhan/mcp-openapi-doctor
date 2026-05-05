import type {
  DoctorIssue,
  DoctorIssueSeverity,
  NormalizedOpenApiSpec,
  NormalizedOperation,
  OpenApiDocument,
  OpenApiOperation
} from "../types/index.js";

const WRITE_METHODS = new Set(["post", "put", "patch"]);

export function detectIssues(spec: NormalizedOpenApiSpec): DoctorIssue[] {
  return spec.operations.flatMap((operation) => detectOperationIssues(spec.document, operation));
}

function detectOperationIssues(
  document: OpenApiDocument,
  normalizedOperation: NormalizedOperation
): DoctorIssue[] {
  const { method, path, operation } = normalizedOperation;
  const issues: DoctorIssue[] = [];

  if (!hasText(operation.operationId)) {
    issues.push(createIssue("warning", "missing_operation_id", "Missing operationId.", normalizedOperation));
  }

  if (!hasText(operation.summary)) {
    issues.push(createIssue("info", "missing_summary", "Missing summary.", normalizedOperation));
  }

  if (!hasText(operation.description)) {
    issues.push(createIssue("info", "missing_description", "Missing description.", normalizedOperation));
  }

  const parameters = [...normalizedOperation.pathParameters, ...(operation.parameters ?? [])];
  for (const parameter of parameters) {
    if (isRecord(parameter) && !hasText(parameter.description)) {
      const name = typeof parameter.name === "string" ? parameter.name : "unknown";
      issues.push(
        createIssue(
          "info",
          "missing_parameter_description",
          `Parameter "${name}" is missing a description.`,
          normalizedOperation
        )
      );
    }
  }

  if (WRITE_METHODS.has(method) && !hasRequestBodySchema(operation)) {
    issues.push(
      createIssue(
        "warning",
        "missing_request_body_schema",
        "Write operation is missing a request body schema.",
        normalizedOperation
      )
    );
  }

  if (!hasResponseSchema(operation)) {
    issues.push(createIssue("warning", "missing_response_schema", "Missing success response schema.", normalizedOperation));
  }

  if (!hasErrorResponse(operation)) {
    issues.push(createIssue("warning", "missing_error_responses", "Missing error responses.", normalizedOperation));
  }

  if (method === "delete") {
    issues.push(createIssue("error", "destructive_endpoint", "DELETE operation is destructive.", normalizedOperation));
  } else if (WRITE_METHODS.has(method)) {
    issues.push(createIssue("warning", "write_endpoint", `${method.toUpperCase()} operation can modify data.`, normalizedOperation));
  }

  const authIssue = detectAuthIssue(document, operation);
  if (authIssue !== null) {
    issues.push(createIssue("warning", authIssue, authMessage(authIssue), normalizedOperation));
  }

  return issues;
}

function hasRequestBodySchema(operation: OpenApiOperation): boolean {
  if (hasOpenApiRequestBodySchema(operation.requestBody)) {
    return true;
  }

  return (operation.parameters ?? []).some((parameter) => {
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

function hasResponseSchema(operation: OpenApiOperation): boolean {
  if (!isRecord(operation.responses)) {
    return false;
  }

  const successResponses = Object.entries(operation.responses).filter(([statusCode]) => {
    return /^2\d\d$/.test(statusCode) && statusCode !== "204";
  });

  if (successResponses.length === 0) {
    return false;
  }

  return successResponses.some(([, response]) => responseHasSchema(response));
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

function hasErrorResponse(operation: OpenApiOperation): boolean {
  if (!isRecord(operation.responses)) {
    return false;
  }

  return Object.keys(operation.responses).some((statusCode) => {
    return statusCode === "default" || /^[45]\d\d$/.test(statusCode);
  });
}

function detectAuthIssue(
  document: OpenApiDocument,
  operation: OpenApiOperation
): "auth_missing" | "auth_ambiguous" | null {
  const operationSecurity = operation.security;
  if (Array.isArray(operationSecurity)) {
    return operationSecurity.length === 0 ? null : null;
  }

  if (Array.isArray(document.security) && document.security.length > 0) {
    return null;
  }

  const hasAuthDefinitions =
    isRecord(document.components) && isRecord(document.components.securitySchemes)
      ? Object.keys(document.components.securitySchemes).length > 0
      : isRecord(document.securityDefinitions) && Object.keys(document.securityDefinitions).length > 0;

  return hasAuthDefinitions ? "auth_ambiguous" : "auth_missing";
}

function authMessage(code: "auth_missing" | "auth_ambiguous"): string {
  if (code === "auth_ambiguous") {
    return "Authentication schemes exist, but this operation does not declare whether auth is required.";
  }

  return "Authentication requirements are missing.";
}

function createIssue(
  severity: DoctorIssueSeverity,
  code: DoctorIssue["code"],
  message: string,
  operation: NormalizedOperation
): DoctorIssue {
  return {
    severity,
    code,
    message,
    method: operation.method,
    path: operation.path
  };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
