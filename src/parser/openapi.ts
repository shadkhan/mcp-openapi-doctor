import SwaggerParser from "@apidevtools/swagger-parser";

import type { SpecSource } from "../ingestion/source.js";
import type { ParsedOpenApiDocument } from "../types/openapi-doctor.js";

export async function parseOpenApiSpec(source: SpecSource): Promise<ParsedOpenApiDocument> {
  const document = await SwaggerParser.validate(JSON.parse(source.content));

  return {
    sourceLocation: source.location,
    document
  };
}
