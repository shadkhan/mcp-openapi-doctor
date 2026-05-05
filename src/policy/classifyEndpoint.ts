import type { NormalizedOperation, SafetyLevel } from "../types/index.js";

const WRITE_METHODS = new Set(["post", "put", "patch"]);
const SENSITIVE_PATH_PARTS = [
  "admin",
  "auth",
  "billing",
  "credential",
  "key",
  "password",
  "payment",
  "secret",
  "token"
];

export function classifyEndpoint(operation: NormalizedOperation): SafetyLevel {
  if (operation.method === "delete") {
    return "DESTRUCTIVE";
  }

  if (isSensitivePath(operation.path)) {
    return "SENSITIVE";
  }

  if (WRITE_METHODS.has(operation.method)) {
    return "WRITE";
  }

  return "SAFE_READ";
}

function isSensitivePath(path: string): boolean {
  const normalizedPath = path.toLowerCase();
  return SENSITIVE_PATH_PARTS.some((part) => normalizedPath.includes(part));
}
