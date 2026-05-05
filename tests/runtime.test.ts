import { createServer } from "node:http";

import { describe, expect, it, vi } from "vitest";

import { normalizeSpec } from "../src/ingestion/normalizeSpec.js";
import { generateTools } from "../src/planner/generateTools.js";
import { executeHttpTool, resolveBaseUrl } from "../src/runtime/httpClient.js";
import { createOpenApiDoctorMcpServer } from "../src/runtime/mcpServer.js";
import { createToolInputSchema } from "../src/runtime/toolHandler.js";

describe("runtime", () => {
  it("resolves base URL from OpenAPI servers[0].url", () => {
    const spec = normalizeSpec(
      {
        openapi: "3.0.3",
        info: { title: "Runtime API", version: "1.0.0" },
        servers: [{ url: "https://api.example.test/v1" }],
        paths: {}
      },
      { source: "memory://runtime" }
    );

    expect(resolveBaseUrl(spec)).toBe("https://api.example.test/v1");
  });

  it("validates generated tool input with Zod", async () => {
    const spec = normalizeSpec(
      {
        openapi: "3.0.3",
        info: { title: "Validation API", version: "1.0.0" },
        servers: [{ url: "https://api.example.test" }],
        paths: {
          "/users/{id}": {
            get: {
              operationId: "getUser",
              parameters: [
                {
                  name: "id",
                  in: "path",
                  required: true,
                  schema: { type: "string" }
                }
              ],
              responses: { "200": { description: "OK" } }
            }
          }
        }
      },
      { source: "memory://validation" }
    );
    const tool = generateTools(spec)[0];
    if (!tool) {
      throw new Error("Expected a generated tool.");
    }

    const schema = createToolInputSchema(tool);

    expect(schema.safeParse({ id: "123" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("executes REST calls with path, query, body, and bearer token", async () => {
    const received: Array<{ url: string; method: string; authorization?: string; body: unknown }> = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const text = Buffer.concat(chunks).toString("utf8");
      received.push({
        url: request.url ?? "",
        method: request.method ?? "",
        authorization: request.headers.authorization,
        body: text.length > 0 ? JSON.parse(text) : null
      });

      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true }));
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("Expected test server to listen on a TCP port.");
      }

      const spec = normalizeSpec(
        {
          openapi: "3.0.3",
          info: { title: "HTTP API", version: "1.0.0" },
          servers: [{ url: `http://127.0.0.1:${address.port}` }],
          paths: {
            "/users/{id}": {
              patch: {
                operationId: "updateUser",
                parameters: [
                  { name: "id", in: "path", required: true, schema: { type: "string" } },
                  { name: "notify", in: "query", required: false, schema: { type: "boolean" } }
                ],
                requestBody: {
                  required: true,
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: { name: { type: "string" } },
                        required: ["name"]
                      }
                    }
                  }
                },
                responses: { "200": { description: "OK" } }
              }
            }
          }
        },
        { source: "memory://http" }
      );
      const tool = generateTools(spec)[0];
      if (!tool) {
        throw new Error("Expected a generated tool.");
      }

      const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const result = await executeHttpTool(
        spec,
        tool,
        { id: "abc 123", notify: true, body: { name: "Ada" } },
        { apiToken: "secret-token" }
      );
      const logs = logSpy.mock.calls.join("\n");
      logSpy.mockRestore();

      expect(result.status).toBe(200);
      expect(received[0]).toMatchObject({
        url: "/users/abc%20123?notify=true",
        method: "PATCH",
        authorization: "Bearer secret-token",
        body: { name: "Ada" }
      });
      expect(logs).not.toContain("secret-token");
      expect(logs).toContain("<redacted>");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("creates an MCP server with read-only tool filtering", () => {
    const spec = normalizeSpec(
      {
        openapi: "3.0.3",
        info: { title: "MCP API", version: "1.0.0" },
        servers: [{ url: "https://api.example.test" }],
        paths: {
          "/items": {
            get: { operationId: "listItems", responses: { "200": { description: "OK" } } },
            post: { operationId: "createItem", responses: { "200": { description: "OK" } } }
          }
        }
      },
      { source: "memory://mcp" }
    );

    expect(() => createOpenApiDoctorMcpServer(spec, { readOnly: true })).not.toThrow();
    expect(generateTools(spec, { readOnly: true })).toHaveLength(1);
  });
});
