import { describe, expect, it } from "vitest";

import { normalizeSpec } from "../src/ingestion/normalizeSpec.js";
import { formatDoctorReport } from "../src/doctor/report.js";
import { scoreSpec } from "../src/doctor/scoreSpec.js";

describe("OpenAPI Doctor quality report", () => {
  it("detects operation quality, safety, schema, response, and auth issues", () => {
    const spec = normalizeSpec(
      {
        openapi: "3.0.3",
        info: { title: "Quality Test API", version: "1.0.0" },
        paths: {
          "/users/{id}": {
            get: {
              parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
              responses: {
                "200": { description: "OK" }
              }
            }
          },
          "/users": {
            post: {
              operationId: "createUser",
              summary: "Create user",
              responses: {
                "200": { description: "OK" },
                "400": { description: "Bad request" }
              }
            }
          },
          "/users/{id}/delete": {
            delete: {
              operationId: "deleteUser",
              summary: "Delete user",
              description: "Delete a user by ID.",
              responses: {
                "204": { description: "Deleted" }
              }
            }
          }
        }
      },
      { source: "memory://quality-test" }
    );

    const report = scoreSpec(spec);
    const codes = report.issues.map((issue) => issue.code);

    expect(report.totalOperations).toBe(3);
    expect(report.readOperations).toBe(1);
    expect(report.writeOperations).toBe(1);
    expect(report.destructiveOperations).toBe(1);
    expect(codes).toContain("missing_operation_id");
    expect(codes).toContain("missing_summary");
    expect(codes).toContain("missing_description");
    expect(codes).toContain("missing_parameter_description");
    expect(codes).toContain("missing_request_body_schema");
    expect(codes).toContain("missing_response_schema");
    expect(codes).toContain("missing_error_responses");
    expect(codes).toContain("destructive_endpoint");
    expect(codes).toContain("write_endpoint");
    expect(codes).toContain("auth_missing");
    expect(report.score).toBeLessThan(100);
  });

  it("detects ambiguous auth when schemes exist without operation or global security", () => {
    const spec = normalizeSpec(
      {
        openapi: "3.0.3",
        info: { title: "Auth API", version: "1.0.0" },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer"
            }
          }
        },
        paths: {
          "/profile": {
            get: {
              operationId: "getProfile",
              summary: "Get profile",
              description: "Get the current user profile.",
              responses: {
                "200": {
                  description: "OK",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object"
                      }
                    }
                  }
                },
                "401": { description: "Unauthorized" }
              }
            }
          }
        }
      },
      { source: "memory://auth-test" }
    );

    const report = scoreSpec(spec);

    expect(report.issues.map((issue) => issue.code)).toContain("auth_ambiguous");
  });

  it("formats issues grouped by severity", () => {
    const spec = normalizeSpec(
      {
        openapi: "3.0.3",
        info: { title: "Format API", version: "1.0.0" },
        paths: {
          "/items": {
            post: {
              responses: {
                "200": { description: "OK" }
              }
            }
          }
        }
      },
      { source: "memory://format-test" }
    );

    const output = formatDoctorReport(scoreSpec(spec));

    expect(output).toContain("Overall quality score:");
    expect(output).toContain("Total operations: 1");
    expect(output).toContain("Warning (");
    expect(output).toContain("Info (");
  });
});
