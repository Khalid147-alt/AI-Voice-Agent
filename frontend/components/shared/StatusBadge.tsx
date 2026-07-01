import { cn } from "@/lib/utils";

type Variant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "accent";

const VARIANT_CLASSES: Record<Variant, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  info: "bg-accent/15 text-accent border-accent/30",
  neutral: "bg-surface-elevated text-text-secondary border-border",
  accent: "bg-accent/15 text-accent border-accent/30",
};

const STATUS_MAP: Record<string, { label: string; variant: Variant }> = {
  // call status
  "in-progress": { label: "In Progress", variant: "accent" },
  ringing: { label: "Ringing", variant: "warning" },
  queued: { label: "Queued", variant: "neutral" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  "no-answer": { label: "No Answer", variant: "neutral" },
  // agent status
  active: { label: "Active", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  // contact status
  new: { label: "New", variant: "info" },
  contacted: { label: "Contacted", variant: "neutral" },
  qualified: { label: "Qualified", variant: "success" },
  booked: { label: "Booked", variant: "accent" },
  rejected: { label: "Rejected", variant: "danger" },
  // campaign status
  draft: { label: "Draft", variant: "neutral" },
  scheduled: { label: "Scheduled", variant: "info" },
  running: { label: "Running", variant: "accent" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] || { label: status, variant: "neutral" as Variant };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        VARIANT_CLASSES[cfg.variant]
      )}
    >
      {status === "in-progress" || status === "running" ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-dot" />
      ) : null}
      {cfg.label}
    </span>
  );
}

export function InterestBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-text-muted">—</span>;
  const map: Record<string, { emoji: string; label: string; variant: Variant }> =
    {
      hot: { emoji: "🔥", label: "Hot", variant: "danger" },
      warm: { emoji: "🌡", label: "Warm", variant: "warning" },
      cold: { emoji: "❄️", label: "Cold", variant: "info" },
    };
  const cfg = map[level];
  if (!cfg) return <span className="text-text-muted">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[cfg.variant]
      )}
    >
      <span>{cfg.emoji}</span>
      {cfg.label}
    </span>
  );
}
