import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatCost(cost: number | null | undefined): string {
  if (cost === null || cost === undefined) return "—";
  return `$${cost.toFixed(2)}`;
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  // Backend stores naive UTC; treat as UTC.
  const date = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const VOICE_OPTIONS = [
  { name: "Rachel", id: "21m00Tcm4TlvDq8ikWAM", desc: "Warm, friendly female — great for sales" },
  { name: "Adam", id: "pNInz6obpgDQGcFmaJgB", desc: "Confident male — outbound & closing" },
  { name: "Elli", id: "MF3mGyEYCl7XYWbV9V6O", desc: "Calm, clear female — support & triage" },
  { name: "Josh", id: "TxGEqnHWrfWFTfGW9XjX", desc: "Deep, professional male — enterprise" },
  { name: "Bella", id: "EXAVITQu4vr4xnSDxMaL", desc: "Soft, approachable female — onboarding" },
];
