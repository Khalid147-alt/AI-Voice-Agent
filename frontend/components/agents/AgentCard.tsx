"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Bot, Phone, Pencil, Trash2, AudioLines } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Agent } from "@/types";

export function AgentCard({
  agent,
  onEdit,
  onDelete,
  delay = 0,
}: {
  agent: Agent;
  onEdit: (a: Agent) => void;
  onDelete: (a: Agent) => void;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="card p-5 group hover:border-accent/50 hover:shadow-[0_0_0_1px_rgba(79,110,247,0.3)] transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/15">
            <Bot className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{agent.name}</h3>
            <p className="text-xs text-text-secondary truncate">
              {agent.description || "AI voice agent"}
            </p>
          </div>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-xs text-text-secondary">
        <AudioLines className="h-3.5 w-3.5" />
        ElevenLabs · {agent.voice_name}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface-elevated px-3 py-2">
          <p className="text-xs text-text-secondary">Total Calls</p>
          <p className="text-lg font-semibold">{agent.calls_count}</p>
        </div>
        <div className="rounded-lg bg-surface-elevated px-3 py-2">
          <p className="text-xs text-text-secondary">Success Rate</p>
          <p className="text-lg font-semibold">{agent.success_rate}%</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={`/agents/${agent.id}`}
          className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm"
        >
          <Phone className="h-4 w-4" /> Test Call
        </Link>
        <button
          onClick={() => onEdit(agent)}
          className="btn-ghost"
          aria-label="Edit agent"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(agent)}
          className="btn-danger"
          aria-label="Delete agent"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
