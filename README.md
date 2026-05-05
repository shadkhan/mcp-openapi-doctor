# MCP OpenAPI Doctor

Turn OpenAPI and Swagger specs into safer, cleaner, agent-ready MCP tools.

`mcp-openapi-doctor` is both:

- a CLI for inspecting, fixing, and previewing OpenAPI specs
- an MCP stdio server for exposing generated API tools to clients such as Claude Desktop

It is not just OpenAPI to MCP conversion. It validates, scores, curates, creates advisory fixes, and safely exposes API operations as MCP tools.

## What You Can Do

- Inspect OpenAPI 3.x or Swagger 2.0 specs from a local file or URL.
- Generate a quality report for agent readiness.
- Preview MCP tools before serving them.
- Create a cleaned advisory spec without modifying the original file.
- Generate optional diff and MCP overlay outputs.
- Serve generated tools over MCP stdio.
- Use `--read-only` to expose only safe read tools.

## Install-Free Usage With npx

```bash
npx mcp-openapi-doctor --help
npx mcp-openapi-doctor inspect ./openapi.yaml
npx mcp-openapi-doctor generate ./openapi.yaml
npx mcp-openapi-doctor fix ./openapi.yaml --out .output/ --diff --overlay
npx mcp-openapi-doctor serve ./openapi.yaml --read-only
```

The `serve` command starts an MCP stdio server and waits for an MCP client. A quiet terminal is expected.

## Recommended User Flow

### 1. Inspect Your Spec

Start by checking whether the API is ready for agents:

```bash
npx mcp-openapi-doctor inspect ./openapi.yaml
```

For a remote spec:

```bash
npx mcp-openapi-doctor inspect https://petstore3.swagger.io/api/v3/openapi.json
```

`inspect` prints:

- API title
- API version
- path count
- operation count
- OpenAPI/Swagger version
- quality score
- read/write/destructive operation counts
- issues grouped by severity

### 2. Generate Advisory Fixes

Create a cleaned copy and reports:

```bash
npx mcp-openapi-doctor fix ./openapi.yaml --out .output/
```

Generate diff files too:

```bash
npx mcp-openapi-doctor fix ./openapi.yaml --out .output/ --diff
```

Generate diff plus MCP overlay metadata:

```bash
npx mcp-openapi-doctor fix ./openapi.yaml --out .output/ --diff --overlay
```

Output files:

```text
.output/
  cleaned-openapi.yaml
  doctor-report.json
  fixes.md
  summary.md
```

With `--diff`:

```text
.output/
  diff.md
  diff.json
```

With `--overlay`:

```text
.output/
  mcp-overlay.yaml
```

Important:

- The original spec is never modified.
- `cleaned-openapi.yaml` is advisory output.
- The local runtime does not use `cleaned-openapi.yaml` automatically yet.
- `mcp-overlay.yaml` is only useful for tools that support OpenAPI overlays or `x-mcp` metadata.

### 3. Review The Summary

Open:

```text
.output/summary.md
```

It shows:

- previous score
- current score after fix
- top issues fixed
- remaining issues
- owner actions

### 4. Preview MCP Tools

Preview what MCP tools would be generated:

```bash
npx mcp-openapi-doctor generate ./openapi.yaml
```

Preview only safe read tools:

```bash
npx mcp-openapi-doctor generate ./openapi.yaml --read-only
```

Get machine-readable output:

```bash
npx mcp-openapi-doctor generate ./openapi.yaml --json
```

### 5. Serve Tools To An MCP Client

Start the MCP server:

```bash
npx mcp-openapi-doctor serve ./openapi.yaml --read-only
```

For APIs that require bearer auth:

```bash
API_TOKEN=your_token_here npx mcp-openapi-doctor serve ./openapi.yaml --read-only
```

On PowerShell:

```powershell
$env:API_TOKEN="your_token_here"
npx mcp-openapi-doctor serve ./openapi.yaml --read-only
```

## Local Development

Use `pnpm` first. Fall back to `npm` only if needed.

```bash
pnpm install
pnpm build
pnpm test
```

Run CLI commands locally:

```bash
pnpm start -- inspect ./examples/simple-openapi.yaml
pnpm start -- generate ./examples/simple-openapi.yaml
pnpm start -- fix ./examples/risky-crm-api.yaml --out .output/ --diff --overlay
pnpm start -- serve ./examples/simple-openapi.yaml --read-only
```

NPM fallback:

```bash
npm install
npm run build
npm test
npm start -- inspect ./examples/simple-openapi.yaml
```

## Commands

```bash
mcp-openapi-doctor inspect <spec>
mcp-openapi-doctor generate <spec> [--read-only] [--json]
mcp-openapi-doctor fix <spec> --out .output/ [--diff] [--overlay]
mcp-openapi-doctor serve <spec> [--read-only]
```

## inspect

```bash
mcp-openapi-doctor inspect <spec>
```

Runs Doctor checks:

- missing `operationId`
- missing `summary`
- missing `description`
- missing parameter descriptions
- missing request body schemas for `POST`, `PUT`, and `PATCH`
- missing response schemas
- missing error responses
- destructive `DELETE` endpoints
- write endpoints
- missing or ambiguous auth

Example:

```bash
npx mcp-openapi-doctor inspect ./examples/risky-crm-api.yaml
```

## generate

```bash
mcp-openapi-doctor generate <spec> [--read-only] [--json]
```

Example output:

```text
Generated tools: 2

- list_users
  Description: List users
  Operation: GET /users
  Safety: SAFE_READ
  Inputs: none

- get_user
  Description: Get a user
  Operation: GET /users/{id}
  Safety: SAFE_READ
  Inputs: id*
```

Tool generation rules:

- one OpenAPI operation becomes one MCP tool
- tool name comes from `operationId`
- fallback name comes from method and path
- path/query/header parameters become tool inputs
- JSON request body becomes the `body` input
- each tool gets a safety level

## fix

```bash
mcp-openapi-doctor fix <spec> --out .output/ [--diff] [--overlay]
```

The fixer safely creates a cleaned copy. It may:

- add missing `operationId`
- normalize `operationId` to snake_case
- add fallback summaries
- add fallback descriptions
- add generic parameter descriptions
- add placeholder request body schemas
- add placeholder response schemas

It will not:

- remove endpoints
- change API behavior
- modify the source file
- use AI rewriting
- feed the cleaned spec into runtime automatically

## MCP Overlay

When `--overlay` is enabled, `fix` writes:

```text
.output/mcp-overlay.yaml
```

Example shape:

```yaml
x-mcp:
  version: "0.1"
  source: ./openapi.yaml#cleaned
  tools:
    get_user:
      operationId: get_user
      method: get
      path: /users/{id}
      safety: SAFE_READ
      enabled: true
```

Use `cleaned-openapi.yaml` with any OpenAPI-to-MCP server.

Use `mcp-overlay.yaml` only with tools or gateways that support OpenAPI overlays or `x-mcp` extensions. Do not assume every MCP server reads it.

## serve

```bash
mcp-openapi-doctor serve <spec> [--read-only]
```

Runtime behavior:

- starts an MCP server over stdio
- dynamically registers generated tools
- validates tool input with Zod
- calls the target REST API with Node `fetch`
- uses `servers[0].url` for OpenAPI 3.x
- uses `schemes`, `host`, and `basePath` for Swagger 2.0
- injects `API_TOKEN` as a bearer token when present
- redacts `Authorization` headers in logs
- enforces `--read-only`

## Claude Desktop

### Use the published package

```json
{
  "mcpServers": {
    "openapi-doctor": {
      "command": "npx",
      "args": [
        "mcp-openapi-doctor",
        "serve",
        "D:/absolute/path/to/openapi.yaml",
        "--read-only"
      ],
      "env": {
        "API_TOKEN": "your_token_here"
      }
    }
  }
}
```

### Use a local clone

Build first:

```bash
pnpm build
```

Then configure Claude Desktop:

```json
{
  "mcpServers": {
    "openapi-doctor": {
      "command": "node",
      "args": [
        "D:/AI_Projects/MCP-OpenAPI-Doctor/mcp-openapi-doctor/dist/cli/index.js",
        "serve",
        "D:/AI_Projects/MCP-OpenAPI-Doctor/mcp-openapi-doctor/examples/simple-openapi.yaml",
        "--read-only"
      ],
      "env": {
        "API_TOKEN": "your_token_here"
      }
    }
  }
}
```

Restart Claude Desktop and ask:

```text
What tools do you have?
```

## Use With Other OpenAPI-To-MCP Servers

You can use OpenAPI Doctor as a preprocessor:

```bash
npx mcp-openapi-doctor fix ./stripe.yaml --out ./output/ --diff --overlay
```

Then pass the cleaned spec to another tool:

```bash
# Example patterns. Check each tool's docs for exact flags.
npx @aws/openapi-mcp-server --spec ./output/cleaned-openapi.yaml
fastmcp run ./output/cleaned-openapi.yaml
tyk api-to-mcp --spec ./output/cleaned-openapi.yaml
```

If that tool supports overlays or `x-mcp` metadata, also use:

```text
./output/mcp-overlay.yaml
```

## Examples

Included fixtures:

```text
examples/simple-openapi.yaml
examples/clean-read-api.yaml
examples/risky-crm-api.yaml
examples/swagger-2-api.json
examples/petstore-openapi.json
```

Try them:

```bash
pnpm start -- inspect ./examples/clean-read-api.yaml
pnpm start -- inspect ./examples/risky-crm-api.yaml
pnpm start -- fix ./examples/risky-crm-api.yaml --out .output/ --diff --overlay
pnpm start -- inspect ./examples/swagger-2-api.json
pnpm start -- inspect ./examples/petstore-openapi.json
pnpm start -- serve ./examples/simple-openapi.yaml --read-only
```

## Safety Model

```text
GET             -> SAFE_READ
POST/PUT/PATCH  -> WRITE
DELETE          -> DESTRUCTIVE
sensitive paths -> SENSITIVE
```

Sensitive path terms include:

```text
admin
billing
payment
secret
token
credential
```

Read-only mode exposes only `SAFE_READ` tools.

## Project Layout

```text
src/
  cli/        CLI commands
  ingestion/  load, parse, validate, and normalize specs
  parser/     reference resolution
  doctor/     quality checks, reports, advisory fixes, overlays
  planner/    MCP tool generation and naming
  policy/     safety classification
  runtime/    MCP stdio server and HTTP execution
  config/     defaults
  types/      shared TypeScript types
tests/        Vitest tests
examples/     example OpenAPI and Swagger specs
```

## Scripts

```bash
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm start -- <command>
```

## What This Is Not

- Not an API gateway.
- Not a replacement for backend authorization.
- Not a UI dashboard.
- Not an OAuth flow manager.
- Not AI-based spec rewriting.
- Not a tool that modifies your original OpenAPI file.

## License

MIT
