# MCP OpenAPI Doctor

Turn any OpenAPI or Swagger spec into safe, clean, agent-ready MCP tools.

OpenAPI Doctor is not just OpenAPI to MCP conversion. It validates, scores, curates, fixes metadata gaps, and safely exposes APIs as MCP tools.

## What It Does

MCP OpenAPI Doctor helps agents use APIs safely by:

- Loading OpenAPI 3.x and Swagger 2.0 specs from files or URLs.
- Supporting JSON and YAML.
- Resolving `$ref` references.
- Scoring API quality with Doctor checks.
- Previewing generated MCP tools.
- Creating advisory fixed specs without changing the original file.
- Serving generated tools through an MCP stdio server.
- Enforcing read-only mode for safer agent exploration.

## Quick Start

Use `pnpm` when available. Fall back to `npm` if needed.

```bash
pnpm install
pnpm build
pnpm test
```

NPM fallback:

```bash
npm install
npm run build
npm test
```

## Try The Examples

Inspect API quality:

```bash
pnpm start -- inspect ./examples/simple-openapi.yaml
pnpm start -- inspect ./examples/clean-read-api.yaml
pnpm start -- inspect ./examples/risky-crm-api.yaml
pnpm start -- inspect ./examples/swagger-2-api.json
pnpm start -- inspect ./examples/petstore-openapi.json
```

Preview generated MCP tools:

```bash
pnpm start -- generate ./examples/simple-openapi.yaml
pnpm start -- generate ./examples/simple-openapi.yaml --json
pnpm start -- generate ./examples/risky-crm-api.yaml --read-only
```

Generate advisory fixes:

```bash
pnpm start -- fix ./examples/risky-crm-api.yaml --out .output/
pnpm start -- fix ./examples/risky-crm-api.yaml --out .output/ --diff
```

Start the MCP server:

```bash
pnpm start -- serve ./examples/simple-openapi.yaml --read-only
```

The `serve` command runs over stdio and waits for an MCP client, so the terminal may look idle. That is expected.

## CLI Commands

```bash
mcp-openapi-doctor inspect <spec>
mcp-openapi-doctor generate <spec> [--read-only] [--json]
mcp-openapi-doctor fix <spec> --out .output/ [--diff]
mcp-openapi-doctor serve <spec> [--read-only]
```

During local development, use:

```bash
pnpm start -- inspect <spec>
pnpm start -- generate <spec>
pnpm start -- fix <spec> --out .output/
pnpm start -- serve <spec> --read-only
```

## Inspect

`inspect` loads the spec, resolves references, validates OpenAPI/Swagger compatibility, and prints a quality report.

```bash
pnpm start -- inspect ./examples/risky-crm-api.yaml
```

Output includes:

- API title
- API version
- path count
- operation count
- OpenAPI/Swagger version
- overall quality score
- read/write/destructive operation counts
- issues grouped by severity

Doctor checks currently detect:

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

## Generate

`generate` previews the MCP tools that would be exposed.

```bash
pnpm start -- generate ./examples/simple-openapi.yaml
```

Example:

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

Use JSON output for scripts:

```bash
pnpm start -- generate ./examples/simple-openapi.yaml --json
```

Use read-only preview to show only `SAFE_READ` tools:

```bash
pnpm start -- generate ./examples/risky-crm-api.yaml --read-only
```

## Fix

`fix` creates advisory output files in a target folder. It never modifies the original OpenAPI file.

```bash
pnpm start -- fix ./examples/risky-crm-api.yaml --out .output/
```

Generated files:

```text
.output/
  cleaned-openapi.yaml
  doctor-report.json
  fixes.md
  summary.md
```

With `--diff`:

```bash
pnpm start -- fix ./examples/risky-crm-api.yaml --out .output/ --diff
```

Additional files:

```text
.output/
  diff.md
  diff.json
```

The cleaned spec may:

- add missing `operationId`
- normalize `operationId` to `snake_case`
- add fallback summaries and descriptions
- add generic parameter descriptions
- add placeholder request body schemas
- add placeholder response schemas

Important limits:

- It does not remove endpoints.
- It does not change runtime behavior.
- It does not modify the source file.
- It does not use the cleaned spec in `serve` yet.
- It is advisory and deterministic, not AI rewriting.

`summary.md` shows:

- previous score
- current score after fix
- top issues fixed
- remaining issues
- owner actions

## Serve

`serve` starts an MCP server over stdio using `@modelcontextprotocol/sdk`.

```bash
pnpm start -- serve ./examples/simple-openapi.yaml --read-only
```

Runtime behavior:

- dynamically registers generated tools
- validates tool input with Zod
- calls the target REST API using Node `fetch`
- supports bearer auth through `API_TOKEN`
- uses `servers[0].url` as the base URL for OpenAPI 3.x
- supports Swagger 2.0 `host`, `basePath`, and `schemes`
- enforces read-only mode
- redacts `Authorization` headers in logs

Use `--read-only` for safer agent testing:

```bash
pnpm start -- serve ./examples/simple-openapi.yaml --read-only
```

## Claude Desktop Config

Build first:

```bash
pnpm build
```

For local development, add this to Claude Desktop config. Adjust paths for your machine:

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
        "API_TOKEN": "your_api_token_here"
      }
    }
  }
}
```

Restart Claude Desktop, then ask:

```text
What tools do you have?
```

For a published package, the config can use `npx`:

```json
{
  "mcpServers": {
    "openapi-doctor": {
      "command": "npx",
      "args": [
        "mcp-openapi-doctor",
        "serve",
        "./openapi.yaml",
        "--read-only"
      ],
      "env": {
        "API_TOKEN": "your_api_token_here"
      }
    }
  }
}
```

## Examples

Included fixtures:

- `examples/simple-openapi.yaml`: basic OpenAPI 3 spec with refs.
- `examples/clean-read-api.yaml`: clean read-only API that should score well.
- `examples/risky-crm-api.yaml`: intentionally problematic CRM API for Doctor/fix testing.
- `examples/swagger-2-api.json`: Swagger 2.0 compatibility fixture.
- `examples/petstore-openapi.json`: Swagger Petstore OpenAPI 3 example.

## Project Layout

```text
src/
  cli/        CLI commands
  ingestion/  Load, parse, validate, and normalize specs
  parser/     Reference resolution
  doctor/     Quality checks, scoring, reports, and fix output
  planner/    MCP tool generation and naming
  policy/     Safety classification
  runtime/    MCP stdio server and HTTP execution
  config/     Defaults and configuration
  types/      Shared TypeScript types
tests/        Vitest tests
examples/     Example OpenAPI and Swagger specs
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

## Safety Model

Endpoint safety levels:

```text
GET             -> SAFE_READ
POST/PUT/PATCH  -> WRITE
DELETE          -> DESTRUCTIVE
sensitive paths -> SENSITIVE
```

Sensitive paths include terms like:

```text
admin
billing
payment
secret
token
credential
```

Read-only mode exposes only `SAFE_READ` tools.

## What This Is Not

- Not an API gateway.
- Not a replacement for backend authorization.
- Not a UI dashboard.
- Not an OAuth flow manager.
- Not AI-based spec rewriting.
- Not a tool that modifies your original OpenAPI file.

## License

MIT
