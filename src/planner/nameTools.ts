import type { NormalizedOperation } from "../types/index.js";

export function nameTool(operation: NormalizedOperation): string {
  const baseName = operation.operation.operationId?.trim()
    ? operation.operation.operationId
    : `${operation.method}_${operation.path}`;

  return normalizeToolName(baseName);
}

export function ensureUniqueToolNames(names: string[]): string[] {
  const seen = new Map<string, number>();

  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);

    return count === 0 ? name : `${name}_${count + 1}`;
  });
}

export function normalizeToolName(value: string): string {
  const cleaned = value
    .replace(/[{}]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return cleaned.length > 0 ? cleaned : "unnamed_tool";
}
