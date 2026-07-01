"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { CallVolumePoint } from "@/types";

function fmtDay(d: string) {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

export function CallVolumeChart({ data }: { data: CallVolumePoint[] }) {
  const chartData = data.map((d) => ({ ...d, label: fmtDay(d.date) }));

  return (
    <div className="card p-5 h-full">
      <h2 className="mb-4 font-semibold">Call Volume (7 days)</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#252836" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#8B95A3"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#8B95A3"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "#1A1D27" }}
            contentStyle={{
              background: "#1A1D27",
              border: "1px solid #252836",
              borderRadius: 8,
              color: "#F1F5F9",
            }}
          />
          <Bar dataKey="calls" fill="#4F6EF7" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
