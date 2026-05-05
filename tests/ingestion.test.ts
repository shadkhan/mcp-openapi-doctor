import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { loadSpec } from "../src/ingestion/loadSpec.js";

describe("loadSpec", () => {
  it("loads and summarizes a YAML OpenAPI 3 spec with refs", async () => {
    const spec = await loadSpec("examples/simple-openapi.yaml");

    expect(spec.title).toBe("Simple Example API");
    expect(spec.version).toBe("1.0.0");
    expect(spec.openApiVersion).toBe("3.0.3");
    expect(spec.pathCount).toBe(2);
    expect(spec.operationCount).toBe(2);
    expect(spec.dialect).toBe("openapi-3");
  });

  it("loads a spec from a URL", async () => {
    const server = createServer((_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          openapi: "3.1.0",
          info: { title: "Remote API", version: "0.1.0" },
          paths: {
            "/status": {
              get: {
                operationId: "getStatus",
                responses: {
                  "200": { description: "OK" }
                }
              }
            }
          }
        })
      );
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

      const spec = await loadSpec(`http://127.0.0.1:${address.port}/openapi.json`);

      expect(spec.title).toBe("Remote API");
      expect(spec.openApiVersion).toBe("3.1.0");
      expect(spec.pathCount).toBe(1);
      expect(spec.operationCount).toBe(1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("loads and summarizes a JSON Swagger 2.0 spec", async () => {
    const filePath = join(tmpdir(), `swagger-${Date.now()}.json`);
    await writeFile(
      filePath,
      JSON.stringify({
        swagger: "2.0",
        info: { title: "Legacy API", version: "2.1.0" },
        paths: {
          "/ping": {
            get: {
              operationId: "ping",
              responses: {
                "200": { description: "OK" }
              }
            }
          }
        }
      }),
      "utf8"
    );

    const spec = await loadSpec(filePath);

    expect(spec.title).toBe("Legacy API");
    expect(spec.version).toBe("2.1.0");
    expect(spec.openApiVersion).toBe("2.0");
    expect(spec.pathCount).toBe(1);
    expect(spec.operationCount).toBe(1);
    expect(spec.dialect).toBe("swagger-2");
  });
});
