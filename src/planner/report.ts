import type { GeneratedTool } from "../types/index.js";

export function formatGeneratedTools(tools: GeneratedTool[]): string {
  const lines = [`Generated tools: ${tools.length}`];

  for (const tool of tools) {
    lines.push("");
    lines.push(`- ${tool.name}`);
    lines.push(`  Description: ${firstLine(tool.description)}`);
    lines.push(`  Operation: ${tool.method.toUpperCase()} ${tool.path}`);
    lines.push(`  Safety: ${tool.safetyLevel}`);
    lines.push(`  Inputs: ${formatInputs(tool)}`);
  }

  return lines.join("\n");
}

function firstLine(value: string): string {
  return value.split(/\r?\n/)[0] ?? value;
}

function formatInputs(tool: GeneratedTool): string {
  const names = Object.keys(tool.inputSchema.properties);
  if (names.length === 0) {
    return "none";
  }

  const required = new Set(tool.inputSchema.required ?? []);
  return names.map((name) => (required.has(name) ? `${name}*` : name)).join(", ");
}
