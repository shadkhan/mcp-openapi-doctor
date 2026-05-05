import { z } from "zod";

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { executeHttpTool, type ExecuteHttpToolOptions } from "./httpClient.js";
import type { GeneratedTool, JsonSchemaObject, NormalizedOpenApiSpec } from "../types/index.js";

export interface CreateToolHandlerOptions extends ExecuteHttpToolOptions {
  spec: NormalizedOpenApiSpec;
  tool: GeneratedTool;
}

export function createToolInputSchema(tool: GeneratedTool): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set(tool.inputSchema.required ?? []);

  for (const [name, schema] of Object.entries(tool.inputSchema.properties)) {
    const zodSchema = jsonSchemaToZod(schema);
    shape[name] = required.has(name) ? zodSchema : zodSchema.optional();
  }

  return z.object(shape).strict();
}

export function createToolHandler(options: CreateToolHandlerOptions) {
  return async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const result = await executeHttpTool(options.spec, options.tool, args, {
      apiToken: options.apiToken,
      fetchImpl: options.fetchImpl
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  };
}

function jsonSchemaToZod(schema: unknown): z.ZodTypeAny {
  if (!isRecord(schema)) {
    return z.unknown();
  }

  const schemaRecord = schema as Record<string, unknown>;
  const enumValues = Array.isArray(schemaRecord.enum) ? schemaRecord.enum.filter(isPrimitiveLiteral) : [];
  if (enumValues.length === 1) {
    return z.literal(enumValues[0]);
  }
  if (enumValues.length > 1) {
    return z.enum(enumValues.map(String) as [string, ...string[]]);
  }

  switch (schema.type) {
    case "string":
      return z.string();
    case "integer":
      return z.number().int();
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      return z.array(jsonSchemaToZod(schemaRecord.items));
    case "object":
      return objectSchemaToZod(schema as Record<string, unknown>);
    default:
      return z.unknown();
  }
}

function objectSchemaToZod(schema: Record<string, unknown>): z.ZodTypeAny {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = new Set(Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === "string") : []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [name, propertySchema] of Object.entries(properties)) {
    const zodSchema = jsonSchemaToZod(propertySchema);
    shape[name] = required.has(name) ? zodSchema : zodSchema.optional();
  }

  return z.object(shape);
}

function isRecord(value: unknown): value is JsonSchemaObject | Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPrimitiveLiteral(value: unknown): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}
