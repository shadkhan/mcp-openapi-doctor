import type { GeneratedTool, NormalizedOpenApiSpec } from "../types/index.js";

export interface ExecuteHttpToolOptions {
  apiToken?: string;
  fetchImpl?: typeof fetch;
}

export interface HttpToolResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
}

export async function executeHttpTool(
  spec: NormalizedOpenApiSpec,
  tool: GeneratedTool,
  args: Record<string, unknown>,
  options: ExecuteHttpToolOptions = {}
): Promise<HttpToolResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = buildRequestUrl(resolveBaseUrl(spec), tool, args);
  const headers = buildHeaders(tool, args, options.apiToken);
  const init: RequestInit = {
    method: tool.method.toUpperCase(),
    headers
  };

  if (tool.hasRequestBody && typeof args.body !== "undefined") {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(args.body);
  }

  logRequest(tool.method.toUpperCase(), url, headers);

  const response = await fetchImpl(url, init);
  const responseHeaders = Object.fromEntries(response.headers.entries());

  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: await parseResponseBody(response)
  };
}

export function resolveBaseUrl(spec: NormalizedOpenApiSpec): string {
  const serverUrl = spec.document.servers?.[0]?.url;
  if (typeof serverUrl === "string" && serverUrl.trim().length > 0) {
    return serverUrl;
  }

  if (spec.document.swagger === "2.0" && typeof spec.document.host === "string") {
    const scheme = spec.document.schemes?.[0] ?? "https";
    const basePath = spec.document.basePath ?? "";
    return `${scheme}://${spec.document.host}${basePath}`;
  }

  throw new Error("OpenAPI spec does not define servers[0].url.");
}

function buildRequestUrl(baseUrl: string, tool: GeneratedTool, args: Record<string, unknown>): URL {
  let path = tool.path;

  for (const parameter of tool.parameters.filter((parameter) => parameter.location === "path")) {
    const value = args[parameter.name];
    if (typeof value === "undefined") {
      continue;
    }

    path = path.replace(`{${parameter.name}}`, encodeURIComponent(String(value)));
  }

  const url = new URL(path.replace(/^\//, ""), ensureTrailingSlash(baseUrl));

  for (const parameter of tool.parameters.filter((parameter) => parameter.location === "query")) {
    const value = args[parameter.name];
    if (typeof value === "undefined" || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(parameter.name, String(item));
      }
      continue;
    }

    url.searchParams.set(parameter.name, String(value));
  }

  return url;
}

function buildHeaders(tool: GeneratedTool, args: Record<string, unknown>, apiToken?: string): Headers {
  const headers = new Headers({
    accept: "application/json"
  });

  if (typeof apiToken === "string" && apiToken.trim().length > 0) {
    headers.set("authorization", `Bearer ${apiToken}`);
  }

  for (const parameter of tool.parameters.filter((parameter) => parameter.location === "header")) {
    const value = args[parameter.name];
    if (typeof value !== "undefined" && value !== null) {
      headers.set(parameter.name, String(value));
    }
  }

  return headers;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

function logRequest(method: string, url: URL, headers: Headers): void {
  const redactedHeaders = Object.fromEntries(headers.entries());
  if ("authorization" in redactedHeaders) {
    redactedHeaders.authorization = "<redacted>";
  }

  console.error(`[mcp-openapi-doctor] ${method} ${url.toString()} headers=${JSON.stringify(redactedHeaders)}`);
}
