import {
  HTTP_METHODS,
  type HttpMethod,
  type NormalizeSpecOptions,
  type NormalizedOperation,
  type NormalizedOpenApiSpec,
  type OpenApiDialect,
  type OpenApiDocument
} from "../types/index.js";

export function normalizeSpec(
  document: OpenApiDocument,
  options: NormalizeSpecOptions
): NormalizedOpenApiSpec {
  const dialect = detectDialect(document);
  const paths = document.paths ?? {};
  const operations = extractOperations(paths);

  return {
    source: options.source,
    dialect,
    document,
    operations,
    title: document.info?.title ?? "Untitled API",
    version: document.info?.version ?? "unknown",
    openApiVersion: document.openapi ?? document.swagger ?? "unknown",
    pathCount: Object.keys(paths).length,
    operationCount: operations.length
  };
}

function detectDialect(document: OpenApiDocument): OpenApiDialect {
  if (typeof document.openapi === "string" && document.openapi.startsWith("3.")) {
    return "openapi-3";
  }

  if (document.swagger === "2.0") {
    return "swagger-2";
  }

  throw new Error("Unsupported API spec version. Expected OpenAPI 3.x or Swagger 2.0.");
}

function extractOperations(paths: Record<string, unknown>): NormalizedOperation[] {
  return Object.entries(paths).flatMap(([path, pathItem]) => {
    if (!isRecord(pathItem)) {
      return [];
    }

    const pathParameters = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

    return HTTP_METHODS.flatMap((method) => {
      const operation = pathItem[method];

      if (!isOperation(operation, method)) {
        return [];
      }

      return [
        {
          method,
          path,
          operation,
          pathParameters
        }
      ];
    });
  });
}

function isOperation(value: unknown, _method: HttpMethod): value is NormalizedOperation["operation"] {
  return isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
