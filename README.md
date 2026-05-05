# 🚀 MCP OpenAPI Doctor

### Turn any OpenAPI spec into **safe, agent-ready MCP tools** in seconds

> Stop manually integrating APIs into AI agents.
> Let your API become instantly usable by Claude.

---

## ⚡ What is this?

Most APIs are built for developers.

AI agents need:

- clear intent
- safe execution
- structured inputs

👉 MCP OpenAPI Doctor bridges that gap.

It takes your OpenAPI/Swagger spec and turns it into:

```text
clean → structured → safe → MCP tools
```

that Claude (and any MCP client) can use instantly.

---

## 🔥 Demo (What it feels like)

Run:

```bash
npx mcp-openapi-doctor serve https://api.example.com/openapi.json --read-only
```

Then in Claude:

```text
"What tools do you have?"
```

Claude:

```text
I can:
- retrieve users
- list orders
- fetch invoices
- search customers
```

---

## 🧠 Why this exists

Existing tools convert APIs → MCP.

But they expose raw endpoints like:

```text
GET /users/{id}
POST /orders
DELETE /account
```

Agents struggle with:

- unclear naming
- unsafe operations
- poor descriptions
- too many tools

---

## 💡 This project solves that

### ✅ Clean tool generation

```text
GET /users/{id}
→ get_user_by_id
```

---

### 🛡️ Built-in safety

- read-only mode
- destructive endpoint detection
- sensitive path filtering

---

### 🧪 API quality insights

```bash
mcp-openapi-doctor inspect ./api.yaml
```

```text
Score: 72/100

Issues:
- Missing operationId
- Missing request schema
- Unsafe DELETE endpoints
```

---

### ⚡ Instant MCP server

No glue code. No manual integration.

```bash
mcp-openapi-doctor serve ./api.yaml
```

---

## 🧩 How it works

```text
OpenAPI Spec
   ↓
Parse & Normalize
   ↓
Quality Doctor
   ↓
Tool Generator
   ↓
Safety Filter
   ↓
MCP Server
   ↓
Claude / MCP Client
```

---

## 🚀 Quick Start

Use `pnpm` when available; fall back to `npm` if not.

```bash
pnpm install
pnpm build
pnpm test
```

Fallback:

```bash
npm install
npm run build
npm test
```

### 1. Run directly (no install)

```bash
npx mcp-openapi-doctor serve ./openapi.yaml --read-only
```

---

### 2. Or install globally

```bash
npm install -g mcp-openapi-doctor
```

```bash
mcp-openapi-doctor serve ./openapi.yaml
```

---

## 🔌 Connect to Claude

Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "openapi-doctor": {
      "command": "npx",
      "args": ["mcp-openapi-doctor", "serve", "./openapi.yaml", "--read-only"],
      "env": {
        "API_TOKEN": "your_api_token_here"
      }
    }
  }
}
```

Restart Claude.

---

## 💬 Usage

Ask Claude:

```text
What tools do you have?
Find user 123
List recent orders
```

Claude will call your API via MCP automatically.

---

## 🛡️ Safety First

Default best practice:

```bash
--read-only
```

This ensures:

- no writes
- no deletes
- safe exploration

---

## 🧰 CLI Commands

```bash
inspect <spec>     # analyze API quality
generate <spec>    # preview MCP tools
serve <spec>       # run MCP server
```

---

## 🎯 Who is this for?

- AI engineers building agents
- developers integrating APIs into Claude
- startups building AI copilots
- anyone tired of manual API wiring

---

## ⚠️ What this is NOT

- Not an API gateway
- Not a replacement for your backend
- Not modifying your API

👉 It’s a **translation layer for agents**

---

## 🧠 Mental Model

```text
API = raw ingredients
MCP OpenAPI Doctor = cooked meal for agents
```

---

## 🗺️ Roadmap

- smarter tool descriptions
- endpoint grouping
- approval workflows
- web UI
- Postman support
- analytics

---

## 🤝 Contributing

We welcome contributions.

Please:

- keep PRs small
- follow project structure
- avoid feature creep

---

## ⭐ Why star this repo?

If this saves you time:

👉 Give it a star
👉 Share with your team
👉 Build something cool on top

---

## 🧪 Example APIs to try

- Stripe-like APIs
- CRM APIs
- internal microservices
- public REST APIs

---

## 📄 License

Apache 2.0

---

## 🧠 Final Thought

AI agents are only as powerful as the tools they can use.

This project makes **every API instantly usable as a tool.**

---

# ⭐ If this helps you, star the repo!
