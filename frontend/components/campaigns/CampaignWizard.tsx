"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, ChevronLeft, Megaphone } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import { InlineSpinner } from "@/components/shared/LoadingSpinner";
import { cn } from "@/lib/utils";
import type { Agent, Contact } from "@/types";

const STEPS = ["Setup", "Contacts", "Schedule"];

export function CampaignWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [runNow, setRunNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [callsPerBatch, setCallsPerBatch] = useState(5);
  const [delay, setDelay] = useState(30);

  useEffect(() => {
    Promise.all([api.listAgents(), api.listContacts()])
      .then(([a, c]) => {
        setAgents(a);
        setContacts(c);
        if (a[0]) setAgentId(a[0].id);
      })
      .catch((e) => toast(e instanceof Error ? e.message : "Load failed", "error"));
  }, [toast]);

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const canNext =
    (step === 0 && name.trim() && agentId) ||
    (step === 1 && selectedContacts.size > 0) ||
    step === 2;

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.createCampaign({
        name,
        agent_id: agentId,
        contact_ids: Array.from(selectedContacts),
        calls_per_batch: callsPerBatch,
        delay_between_calls_seconds: delay,
        scheduled_at: runNow ? null : scheduledAt || null,
        run_now: runNow,
      });
      toast("Campaign created", "success");
      router.push("/campaigns");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to create campaign", "error");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  i < step
                    ? "bg-success text-white"
                    : i === step
                    ? "bg-accent text-white"
                    : "bg-surface-elevated text-text-secondary"
                )}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-sm font-medium hidden sm:block",
                  i === step ? "text-text-primary" : "text-text-secondary"
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-px bg-border" />
            )}
          </div>
        ))}
      </div>

      <div className="card p-6">
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="label">Campaign Name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Q3 SaaS Outreach"
              />
            </div>
            <div>
              <label className="label">Agent</label>
              <select
                className="input"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              >
                {agents.length === 0 && <option value="">No agents available</option>}
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Select Contacts</label>
              <span className="text-sm text-accent font-medium">
                {selectedContacts.size} selected
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
              {contacts.map((c) => {
                const sel = selectedContacts.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleContact(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      sel
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-text-muted"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border",
                        sel ? "bg-accent border-accent" : "border-border"
                      )}
                    >
                      {sel && <Check className="h-3.5 w-3.5 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-text-secondary font-mono truncate">
                        {c.phone}
                      </p>
                    </div>
                    <span className="text-xs text-text-muted">{c.company}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="label">When to run</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRunNow(true)}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                    runNow
                      ? "border-accent bg-accent/10 text-text-primary"
                      : "border-border text-text-secondary"
                  )}
                >
                  Run Now
                </button>
                <button
                  type="button"
                  onClick={() => setRunNow(false)}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                    !runNow
                      ? "border-accent bg-accent/10 text-text-primary"
                      : "border-border text-text-secondary"
                  )}
                >
                  Schedule
                </button>
              </div>
            </div>

            {!runNow && (
              <div>
                <label className="label">Scheduled Time</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <label className="label mb-0">Calls per batch</label>
                <span className="text-sm text-text-secondary">{callsPerBatch}</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={callsPerBatch}
                onChange={(e) => setCallsPerBatch(parseInt(e.target.value))}
                className="w-full accent-accent mt-2"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="label mb-0">Delay between calls (s)</label>
                <span className="text-sm text-text-secondary">{delay}s</span>
              </div>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={delay}
                onChange={(e) => setDelay(parseInt(e.target.value))}
                className="w-full accent-accent mt-2"
              />
            </div>

            <div className="rounded-lg bg-surface-elevated p-4 text-sm">
              <p className="text-text-secondary">
                <span className="text-text-primary font-medium">{name || "Campaign"}</span>{" "}
                will call{" "}
                <span className="text-accent font-medium">
                  {selectedContacts.size} contacts
                </span>{" "}
                via{" "}
                <span className="text-text-primary font-medium">
                  {agents.find((a) => a.id === agentId)?.name || "agent"}
                </span>
                .
              </p>
            </div>
          </div>
        )}

        {/* Nav */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="btn-ghost flex items-center gap-1 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => canNext && setStep((s) => s + 1)}
              disabled={!canNext}
              className="btn-primary flex items-center gap-1"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="btn-primary flex items-center gap-2"
            >
              {submitting ? <InlineSpinner /> : <Megaphone className="h-4 w-4" />}
              {runNow ? "Launch Campaign" : "Schedule Campaign"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
