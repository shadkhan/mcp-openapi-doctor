import type { OpenApiDoctorConfig } from "../types/openapi-doctor.js";

export function createDefaultConfig(): OpenApiDoctorConfig {
  return {
    maxTools: 50,
    allowDestructiveOperations: false,
    requireOperationIds: true,
    redactSecrets: true
  };
}
