import type {
  DoctorReport,
  OpenApiDoctorConfig,
  ParsedOpenApiDocument
} from "../types/openapi-doctor.js";

export function inspectSpec(
  parsed: ParsedOpenApiDocument,
  config: OpenApiDoctorConfig
): DoctorReport {
  return {
    sourceLocation: parsed.sourceLocation,
    score: config.requireOperationIds ? 0 : 10,
    findings: [
      {
        severity: "info",
        code: "placeholder",
        message: "OpenAPI Doctor inspection pipeline is scaffolded but not fully implemented yet."
      }
    ]
  };
}
