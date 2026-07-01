"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import { AgentCard } from "@/components/agents/AgentCard";
import { AgentForm, AgentFormValues } from "@/components/agents/AgentForm";
import { Drawer, Modal } from "@/components/shared/Drawer";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner, InlineSpinner } from "@/components/shared/LoadingSpinner";
import type { Agent } from "@/types";

export default function AgentsPage() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setAgents(await api.listAgents());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load agents", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(undefined);
    setDrawerOpen(true);
  };
  const openEdit = (a: Agent) => {
    setEditing(a);
    setDrawerOpen(true);
  };

  const handleSubmit = async (values: AgentFormValues) => {
    try {
      if (editing) {
        await api.updateAgent(editing.id, values);
        toast("Agent updated", "success");
      } else {
        await api.createAgent(values);
        toast("Agent created", "success");
      }
      setDrawerOpen(false);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteAgent(deleteTarget.id);
      toast("Agent deleted", "success");
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-sm">
          Create and manage your AI phone agents.
        </p>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Create Agent
        </button>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading agents…" />
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          message="Create your first AI voice agent to start making calls."
          action={
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Create Agent
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((a, i) => (
            <AgentCard
              key={a.id}
              agent={a}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              delay={i * 0.04}
            />
          ))}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? "Edit Agent" : "Create Agent"}
        subtitle={editing ? editing.name : "Configure a new AI voice agent"}
      >
        <AgentForm
          initial={editing}
          onSubmit={handleSubmit}
          onCancel={() => setDrawerOpen(false)}
        />
      </Drawer>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete agent?"
      >
        <p className="text-sm text-text-secondary">
          This will permanently delete{" "}
          <span className="text-text-primary font-medium">
            {deleteTarget?.name}
          </span>
          {deleteTarget?.vapi_assistant_id ? " and its VAPI assistant" : ""}. This
          cannot be undone.
        </p>
        <div className="mt-5 flex gap-3">
          <button onClick={handleDelete} className="btn-danger flex-1 flex items-center justify-center gap-2" disabled={deleting}>
            {deleting && <InlineSpinner />} Delete
          </button>
          <button onClick={() => setDeleteTarget(null)} className="btn-ghost">
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
