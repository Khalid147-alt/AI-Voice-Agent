"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Phone } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import { usePolling } from "@/lib/usePolling";
import { CallsTable } from "@/components/calls/CallsTable";
import { CallDetailDrawer } from "@/components/calls/CallDetailDrawer";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import type { Agent, Call } from "@/types";

export default function CallsPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading calls…" />}>
      <CallsPageInner />
    </Suspense>
  );
}

function CallsPageInner() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [calls, setCalls] = useState<Call[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Call | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [filters, setFilters] = useState({
    status: "",
    direction: "",
    agent_id: "",
    interest_level: "",
  });

  const load = useCallback(async () => {
    try {
      const [c, a] = await Promise.all([api.listCalls(), api.listAgents()]);
      setCalls(c);
      setAgents(a);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load calls", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates via polling (WebSockets aren't available on serverless).
  usePolling(load, 5000);

  // Open drawer for highlighted call on load.
  useEffect(() => {
    if (highlightId && calls.length) {
      const found = calls.find((c) => c.id === highlightId);
      if (found) {
        setSelected(found);
        setDrawerOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, calls.length]);

  const filtered = useMemo(() => {
    return calls.filter((c) => {
      if (filters.status && c.status !== filters.status) return false;
      if (filters.direction && c.direction !== filters.direction) return false;
      if (filters.agent_id && c.agent_id !== filters.agent_id) return false;
      if (filters.interest_level && c.interest_level !== filters.interest_level)
        return false;
      return true;
    });
  }, [calls, filters]);

  const handleSelect = (c: Call) => {
    setSelected(c);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          placeholder="All Statuses"
          options={[
            ["in-progress", "In Progress"],
            ["completed", "Completed"],
            ["failed", "Failed"],
            ["no-answer", "No Answer"],
            ["queued", "Queued"],
          ]}
        />
        <Select
          value={filters.direction}
          onChange={(v) => setFilters((f) => ({ ...f, direction: v }))}
          placeholder="All Directions"
          options={[
            ["inbound", "Inbound"],
            ["outbound", "Outbound"],
          ]}
        />
        <Select
          value={filters.agent_id}
          onChange={(v) => setFilters((f) => ({ ...f, agent_id: v }))}
          placeholder="All Agents"
          options={agents.map((a) => [a.id, a.name] as [string, string])}
        />
        <Select
          value={filters.interest_level}
          onChange={(v) => setFilters((f) => ({ ...f, interest_level: v }))}
          placeholder="All Interest"
          options={[
            ["hot", "🔥 Hot"],
            ["warm", "🌡 Warm"],
            ["cold", "❄️ Cold"],
          ]}
        />
        {(filters.status ||
          filters.direction ||
          filters.agent_id ||
          filters.interest_level) && (
          <button
            onClick={() =>
              setFilters({ status: "", direction: "", agent_id: "", interest_level: "" })
            }
            className="btn-ghost text-sm"
          >
            Clear
          </button>
        )}
        <div className="ml-auto self-center text-sm text-text-secondary">
          {filtered.length} call{filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading calls…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="No calls found"
          message={
            calls.length === 0
              ? "Calls will appear here once your agents start dialing."
              : "No calls match the current filters."
          }
        />
      ) : (
        <CallsTable
          calls={filtered}
          onSelect={handleSelect}
          highlightId={highlightId}
        />
      )}

      <CallDetailDrawer
        call={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input w-auto min-w-[150px] cursor-pointer"
    >
      <option value="">{placeholder}</option>
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
