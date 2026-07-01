"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, Radio } from "lucide-react";
import { Waveform } from "@/components/shared/Waveform";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDuration } from "@/lib/utils";
import type { Call } from "@/types";

function LiveCallRow({ call }: { call: Call }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = call.started_at
      ? new Date(call.started_at + "Z").getTime()
      : Date.now();
    const tick = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [call.started_at]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface-elevated px-4 py-3"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15">
        <Phone className="h-4 w-4 text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm">{call.phone_number}</p>
        <p className="truncate text-xs text-text-secondary">
          {call.agent_name || "Agent"}
        </p>
      </div>
      <Waveform active level={0.8} />
      <span className="font-mono text-sm tabular-nums text-text-secondary w-12 text-right">
        {formatDuration(elapsed)}
      </span>
      <StatusBadge status={call.status} />
    </motion.div>
  );
}

export function LiveCallsFeed({ calls }: { calls: Call[] }) {
  return (
    <div className="card p-5 h-full">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-accent" />
          <h2 className="font-semibold">Live Calls</h2>
        </div>
        <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-secondary">
          {calls.length} active
        </span>
      </div>
      {calls.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="No live calls"
          message="In-progress calls will appear here in real time."
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {calls.map((c) => (
              <LiveCallRow key={c.id} call={c} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
