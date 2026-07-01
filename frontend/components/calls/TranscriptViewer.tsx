"use client";

import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import type { TranscriptEntry } from "@/types";

function fmtTs(ts?: number) {
  if (ts === undefined || ts === null) return "";
  const totalSec = ts > 1000 ? Math.floor(ts / 1000) : Math.floor(ts);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptViewer({
  transcript,
}: {
  transcript: TranscriptEntry[] | null;
}) {
  if (!transcript || transcript.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No transcript"
        message="This call has no transcript available."
      />
    );
  }

  return (
    <div className="space-y-3">
      {transcript.map((m, i) => {
        const isAssistant = m.role === "assistant" || m.role === "bot";
        return (
          <div
            key={i}
            className={`flex ${isAssistant ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[85%]">
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm font-mono ${
                  isAssistant
                    ? "bg-accent/15 text-text-primary rounded-br-sm"
                    : "bg-surface-elevated text-text-secondary rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
              <div
                className={`mt-1 flex items-center gap-2 text-[10px] text-text-muted ${
                  isAssistant ? "justify-end" : "justify-start"
                }`}
              >
                <span className="uppercase tracking-wide">
                  {isAssistant ? "Agent" : "Caller"}
                </span>
                {m.timestamp !== undefined && <span>{fmtTs(m.timestamp)}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
