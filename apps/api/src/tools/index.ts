import type { QlooContext } from "../qloo/client.js";
import { businessTools } from "./business.js";
import { rawTools } from "./raw.js";
import type { ToolDef, ToolOutput } from "./types.js";

export type Toolset = "business" | "raw";

export const toolsets: Record<Toolset, ToolDef[]> = {
  business: businessTools,
  raw: rawTools,
};

export const allTools = new Map<string, ToolDef>([...businessTools, ...rawTools].map((t) => [t.name, t]));

/** Validate input with the tool's schema and run it; validation errors come back as status 'error'. */
export async function runTool(name: string, input: unknown, ctx: QlooContext): Promise<ToolOutput> {
  const tool = allTools.get(name);
  if (!tool) return { status: "error", data: null, callIds: [], note: `Unknown tool: ${name}` };
  const parsed = tool.input.safeParse(input);
  if (!parsed.success) {
    return { status: "error", data: null, callIds: [], note: `Invalid input: ${parsed.error.message}` };
  }
  try {
    return await tool.run(parsed.data, ctx);
  } catch (e) {
    return { status: "error", data: null, callIds: [], note: e instanceof Error ? e.message : String(e) };
  }
}

export type { ToolDef, ToolOutput } from "./types.js";
export { toAnthropicTool } from "./types.js";
