"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Users, Plus, Upload, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner, InlineSpinner } from "@/components/shared/LoadingSpinner";
import { Modal } from "@/components/shared/Drawer";
import { formatRelativeTime } from "@/lib/utils";
import type { Contact } from "@/types";

const STATUSES = ["new", "contacted", "qualified", "booked", "rejected"];

export default function ContactsPage() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setContacts(await api.listContacts());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load contacts", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () =>
      statusFilter ? contacts.filter((c) => c.status === statusFilter) : contacts,
    [contacts, statusFilter]
  );

  const handleCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = text.split(/\r?\n/).filter((r) => r.trim());
      if (rows.length < 2) {
        toast("CSV appears empty", "error");
        return;
      }
      const headers = rows[0].split(",").map((h) => h.trim().toLowerCase());
      const idx = (name: string) => headers.indexOf(name);
      const parsed = rows.slice(1).map((line) => {
        const cells = line.split(",").map((c) => c.trim());
        return {
          name: cells[idx("name")] || cells[0] || "Unknown",
          phone: cells[idx("phone")] || cells[1] || "",
          email: idx("email") >= 0 ? cells[idx("email")] : undefined,
          company: idx("company") >= 0 ? cells[idx("company")] : undefined,
        };
      });
      const res = await api.importContacts(parsed);
      toast(`Imported ${res.imported} contacts`, "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Import failed", "error");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-auto min-w-[160px] cursor-pointer"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleCsv}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-ghost flex items-center gap-2"
          >
            <Upload className="h-4 w-4" /> Import CSV
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add Contact
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading contacts…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts"
          message="Add contacts manually or import a CSV to start calling."
          action={
            <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Contact
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-secondary">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Tags</th>
                  <th className="px-4 py-3 font-medium">Last Called</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 hover:bg-surface-elevated transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-text-secondary whitespace-nowrap">
                      {c.phone}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {c.company || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.tags?.length
                          ? c.tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-secondary"
                              >
                                {t}
                              </span>
                            ))
                          : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                      {c.last_called_at
                        ? formatRelativeTime(c.last_called_at)
                        : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddContactModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          setAddOpen(false);
          load();
        }}
      />
    </div>
  );
}

function AddContactModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "", company: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setSaving(true);
    try {
      await api.createContact(form);
      toast("Contact added", "success");
      setForm({ name: "", phone: "", email: "", company: "" });
      onCreated();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Contact">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            className="input font-mono"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+1 (555) 010-1234"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Company</label>
            <input
              className="input"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={saving}
          >
            {saving && <InlineSpinner />} Add Contact
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
