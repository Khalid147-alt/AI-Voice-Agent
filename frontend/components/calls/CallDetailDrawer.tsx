"use client";

import { useState } from "react";
import { Phone, FileText, BarChart3, Disc } from "lucide-react";
import { Drawer } from "@/components/shared/Drawer";
import { StatusBadge, InterestBadge } from "@/components/shared/StatusBadge";
import { TranscriptViewer } from "@/components/calls/TranscriptViewer";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatCost, formatDuration, formatDateTime, cn } from "@/lib/utils";
import type { Call } from "@/types";

type Tab = "transcript" | "analysis" | "recording";

export function CallDetailDrawer({
  call,
  open,
  onClose,
}: {
  call: Call | null;
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("transcript");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={call?.phone_number || "Call detail"}
      subtitle={call ? `${call.agent_name || "Agent"} · ${call.direction}` : ""}
      width="max-w-2xl"
    >
      {call && (
        <div className="flex flex-col h-full">
          {/* Header meta */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-border">
            <Meta label="Status">
              <StatusBadge status={call.status} />
            </Meta>
            <Meta label="Interest">
              <InterestBadge level={call.interest_level} />
            </Meta>
            <Meta label="Duration">
              <span className="text-sm font-mono">
                {formatDuration(call.duration_seconds)}
              </span>
            </Meta>
            <Meta label="Cost">
              <span className="text-sm font-mono">
                {formatCost(call.cost_usd)}
              </span>
            </Meta>
          </div>

          {call.summary && (
            <div className="px-6 py-4 border-b border-border">
              <p className="label">Summary</p>
              <p className="text-sm text-text-secondary">{call.summary}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 px-6 pt-4">
            <TabBtn active={tab === "transcript"} onClick={() => setTab("transcript")} icon={FileText}>
              Transcript
            </TabBtn>
            <TabBtn active={tab === "analysis"} onClick={() => setTab("analysis")} icon={BarChart3}>
              Analysis
            </TabBtn>
            <TabBtn active={tab === "recording"} onClick={() => setTab("recording")} icon={Disc}>
              Recording
            </TabBtn>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {tab === "transcript" && (
              <TranscriptViewer transcript={call.transcript} />
            )}
            {tab === "analysis" && <AnalysisPanel call={call} />}
            {tab === "recording" && (
              <div>
                {call.recording_url ? (
                  <audio controls className="w-full">
                    <source src={call.recording_url} />
                    Your browser does not support audio playback.
                  </audio>
                ) : (
                  <EmptyState
                    icon={Disc}
                    title="No recording"
                    message="A recording is not available for this call."
                  />
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border px-6 py-3 text-xs text-text-muted flex items-center justify-between">
            <span className="font-mono">{call.id}</span>
            <span>{formatDateTime(call.created_at)}</span>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      {children}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Phone;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-surface-elevated text-text-primary"
          : "text-text-secondary hover:text-text-primary"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function AnalysisPanel({ call }: { call: Call }) {
  const a = call.analysis;
  if (!a) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No analysis"
        message="Post-call analysis has not been generated for this call."
      />
    );
  }
  const score = a.lead_score ?? null;
  return (
    <div className="space-y-5">
      {score !== null && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="label mb-0">Lead Score</p>
            <span className="text-sm font-semibold">{score}/100</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-surface-elevated overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hover transition-all"
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {a.intent && (
          <Chip label="Intent" value={a.intent.replace(/_/g, " ")} />
        )}
        {a.sentiment && <Chip label="Sentiment" value={a.sentiment} />}
        {call.interest_level && (
          <Chip label="Interest" value={call.interest_level} />
        )}
      </div>

      {a.objections && a.objections.length > 0 && (
        <div>
          <p className="label">Objections</p>
          <ul className="space-y-1">
            {a.objections.map((o, i) => (
              <li
                key={i}
                className="text-sm text-text-secondary rounded-lg bg-surface-elevated px-3 py-2"
              >
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(a.next_action || a.next_steps) && (
        <div>
          <p className="label">Recommended Next Action</p>
          <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2.5 text-sm">
            {a.next_action || a.next_steps}
          </p>
        </div>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-elevated px-3 py-1.5">
      <span className="text-xs text-text-muted">{label}: </span>
      <span className="text-sm font-medium capitalize">{value}</span>
    </div>
  );
}
