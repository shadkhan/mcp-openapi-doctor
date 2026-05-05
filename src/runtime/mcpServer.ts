import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadSpec } from "../ingestion/loadSpec.js";
import { generateTools } from "../planner/generateTools.js";
import type { GenerateToolsOptions, NormalizedOpenApiSpec } from "../types/index.js";
import { createToolHandler, createToolInputSchema } from "./toolHandler.js";

export interface OpenApiDoctorServerOptions extends GenerateToolsOptions {
  apiToken?: string;
  fetchImpl?: typeof fetch;
}

export function createOpenApiDoctorMcpServer(
  spec: NormalizedOpenApiSpec,
  options: OpenApiDoctorServerOptions = {}
): McpServer {
  const server = new McpServer({
    name: "mcp-openapi-doctor",
    version: "0.1.0"
  });

  const tools = generateTools(spec, { readOnly: options.readOnly });

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: `${tool.description}\n\nSafety: ${tool.safetyLevel}.`,
        inputSchema: createToolInputSchema(tool),
        annotations: {
          readOnlyHint: tool.safetyLevel === "SAFE_READ",
          destructiveHint: tool.safetyLevel === "DESTRUCTIVE"
        },
        _meta: {
          method: tool.method,
          path: tool.path,
          safetyLevel: tool.safetyLevel
        }
      },
      createToolHandler({
        spec,
        tool,
        apiToken: options.apiToken,
        fetchImpl: options.fetchImpl
      })
    );
  }

  return server;
}

export async function serveSpecOverStdio(
  specLocation: string,
  options: OpenApiDoctorServerOptions = {}
): Promise<void> {
  const spec = await loadSpec(specLocation);
  const server = createOpenApiDoctorMcpServer(spec, options);
  await server.connect(new StdioServerTransport());
}
