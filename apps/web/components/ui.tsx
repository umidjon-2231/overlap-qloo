import type { Coverage } from "@overlap/shared";
import type { ReactNode } from "react";

/** Section heading inside a work area: condensed display, a full ink rule below. */
export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b-2 border-ink pb-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="display text-[1.9rem]">{title}</h2>
        {hint && <span className="text-sm text-ink-soft">{hint}</span>}
      </div>
      {action}
    </div>
  );
}

const coverageStyle: Record<Coverage, string> = {
  strong: "text-ok",
  thin: "text-warn",
  none: "text-ink-soft",
};
const coverageText: Record<Coverage, string> = { strong: "strong data", thin: "thin data", none: "no data" };

/** Coverage as a small printed mark: a filled, half or empty square plus a word. */
export function CoverageBadge({ coverage, label }: { coverage: Coverage; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${coverageStyle[coverage]}`}>
      <CoverageMark coverage={coverage} />
      {label ?? coverageText[coverage]}
    </span>
  );
}

export function CoverageMark({ coverage, className = "" }: { coverage: Coverage; className?: string }) {
  return (
    <svg viewBox="0 0 10 10" className={`size-2.5 shrink-0 ${className}`} aria-hidden="true">
      <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
      {coverage === "strong" && <rect x="0.5" y="0.5" width="9" height="9" fill="currentColor" />}
      {coverage === "thin" && <rect x="0.5" y="5" width="9" height="4.5" fill="currentColor" />}
    </svg>
  );
}

/** "Qloo says": facts from Qloo results. */
export function QlooLabel() {
  return <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-evidence">Qloo says</span>;
}

/** "Agent suggests": model interpretation, always visibly labelled. */
export function AgentLabel() {
  return <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft">Overlap suggests</span>;
}

const buttonStyles = {
  // Coral is reserved for actions that move the seller forward and for decisions.
  primary: "bg-coral text-ink hover:bg-ink hover:text-on-ink",
  secondary: "border border-ink bg-transparent text-ink hover:bg-ink hover:text-on-ink",
  ghost: "text-ink-soft underline-offset-4 hover:text-ink hover:underline",
};

export function buttonClass(variant: keyof typeof buttonStyles = "primary", className = "") {
  return `inline-flex items-center justify-center gap-2 rounded-[2px] px-3.5 py-2 text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40 ${buttonStyles[variant]} ${className}`;
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
  variant?: keyof typeof buttonStyles;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={buttonClass(variant, className)}>
      {children}
    </button>
  );
}

const statusLabel: Record<string, string> = {
  running: "Working",
  done: "Done",
  error: "Stopped",
  needs_input: "Needs your pick",
};

export function StatusPill({ status, onInk = false }: { status: string; onInk?: boolean }) {
  const color =
    status === "done"
      ? onInk
        ? "text-on-ink"
        : "text-ok"
      : status === "error"
        ? onInk
          ? "text-on-ink-soft"
          : "text-warn"
        : status === "needs_input"
          ? "text-coral"
          : onInk
            ? "text-coral"
            : "text-evidence";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] ${color}`}>
      <span className={`size-1.5 rounded-full bg-current ${status === "running" ? "live-dot" : ""}`} aria-hidden="true" />
      {statusLabel[status] ?? status}
    </span>
  );
}

export const fmt = (n: number | null | undefined, digits = 2) => (n == null ? "–" : n.toFixed(digits));
