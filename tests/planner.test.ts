import { describe, expect, it } from "vitest";

import { loadSpec } from "../src/ingestion/loadSpec.js";
import { normalizeSpec } from "../src/ingestion/normalizeSpec.js";
import { generateTools } from "../src/planner/generateTools.js";

describe("generateTools", () => {
  it("generates one MCP tool per OpenAPI operation", async () => {
    const spec = await loadSpec("examples/clean-read-api.yaml");
    const tools = generateTools(spec);

    expect(tools).toHaveLength(2);
    expect(tools.map((tool) => tool.name)).toEqual(["list_customers", "get_customer_by_id"]);
    expect(tools.every((tool) => tool.safetyLevel === "SAFE_READ")).toBe(true);
    expect(tools[0]?.description).toContain("List customers");
  });

  it("generates names from method and path when operationId is missing", () => {
    const spec = normalizeSpec(
      {
        openapi: "3.0.3",
        info: { title: "Fallback API", version: "1.0.0" },
        paths: {
          "/users/{id}/orders": {
            get: {
              summary: "List user orders",
              responses: {
                "200": {
                  description: "OK",
                  content: {
                    "application/json": {
                      schema: { type: "array", items: { type: "object" } }
                    }
                  }
                },
                "400": { description: "Bad request" }
              }
            }
          }
        }
      },
      { source: "memory://fallback" }
    );

    expect(generateTools(spec)[0]?.name).toBe("get_users_id_orders");
  });

  it("generates input schema from parameters and JSON request body", async () => {
    const spec = await loadSpec("examples/risky-crm-api.yaml");
    const tools = generateTools(spec);
    const updateContact = tools.find((tool) => tool.name === "update_contact");

    expect(updateContact).toBeDefined();
    expect(updateContact?.safetyLevel).toBe("WRITE");
    expect(updateContact?.inputSchema.properties.id).toMatchObject({ type: "string" });
    expect(updateContact?.inputSchema.properties.body).toMatchObject({
      type: "object",
      properties: {
        name: { type: "string" }
      }
    });
    expect(updateContact?.inputSchema.required).toContain("id");
    expect(updateContact?.inputSchema.required).toContain("body");
  });

  it("marks destructive and sensitive endpoints", () => {
    const spec = normalizeSpec(
      {
        openapi: "3.0.3",
        info: { title: "Safety API", version: "1.0.0" },
        paths: {
          "/users/{id}": {
            delete: {
              operationId: "deleteUser",
              responses: { "204": { description: "Deleted" } }
            }
          },
          "/billing/accounts": {
            get: {
              operationId: "listBillingAccounts",
              responses: {
                "200": {
                  description: "OK",
                  content: {
                    "application/json": {
                      schema: { type: "array", items: { type: "object" } }
                    }
                  }
                },
                "401": { description: "Unauthorized" }
              }
            }
          }
        }
      },
      { source: "memory://safety" }
    );

    const tools = generateTools(spec);

    expect(tools.find((tool) => tool.name === "delete_user")?.safetyLevel).toBe("DESTRUCTIVE");
    expect(tools.find((tool) => tool.name === "list_billing_accounts")?.safetyLevel).toBe("SENSITIVE");
  });

  it("read-only mode excludes write, destructive, and sensitive tools", async () => {
    const spec = await loadSpec("examples/risky-crm-api.yaml");
    const tools = generateTools(spec, { readOnly: true });

    expect(tools).toHaveLength(1);
    expect(tools[0]?.method).toBe("get");
    expect(tools[0]?.safetyLevel).toBe("SAFE_READ");
  });
});
