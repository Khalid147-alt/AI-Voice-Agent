"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Clock, DollarSign, Flame, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { formatCost, formatDuration } from "@/lib/utils";
import type {
  AnalyticsOverview,
  CallVolumePoint,
  InterestBreakdownPoint,
  AgentPerformancePoint,
  CallsByHourPoint,
  CostTrendPoint,
} from "@/types";

const TOOLTIP_STYLE = {
  background: "#1A1D27",
  border: "1px solid #252836",
  borderRadius: 8,
  color: "#F1F5F9",
};
const INTEREST_COLORS: Record<string, string> = {
  hot: "#EF4444",
  warm: "#F59E0B",
  cold: "#4F6EF7",
};

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [volume, setVolume] = useState<CallVolumePoint[]>([]);
  const [interest, setInterest] = useState<InterestBreakdownPoint[]>([]);
  const [perf, setPerf] = useState<AgentPerformancePoint[]>([]);
  const [byHour, setByHour] = useState<CallsByHourPoint[]>([]);
  const [cost, setCost] = useState<CostTrendPoint[]>([]);

  const load = useCallback(async () => {
    try {
      const [ov, vol, intr, pf, bh, ct] = await Promise.all([
        api.overview(),
        api.callVolume(30),
        api.interestBreakdown(),
        api.agentPerformance(),
        api.callsByHour(),
        api.costTrend(30),
      ]);
      setOverview(ov);
      setVolume(vol);
      setInterest(intr.filter((i) => i.count > 0));
      setPerf(pf);
      setByHour(bh);
      setCost(ct);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load analytics", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingSpinner label="Crunching numbers…" />;

  const bestAgent = perf.reduce(
    (best, a) => (a.success_rate > (best?.success_rate ?? -1) ? a : best),
    null as AgentPerformancePoint | null
  );

  const volChart = volume.map((v) => ({
    ...v,
    label: new Date(v.date + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));
  const costChart = cost.map((v) => ({
    ...v,
    label: new Date(v.date + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Summary
          icon={Clock}
          label="Avg Call Duration"
          value={formatDuration(overview?.avg_duration_seconds ?? 0)}
        />
        <Summary
          icon={DollarSign}
          label="Total Cost"
          value={formatCost(overview?.total_cost ?? 0)}
        />
        <Summary
          icon={Flame}
          label="Success Rate"
          value={`${overview?.success_rate ?? 0}%`}
        />
        <Summary
          icon={Trophy}
          label="Top Agent"
          value={bestAgent?.agent_name?.split(" ")[0] ?? "—"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Call volume line */}
        <Panel title="Call Volume (30 days)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={volChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#252836" vertical={false} />
              <XAxis dataKey="label" stroke="#8B95A3" fontSize={11} tickLine={false} axisLine={false} interval={4} />
              <YAxis stroke="#8B95A3" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="calls" stroke="#4F6EF7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        {/* Interest donut */}
        <Panel title="Interest Level Breakdown">
          {interest.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={interest}
                  dataKey="count"
                  nameKey="level"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                >
                  {interest.map((entry) => (
                    <Cell key={entry.level} fill={INTEREST_COLORS[entry.level]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend
                  formatter={(v) => (
                    <span style={{ color: "#8B95A3", textTransform: "capitalize" }}>{v}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Success rate by agent */}
        <Panel title="Success Rate by Agent">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={perf}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#252836" horizontal={false} />
              <XAxis type="number" stroke="#8B95A3" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
              <YAxis
                type="category"
                dataKey="agent_name"
                stroke="#8B95A3"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={110}
                tickFormatter={(v: string) => v.split(" ")[0]}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#1A1D27" }} />
              <Bar dataKey="success_rate" fill="#22C55E" radius={[0, 4, 4, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Calls by hour */}
        <Panel title="Calls by Hour of Day">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byHour} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#252836" vertical={false} />
              <XAxis dataKey="hour" stroke="#8B95A3" fontSize={11} tickLine={false} axisLine={false} interval={2} />
              <YAxis stroke="#8B95A3" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#1A1D27" }} />
              <Bar dataKey="calls" fill="#6B84F8" radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Cost trend full width */}
      <Panel title="Cost Trend (30 days)">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={costChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4F6EF7" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#4F6EF7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#252836" vertical={false} />
            <XAxis dataKey="label" stroke="#8B95A3" fontSize={11} tickLine={false} axisLine={false} interval={4} />
            <YAxis stroke="#8B95A3" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="cost" stroke="#4F6EF7" strokeWidth={2} fill="url(#costGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-text-secondary text-sm">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold truncate">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-text-secondary">
      No data yet
    </div>
  );
}
