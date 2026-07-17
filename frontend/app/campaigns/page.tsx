"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, Plus, Play, Pause, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import { usePolling } from "@/lib/usePolling";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { motion } from "framer-motion";
import type { Campaign } from "@/types";

export default function CampaignsPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setCampaigns(await api.listCampaigns());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load campaigns", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Live campaign progress via polling (WebSockets aren't available on serverless).
  usePolling(load, 4000);

  const handleStart = async (id: string) => {
    try {
      await api.startCampaign(id);
      toast("Campaign started", "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to start", "error");
    }
  };

  const handlePause = async (id: string) => {
    try {
      await api.pauseCampaign(id);
      toast("Campaign paused", "info");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to pause", "error");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Launch and monitor outbound calling campaigns.
        </p>
        <Link href="/campaigns/new" className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Campaign
        </Link>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading campaigns…" />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          message="Create a campaign to call a batch of contacts automatically."
          action={
            <Link href="/campaigns/new" className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> New Campaign
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {campaigns.map((c, i) => {
            const pct =
              c.total_contacts > 0
                ? Math.round((c.calls_made / c.total_contacts) * 100)
                : 0;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/15">
                      <Megaphone className="h-5 w-5 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{c.name}</h3>
                      <p className="text-xs text-text-secondary truncate">
                        {c.agent_name || "Agent"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.status} />
                    {(c.status === "draft" ||
                      c.status === "paused" ||
                      c.status === "scheduled") && (
                      <button
                        onClick={() => handleStart(c.id)}
                        className="btn-ghost p-2"
                        aria-label="Start"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {c.status === "running" && (
                      <button
                        onClick={() => handlePause(c.id)}
                        className="btn-ghost p-2"
                        aria-label="Pause"
                      >
                        <Pause className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-text-secondary mb-1.5">
                    <span>
                      {c.calls_made} / {c.total_contacts} calls
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <Stat label="Answered" value={c.calls_answered} />
                  <Stat label="Qualified" value={c.leads_qualified} icon />
                  <Stat label="Contacts" value={c.total_contacts} />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface-elevated px-3 py-2">
      <p className="text-xs text-text-secondary flex items-center gap-1">
        {icon && <Check className="h-3 w-3 text-success" />}
        {label}
      </p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
