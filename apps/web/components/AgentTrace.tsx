"use client";

import type { RunEvent } from "@overlap/shared";
import { useMemo, useState } from "react";
import type { Usage } from "@/lib/api";
import { CallLink } from "./Provenance";
import { Card } from "./ui";

interface ToolStep {
  kind: "tool";
  id: string;
  name: string;
  input: unknown;
  status?: string;
  callIds?: number[];
  note?: string;
}
interface TextStep {
  kind: "text";
  seq: number;
  sub: "thinking" | "text";
  text: string;
}
type Step = ToolStep | TextStep;

const TOOL_LABEL: Record<string, string> = {
  resolve_artist: "Resolve artist",
  find_brands: "Find brands",
  city_fit: "City fit",
  city_hotspot: "Fan hotspot",
  local_partners: "Local partners",
  crowd_profile: "Crowd evidence",
  shared_themes: "Shared themes",
  qloo_search: "Qloo search",
  qloo_insights: "Qloo insights",
  qloo_compare: "Qloo compare",
  qloo_find_tags: "Qloo tags",
  submit_report: "Submit report",
};

function describe(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  if (name === "resolve_artist") return String(i.name ?? "");
  if (name === "find_brands") return (i.categories as string[] | undefined)?.join(", ") ?? "";
  if (name === "city_fit") return `${(i.brand_ids as unknown[] | undefined)?.length ?? 0} brands × ${(i.cities as string[] | undefined)?.join(", ") ?? ""}`;
  if (name === "city_hotspot" || name === "crowd_profile") return String(i.city ?? "");
  if (name === "local_partners") return `near ${Number(i.lat).toFixed(3)}, ${Number(i.lon).toFixed(3)}`;
  if (name === "qloo_insights") return `${i.type ?? ""} ${i.signal_location ?? i.filter_location ?? ""}`;
  if (name === "submit_report") return `${i.brands ?? ""} brands, ${i.cities ?? ""} cities`;
  return "";
}

const statusColor = (s?: string) =>
  s === "ok" ? "text-ok" : s === "thin" ? "text-warn" : s === "empty" ? "text-warn" : s === "error" ? "text-decision" : "text-evidence";

export function AgentTrace({ events, live, usage }: { events: RunEvent[]; live: boolean; usage: Usage | null }) {
  const [showThinking, setShowThinking] = useState(true);
  const steps = useMemo(() => {
    const out: Step[] = [];
    const tools = new Map<string, ToolStep>();
    for (const e of events) {
      const p = e.payload as Record<string, unknown>;
      if (e.type === "tool_start") {
        const step: ToolStep = { kind: "tool", id: String(p.id), name: String(p.name), input: p.input };
        tools.set(step.id, step);
        out.push(step);
      } else if (e.type === "tool_end") {
        const step = tools.get(String(p.id));
        if (step) Object.assign(step, { status: p.status, callIds: p.callIds as number[] | undefined, note: p.note as string | undefined });
      } else if (e.type === "agent_text") {
        out.push({ kind: "text", seq: e.seq, sub: p.kind as "thinking" | "text", text: String(p.text) });
      }
    }
    return out;
  }, [events]);

  const toolCount = steps.filter((s) => s.kind === "tool").length;

  return (
    <Card className="flex max-h-[calc(100vh-6rem)] flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <div className="font-semibold">Agent trace</div>
          <div className="text-xs text-muted">
            {toolCount} tool calls{live ? " · working…" : ""}
          </div>
        </div>
        <label className="flex items-center gap-1 text-xs text-muted">
          <input type="checkbox" checked={showThinking} onChange={(e) => setShowThinking(e.target.checked)} /> notes
        </label>
      </div>
      <ol className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm">
        {steps.length === 0 && <li className="text-muted">{live ? "Planning…" : "No steps recorded."}</li>}
        {steps.map((s) =>
          s.kind === "tool" ? (
            <li key={s.id} className="rounded-md border border-line p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{TOOL_LABEL[s.name] ?? s.name}</span>
                <span className={`font-mono text-[11px] ${statusColor(s.status)}`}>{s.status ?? "running…"}</span>
              </div>
              <div className="truncate text-xs text-muted">{describe(s.name, s.input)}</div>
              {s.callIds && s.callIds.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {s.callIds.slice(0, 6).map((id) => (
                    <CallLink key={id} callId={id} label={`#${id}`} />
                  ))}
                  {s.callIds.length > 6 && <span className="text-[11px] text-muted">+{s.callIds.length - 6}</span>}
                </div>
              )}
              {s.note && <div className="mt-1 text-xs text-warn">{s.note}</div>}
            </li>
          ) : showThinking ? (
            <li key={`t${s.seq}`} className="border-l-2 border-decision/40 pl-2 text-xs italic text-muted">
              {s.text}
            </li>
          ) : null,
        )}
        {live && <li className="animate-pulse text-xs text-evidence">●</li>}
      </ol>
      {usage && !live && (
        <div className="border-t border-line px-4 py-2 text-[11px] text-muted">
          {(usage.elapsedMs / 1000).toFixed(0)}s · {usage.agentToolCalls} agent tool calls · Qloo {usage.qloo.calls} live / {usage.qloo.cached} cached ·
          Claude ≈ ${usage.costUsd.toFixed(3)}
        </div>
      )}
    </Card>
  );
}
