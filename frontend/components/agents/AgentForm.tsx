"use client";

import { useState } from "react";
import { InlineSpinner } from "@/components/shared/LoadingSpinner";
import { VOICE_OPTIONS } from "@/lib/utils";
import type { Agent } from "@/types";

export interface AgentFormValues {
  name: string;
  description: string;
  system_prompt: string;
  first_message: string;
  voice_id: string;
  voice_name: string;
  temperature: number;
  status: string;
}

export function AgentForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Agent;
  onSubmit: (values: AgentFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<AgentFormValues>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    system_prompt: initial?.system_prompt ?? "",
    first_message: initial?.first_message ?? "",
    voice_id: initial?.voice_id ?? VOICE_OPTIONS[0].id,
    voice_name: initial?.voice_name ?? VOICE_OPTIONS[0].name,
    temperature: initial?.temperature ?? 0.5,
    status: initial?.status ?? "active",
  });
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof AgentFormValues>(k: K, v: AgentFormValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 space-y-5 px-6 py-5">
        <div>
          <label className="label">Agent Name</label>
          <input
            className="input"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Sarah — Sales Qualifier"
            required
          />
        </div>

        <div>
          <label className="label">Description</label>
          <input
            className="input"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What does this agent do?"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label">System Prompt</label>
            <span className="text-xs text-text-muted">
              {values.system_prompt.length} chars
            </span>
          </div>
          <textarea
            className="input min-h-[140px] font-mono text-sm resize-y"
            value={values.system_prompt}
            onChange={(e) => set("system_prompt", e.target.value)}
            placeholder="You are a friendly sales agent…"
          />
        </div>

        <div>
          <label className="label">First Message</label>
          <input
            className="input"
            value={values.first_message}
            onChange={(e) => set("first_message", e.target.value)}
            placeholder="Hi, this is Sarah from VoiceDesk!"
          />
        </div>

        <div>
          <label className="label">Voice (ElevenLabs)</label>
          <div className="grid grid-cols-1 gap-2">
            {VOICE_OPTIONS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  set("voice_id", v.id);
                  set("voice_name", v.name);
                }}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                  values.voice_id === v.id
                    ? "border-accent bg-accent/10"
                    : "border-border hover:border-text-muted"
                }`}
              >
                <div>
                  <p className="text-sm font-medium">{v.name}</p>
                  <p className="text-xs text-text-secondary">{v.desc}</p>
                </div>
                {values.voice_id === v.id && (
                  <span className="h-2 w-2 rounded-full bg-accent" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label">Temperature</label>
            <span className="text-xs text-text-secondary">
              {values.temperature.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={values.temperature}
            onChange={(e) => set("temperature", parseFloat(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-xs text-text-muted mt-1">
            <span>Focused</span>
            <span>Creative</span>
          </div>
        </div>

        {initial && (
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={values.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        )}
      </div>

      <div className="border-t border-border px-6 py-4 flex items-center gap-3">
        <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={submitting}>
          {submitting && <InlineSpinner />}
          {initial ? "Save Changes" : "Create Agent"}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}
