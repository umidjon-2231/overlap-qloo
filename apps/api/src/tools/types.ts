import { z } from "zod";
import type { QlooStatus } from "@overlap/shared";
import type { QlooContext } from "../qloo/client.js";

export interface ToolOutput {
  status: QlooStatus | "needs_input";
  data: unknown;
  /** tool_calls IDs backing this output (provenance). */
  callIds: number[];
  note?: string;
}

export interface ToolDef<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  input: S;
  run(input: z.infer<S>, ctx: QlooContext): Promise<ToolOutput>;
}

export const defineTool = <S extends z.ZodType>(def: ToolDef<S>): ToolDef<S> => def;

/** Combine per-call statuses: all ok → ok, all empty → empty, all error → error, otherwise thin. */
export function combineStatus(statuses: QlooStatus[]): QlooStatus {
  if (statuses.length === 0) return "empty";
  if (statuses.every((s) => s === "ok")) return "ok";
  if (statuses.every((s) => s === "empty")) return "empty";
  if (statuses.every((s) => s === "error")) return "error";
  return "thin";
}

/** Anthropic tool definition from a ToolDef. */
export function toAnthropicTool(def: ToolDef) {
  // io: "input" keeps defaulted fields optional for the model.
  const { $schema: _ignored, ...schema } = z.toJSONSchema(def.input, { io: "input" }) as Record<string, unknown>;
  return { name: def.name, description: def.description, input_schema: schema as { type: "object" } };
}
