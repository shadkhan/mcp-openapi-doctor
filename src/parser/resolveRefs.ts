import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPI } from "openapi-types";

import type { OpenApiDocument } from "../types/index.js";

export async function resolveRefs(
  baseLocation: string,
  document: OpenApiDocument
): Promise<OpenApiDocument> {
  const resolvedDocument = await SwaggerParser.dereference(
    baseLocation,
    document as unknown as OpenAPI.Document,
    {}
  );
  return resolvedDocument as OpenApiDocument;
}
