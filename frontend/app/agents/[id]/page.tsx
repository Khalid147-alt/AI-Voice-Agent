"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bot, AudioLines, Thermometer } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import { WebCallWidget } from "@/components/voice/WebCallWidget";
import { StatusBadge, InterestBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import { Phone } from "lucide-react";
import type { Agent, Call, AppSettings } from "@/types";

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [a, c, s] = await Promise.all([
        api.getAgent(id),
        api.listCalls({ agent_id: id }),
        api.getSettings(),
      ]);
      setAgent(a);
      setCalls(c);
      setSettings(s);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load agent", "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingSpinner label="Loading agent…" />;
  if (!agent)
    return (
      <EmptyState
        icon={Bot}
        title="Agent not found"
        message="This agent may have been deleted."
        action={
          <Link href="/agents" className="btn-primary">
            Back to Agents
          </Link>
        }
      />
    );

  return (
    <div className="space-y-6">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Agents
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/15">
                  <Bot className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{agent.name}</h2>
                  <p className="text-sm text-text-secondary">
                    {agent.description}
                  </p>
                </div>
              </div>
              <StatusBadge status={agent.status} />
            </div>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Total Calls" value={String(agent.calls_count)} />
              <Stat label="Success Rate" value={`${agent.success_rate}%`} />
              <Stat
                label="Voice"
                value={agent.voice_name}
                icon={<AudioLines className="h-3.5 w-3.5" />}
              />
              <Stat
                label="Temperature"
                value={agent.temperature.toFixed(2)}
                icon={<Thermometer className="h-3.5 w-3.5" />}
              />
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <p className="label">First Message</p>
                <p className="rounded-lg bg-surface-elevated p-3 text-sm">
                  {agent.first_message || "—"}
                </p>
              </div>
              <div>
                <p className="label">System Prompt</p>
                <p className="rounded-lg bg-surface-elevated p-3 text-sm font-mono whitespace-pre-wrap text-text-secondary">
                  {agent.system_prompt || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Recent calls */}
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Recent Calls</h3>
            {calls.length === 0 ? (
              <EmptyState
                icon={Phone}
                title="No calls yet"
                message="Calls handled by this agent will appear here."
              />
            ) : (
              <div className="space-y-2">
                {calls.slice(0, 8).map((c) => (
                  <Link
                    key={c.id}
                    href={`/calls?highlight=${c.id}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface-elevated px-4 py-2.5 hover:border-accent/40 transition-colors"
                  >
                    <span className="font-mono text-sm flex-1 truncate">
                      {c.phone_number}
                    </span>
                    <InterestBadge level={c.interest_level} />
                    <span className="text-xs text-text-secondary w-12 text-right">
                      {formatDuration(c.duration_seconds)}
                    </span>
                    <StatusBadge status={c.status} />
                    <span className="text-xs text-text-muted w-16 text-right hidden sm:block">
                      {formatRelativeTime(c.created_at)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Test call widget */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <h3 className="font-semibold mb-3">Test Call (Web)</h3>
            <WebCallWidget
              agent={agent}
              demoMode={settings?.demo_mode ?? true}
              publicKey={
                settings?.vapi_public_key ||
                process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ||
                ""
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-surface-elevated px-3 py-2.5">
      <p className="text-xs text-text-secondary flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-base font-semibold mt-0.5 truncate">{value}</p>
    </div>
  );
}
