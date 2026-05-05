# Examples

Use these fixtures to test `mcp-openapi-doctor inspect`.

```bash
pnpm start -- inspect ./examples/simple-openapi.yaml
pnpm start -- inspect ./examples/clean-read-api.yaml
pnpm start -- inspect ./examples/risky-crm-api.yaml
pnpm start -- inspect ./examples/swagger-2-api.json
```

What each file is useful for:

- `simple-openapi.yaml` checks basic OpenAPI 3 loading and `$ref` resolution.
- `clean-read-api.yaml` is a mostly healthy read-only API.
- `risky-crm-api.yaml` intentionally triggers write, destructive, auth, schema, and documentation issues.
- `swagger-2-api.json` verifies Swagger 2.0 JSON support.
