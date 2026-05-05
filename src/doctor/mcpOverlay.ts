import type { NormalizedOpenApiSpec, SafetyLevel } from "../types/index.js";
import { generateTools } from "../planner/generateTools.js";

export interface McpOverlay {
  "x-mcp": {
    version: string;
    source: string;
    tools: Record<string, McpOverlayTool>;
  };
}

export interface McpOverlayTool {
  operationId?: string;
  method: string;
  path: string;
  safety: SafetyLevel;
  description: string;
  enabled: boolean;
  reason?: string;
  inputSchema: unknown;
}

/** Creates an advisory MCP overlay from the normalized spec without changing runtime behavior. */
export function createMcpOverlay(spec: NormalizedOpenApiSpec): McpOverlay {
  const tools = generateTools(spec);

  return {
    "x-mcp": {
      version: "0.1",
      source: spec.source,
      tools: Object.fromEntries(
        tools.map((tool) => [
          tool.name,
          {
            operationId: tool.operationId,
            method: tool.method,
            path: tool.path,
            safety: tool.safetyLevel,
            description: tool.description,
            enabled: tool.safetyLevel === "SAFE_READ",
            reason: reasonForSafety(tool.safetyLevel),
            inputSchema: tool.inputSchema
          }
        ])
      )
    }
  };
}

function reasonForSafety(safety: SafetyLevel): string | undefined {
  switch (safety) {
    case "WRITE":
      return "Write endpoint; review before exposing to agents.";
    case "DESTRUCTIVE":
      return "Destructive endpoint; disabled by default for agents.";
    case "SENSITIVE":
      return "Sensitive endpoint; disabled by default for agents.";
    case "SAFE_READ":
      return undefined;
  }
}
