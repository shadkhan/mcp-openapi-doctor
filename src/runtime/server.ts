import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function createOpenApiDoctorServer(): McpServer {
  return new McpServer({
    name: "mcp-openapi-doctor",
    version: "0.1.0"
  });
}
