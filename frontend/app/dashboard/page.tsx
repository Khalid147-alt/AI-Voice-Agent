"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone, Radio, Flame, DollarSign } from "lucide-react";
import { api } from "@/lib/api";
import { useWebSocket } from "@/lib/useWebSocket";
import { useToast } from "@/components/shared/Toast";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { LiveCallsFeed } from "@/components/dashboard/LiveCallsFeed";
import { CallVolumeChart } from "@/components/dashboard/CallVolumeChart";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { formatCost } from "@/lib/utils";
import type { AnalyticsOverview, Call, CallVolumePoint, WsEvent } from "@/types";

export default function DashboardPage() {
  const { toast } = useToast();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [liveCalls, setLiveCalls] = useState<Call[]>([]);
  const [volume, setVolume] = useState<CallVolumePoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [ov, calls, vol] = await Promise.all([
        api.overview(),
        api.listCalls({ status: "in-progress" }),
        api.callVolume(7),
      ]);
      setOverview(ov);
      setLiveCalls(calls);
      setVolume(vol);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load dashboard", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const onEvent = useCallback(
    (e: WsEvent) => {
      if (
        ["call_completed", "call_status", "call_created", "campaign_progress"].includes(
          e.type
        )
      ) {
        load();
      }
      if (e.type === "appointment_booked") {
        toast(`📅 Appointment booked${e.name ? ` for ${e.name}` : ""}!`, "success");
      }
    },
    [load, toast]
  );

  const { connected } = useWebSocket(onEvent);

  if (loading) return <LoadingSpinner label="Loading dashboard…" />;

  const weekTrend =
    overview && overview.calls_last_week > 0
      ? Math.round(
          ((overview.calls_this_week - overview.calls_last_week) /
            overview.calls_last_week) *
            100
        )
      : overview && overview.calls_this_week > 0
      ? 100
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <span
          className={`h-2 w-2 rounded-full ${
            connected ? "bg-success" : "bg-text-muted"
          }`}
        />
        {connected ? "Live updates connected" : "Reconnecting…"}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Calls Today"
          value={overview?.calls_today ?? 0}
          icon={Phone}
          trend={{ value: weekTrend, label: "vs last week" }}
          delay={0}
        />
        <KpiCard
          label="Live Calls"
          value={overview?.live_calls ?? 0}
          icon={Radio}
          accent
          live={(overview?.live_calls ?? 0) > 0}
          delay={0.05}
        />
        <KpiCard
          label="Hot Leads Today"
          value={overview?.hot_leads_today ?? 0}
          icon={Flame}
          delay={0.1}
        />
        <KpiCard
          label="Cost Today"
          value={formatCost(overview?.cost_today ?? 0)}
          icon={DollarSign}
          delay={0.15}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LiveCallsFeed calls={liveCalls} />
        <CallVolumeChart data={volume} />
      </div>
    </div>
  );
}
