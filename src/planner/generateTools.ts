import { classifyEndpoint } from "../policy/classifyEndpoint.js";
import type {
  GeneratedTool,
  GeneratedToolParameterLocation,
  GenerateToolsOptions,
  JsonSchemaObject,
  NormalizedOpenApiSpec,
  NormalizedOperation
} from "../types/index.js";
import { ensureUniqueToolNames, nameTool } from "./nameTools.js";

export function generateTools(
  spec: NormalizedOpenApiSpec,
  options: GenerateToolsOptions = {}
): GeneratedTool[] {
  const plannedOperations = options.readOnly
    ? spec.operations.filter((operation) => classifyEndpoint(operation) === "SAFE_READ")
    : spec.operations;
  const names = ensureUniqueToolNames(plannedOperations.map(nameTool));

  return plannedOperations.map((operation, index) => {
    const input = generateInput(operation);

    return {
      name: names[index] ?? nameTool(operation),
      description: describeOperation(operation),
      inputSchema: input.schema,
      safetyLevel: classifyEndpoint(operation),
      method: operation.method,
      path: operation.path,
      operationId: operation.operation.operationId,
      parameters: input.parameters,
      hasRequestBody: input.hasRequestBody
    };
  });
}

function describeOperation(operation: NormalizedOperation): string {
  const parts = [operation.operation.summary, operation.operation.description]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());

  return parts.length > 0 ? parts.join("\n\n") : `${operation.method.toUpperCase()} ${operation.path}`;
}

function generateInput(operation: NormalizedOperation): {
  schema: JsonSchemaObject;
  parameters: GeneratedTool["parameters"];
  hasRequestBody: boolean;
} {
  const properties: Record<string, unknown> = {};
  const required = new Set<string>();
  const toolParameters: GeneratedTool["parameters"] = [];
  const parameters = [...operation.pathParameters, ...(operation.operation.parameters ?? [])];

  for (const parameter of parameters) {
    if (!isRecord(parameter) || typeof parameter.name !== "string") {
      continue;
    }

    const location = typeof parameter.in === "string" ? parameter.in : "unknown";
    if (!isToolParameterLocation(location)) {
      continue;
    }

    const schema: Record<string, unknown> = isRecord(parameter.schema)
      ? { ...parameter.schema }
      : { type: "string" };
    if (typeof parameter.description === "string" && parameter.description.trim().length > 0) {
      schema.description = parameter.description;
    }

    properties[parameter.name] = schema;

    if (location === "path" || parameter.required === true) {
      required.add(parameter.name);
    }

    toolParameters.push({
      name: parameter.name,
      location,
      required: location === "path" || parameter.required === true
    });
  }

  const bodySchema = getJsonRequestBodySchema(operation.operation.requestBody);
  if (bodySchema !== null) {
    properties.body = bodySchema;
    if (isRecord(operation.operation.requestBody) && operation.operation.requestBody.required === true) {
      required.add("body");
    }
  }

  const schema: JsonSchemaObject = {
    type: "object",
    properties,
    additionalProperties: false
  };

  if (required.size > 0) {
    schema.required = [...required];
  }

  return {
    schema,
    parameters: toolParameters,
    hasRequestBody: bodySchema !== null
  };
}

function getJsonRequestBodySchema(requestBody: unknown): unknown | null {
  if (!isRecord(requestBody) || !isRecord(requestBody.content)) {
    return null;
  }

  const jsonContent =
    requestBody.content["application/json"] ??
    requestBody.content["application/*+json"] ??
    Object.entries(requestBody.content).find(([mediaType]) => mediaType.endsWith("+json"))?.[1];

  if (!isRecord(jsonContent) || !isRecord(jsonContent.schema)) {
    return null;
  }

  return jsonContent.schema;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isToolParameterLocation(value: string): value is GeneratedToolParameterLocation {
  return value === "path" || value === "query" || value === "header";
}
