"use client";

import { ArrowDownLeft, ArrowUpRight, Check, X } from "lucide-react";
import { StatusBadge, InterestBadge } from "@/components/shared/StatusBadge";
import { formatCost, formatDuration, formatDateTime } from "@/lib/utils";
import type { Call } from "@/types";

export function CallsTable({
  calls,
  onSelect,
  highlightId,
}: {
  calls: Call[];
  onSelect: (c: Call) => void;
  highlightId?: string | null;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-secondary">
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Dir</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Interest</th>
              <th className="px-4 py-3 font-medium text-center">Success</th>
              <th className="px-4 py-3 font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr
                key={c.id}
                onClick={() => onSelect(c)}
                className={`border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-surface-elevated ${
                  highlightId === c.id ? "bg-accent/10" : ""
                }`}
              >
                <td className="px-4 py-3 font-mono whitespace-nowrap">
                  {c.phone_number}
                </td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                  {c.agent_name || "—"}
                </td>
                <td className="px-4 py-3">
                  {c.direction === "inbound" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                      <ArrowDownLeft className="h-3.5 w-3.5 text-success" /> In
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                      <ArrowUpRight className="h-3.5 w-3.5 text-accent" /> Out
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3 font-mono text-text-secondary">
                  {formatDuration(c.duration_seconds)}
                </td>
                <td className="px-4 py-3">
                  <InterestBadge level={c.interest_level} />
                </td>
                <td className="px-4 py-3 text-center">
                  {c.success === true ? (
                    <Check className="h-4 w-4 text-success inline" />
                  ) : c.success === false ? (
                    <X className="h-4 w-4 text-text-muted inline" />
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-text-secondary">
                  {formatCost(c.cost_usd)}
                </td>
                <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                  {formatDateTime(c.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
