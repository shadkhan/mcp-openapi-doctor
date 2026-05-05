import { readFile } from "node:fs/promises";

import { z } from "zod";

export const specSourceSchema = z.object({
  location: z.string().min(1),
  content: z.string().min(1)
});

export type SpecSource = z.infer<typeof specSourceSchema>;

export async function loadSpecSource(location: string): Promise<SpecSource> {
  if (URL.canParse(location) && /^https?:$/.test(new URL(location).protocol)) {
    const response = await fetch(location);
    if (!response.ok) {
      throw new Error(`Failed to fetch spec from ${location}: ${response.status} ${response.statusText}`);
    }

    return specSourceSchema.parse({
      location,
      content: await response.text()
    });
  }

  return specSourceSchema.parse({
    location,
    content: await readFile(location, "utf8")
  });
}
