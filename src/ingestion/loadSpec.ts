import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPI } from "openapi-types";
import { parse as parseYaml } from "yaml";

import { resolveRefs } from "../parser/resolveRefs.js";
import type {
  LoadedOpenApiDocument,
  NormalizedOpenApiSpec,
  OpenApiDocument,
  RawSpecSource
} from "../types/index.js";
import { normalizeSpec } from "./normalizeSpec.js";

export async function loadSpec(specLocation: string): Promise<NormalizedOpenApiSpec> {
  const { source, document } = await loadSpecDocument(specLocation);

  const resolvedDocument = await resolveRefs(source.location, document);

  return normalizeSpec(resolvedDocument, { source: specLocation });
}

export async function loadSpecDocument(specLocation: string): Promise<LoadedOpenApiDocument> {
  const source = await loadRawSpec(specLocation);
  const document = parseSpecContent(source.content, source.location);

  await validateSpec(source.location, document);

  return {
    source,
    document
  };
}

async function loadRawSpec(specLocation: string): Promise<RawSpecSource> {
  if (isHttpUrl(specLocation)) {
    const response = await fetch(specLocation);
    if (!response.ok) {
      throw new Error(`Failed to fetch spec from ${specLocation}: ${response.status} ${response.statusText}`);
    }

    return {
      location: specLocation,
      content: await response.text()
    };
  }

  const absolutePath = resolve(specLocation);
  if (!existsSync(absolutePath)) {
    throw new Error(`Spec file not found: ${specLocation}`);
  }

  return {
    location: absolutePath,
    content: await readFile(absolutePath, "utf8")
  };
}

function parseSpecContent(content: string, location: string): OpenApiDocument {
  try {
    return JSON.parse(content) as OpenApiDocument;
  } catch {
    try {
      return parseYaml(content) as OpenApiDocument;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse spec as JSON or YAML from ${location}: ${message}`);
    }
  }
}

async function validateSpec(baseLocation: string, document: OpenApiDocument): Promise<OpenApiDocument> {
  const validatedDocument = await SwaggerParser.validate(
    baseLocation,
    document as unknown as OpenAPI.Document,
    {}
  );
  return validatedDocument as OpenApiDocument;
}

function isHttpUrl(value: string): boolean {
  return URL.canParse(value) && /^https?:$/.test(new URL(value).protocol);
}
