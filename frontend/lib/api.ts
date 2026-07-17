import type {
  Agent,
  Call,
  Contact,
  Campaign,
  AnalyticsOverview,
  CallVolumePoint,
  InterestBreakdownPoint,
  AgentPerformancePoint,
  CallsByHourPoint,
  CostTrendPoint,
  AppSettings,
  ApiEnvelope,
} from "@/types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      cache: "no-store",
    });
  } catch (e) {
    throw new ApiError(
      "Cannot reach the VoiceDesk API. Is the backend running on :8000?"
    );
  }

  let json: ApiEnvelope<T> | { detail?: string };
  try {
    json = await res.json();
  } catch {
    throw new ApiError(`Unexpected response from server (${res.status}).`);
  }

  if (!res.ok) {
    const detail =
      (json as { detail?: string }).detail ||
      (json as ApiEnvelope<T>).error ||
      `Request failed (${res.status})`;
    throw new ApiError(detail);
  }

  const envelope = json as ApiEnvelope<T>;
  // Soft errors are surfaced but data still returned.
  if (envelope.error) {
    // eslint-disable-next-line no-console
    console.warn("API soft error:", envelope.error);
  }
  return envelope.data;
}

export const api = {
  // Settings
  getSettings: () => request<AppSettings>("/api/settings"),

  // Agents
  listAgents: () => request<Agent[]>("/api/agents"),
  getAgent: (id: string) => request<Agent>(`/api/agents/${id}`),
  createAgent: (body: unknown) =>
    request<Agent>("/api/agents", { method: "POST", body: JSON.stringify(body) }),
  updateAgent: (id: string, body: unknown) =>
    request<Agent>(`/api/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteAgent: (id: string) =>
    request<{ deleted: string }>(`/api/agents/${id}`, { method: "DELETE" }),

  // Calls
  listCalls: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Call[]>(`/api/calls${qs}`);
  },
  getCall: (id: string) => request<Call>(`/api/calls/${id}`),
  createCall: (body: {
    agent_id: string;
    phone_number?: string;
    contact_id?: string;
    direction?: string;
  }) => request<Call>("/api/calls", { method: "POST", body: JSON.stringify(body) }),

  // Contacts
  listContacts: (status?: string) =>
    request<Contact[]>(`/api/contacts${status ? `?status=${status}` : ""}`),
  createContact: (body: Partial<Contact>) =>
    request<Contact>("/api/contacts", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  importContacts: (contacts: Partial<Contact>[]) =>
    request<{ imported: number }>("/api/contacts/import", {
      method: "POST",
      body: JSON.stringify({ contacts }),
    }),
  updateContact: (id: string, body: Partial<Contact>) =>
    request<Contact>(`/api/contacts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteContact: (id: string) =>
    request<{ deleted: string }>(`/api/contacts/${id}`, { method: "DELETE" }),

  // Campaigns
  listCampaigns: () => request<Campaign[]>("/api/campaigns"),
  getCampaign: (id: string) => request<Campaign>(`/api/campaigns/${id}`),
  createCampaign: (body: {
    name: string;
    agent_id: string;
    contact_ids: string[];
    calls_per_batch?: number;
    delay_between_calls_seconds?: number;
    scheduled_at?: string | null;
    run_now?: boolean;
  }) =>
    request<Campaign>("/api/campaigns", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  startCampaign: (id: string) =>
    request<Campaign>(`/api/campaigns/${id}/start`, { method: "POST" }),
  pauseCampaign: (id: string) =>
    request<Campaign>(`/api/campaigns/${id}/pause`, { method: "POST" }),

  // Analytics
  overview: () => request<AnalyticsOverview>("/api/analytics/overview"),
  callVolume: (days = 30) =>
    request<CallVolumePoint[]>(`/api/analytics/call-volume?days=${days}`),
  interestBreakdown: () =>
    request<InterestBreakdownPoint[]>("/api/analytics/interest-breakdown"),
  agentPerformance: () =>
    request<AgentPerformancePoint[]>("/api/analytics/agent-performance"),
  callsByHour: () =>
    request<CallsByHourPoint[]>("/api/analytics/calls-by-hour"),
  costTrend: (days = 30) =>
    request<CostTrendPoint[]>(`/api/analytics/cost-trend?days=${days}`),
};
