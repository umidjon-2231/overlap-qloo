import type { Coverage } from "@overlap/shared";
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-surface ${className}`}>{children}</div>;
}

export function SectionTitle({ step, title, hint }: { step?: number; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      {step != null && <span className="font-mono text-xs text-muted">{String(step).padStart(2, "0")}</span>}
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </div>
  );
}

const coverageStyle: Record<Coverage, string> = {
  strong: "bg-ok-soft text-ok border-ok/30",
  thin: "bg-warn-soft text-warn border-warn/30",
  none: "bg-zinc-100 text-muted border-line",
};
const coverageText: Record<Coverage, string> = { strong: "strong data", thin: "thin data", none: "no data" };

export function CoverageBadge({ coverage, label }: { coverage: Coverage; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${coverageStyle[coverage]}`}>
      {label ?? coverageText[coverage]}
    </span>
  );
}

/** "Qloo says": facts from Qloo results. */
export function QlooLabel() {
  return <span className="text-[11px] font-semibold uppercase tracking-wide text-evidence">Qloo says</span>;
}

/** "Agent suggests": model interpretation, always visibly labelled. */
export function AgentLabel() {
  return <span className="text-[11px] font-semibold uppercase tracking-wide text-decision">Agent suggests</span>;
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: "bg-foreground text-white hover:bg-zinc-700",
    secondary: "border border-line bg-surface hover:bg-zinc-50",
    ghost: "text-muted hover:text-foreground",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function StatusPill({ status }: { status: string }) {
  const style =
    status === "done"
      ? "bg-ok-soft text-ok"
      : status === "error"
        ? "bg-decision-soft text-decision"
        : status === "needs_input"
          ? "bg-warn-soft text-warn"
          : "bg-evidence-soft text-evidence";
  const label = status === "needs_input" ? "needs your input" : status;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}

export const fmt = (n: number | null | undefined, digits = 2) => (n == null ? "–" : n.toFixed(digits));
