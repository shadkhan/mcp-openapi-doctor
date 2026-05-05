import type { OperationPolicy } from "../types/openapi-doctor.js";

export function createDefaultOperationPolicy(): OperationPolicy {
  return {
    allowRead: true,
    allowWrite: false,
    allowDelete: false,
    requireConfirmation: true
  };
}
