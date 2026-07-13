export type AgentStatus = "active" | "paused";
export type CallStatus =
  | "queued"
  | "ringing"
  | "in-progress"
  | "completed"
  | "failed"
  | "no-answer";
export type CallDirection = "inbound" | "outbound";
export type InterestLevel = "hot" | "warm" | "cold";
export type ContactStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "booked"
  | "rejected";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed";

export interface Agent {
  id: string;
  vapi_assistant_id: string | null;
  name: string;
  description: string;
  system_prompt: string;
  first_message: string;
  voice_id: string;
  voice_provider: string;
  voice_name: string;
  temperature: number;
  status: AgentStatus;
  calls_count: number;
  success_rate: number;
  created_at: string;
  updated_at: string;
}

export interface TranscriptEntry {
  role: string;
  content: string;
  timestamp?: number;
}

export interface CallAnalysis {
  prospect_name?: string;
  interest_level?: InterestLevel;
  objections?: string[];
  next_steps?: string;
  sentiment?: "positive" | "neutral" | "negative";
  intent?: string;
  lead_score?: number;
  next_action?: string;
}

export interface Call {
  id: string;
  vapi_call_id: string | null;
  agent_id: string | null;
  agent_name: string | null;
  contact_id: string | null;
  campaign_id: string | null;
  direction: CallDirection;
  status: CallStatus;
  phone_number: string;
  duration_seconds: number | null;
  cost_usd: number | null;
  transcript: TranscriptEntry[] | null;
  summary: string | null;
  analysis: CallAnalysis | null;
  recording_url: string | null;
  interest_level: InterestLevel | null;
  success: boolean | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  status: ContactStatus;
  tags: string[];
  notes: string | null;
  last_called_at: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  agent_id: string | null;
  agent_name: string | null;
  status: CampaignStatus;
  contact_ids: string[];
  calls_per_batch: number;
  delay_between_calls_seconds: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_contacts: number;
  calls_made: number;
  calls_answered: number;
  leads_qualified: number;
  created_at: string;
}

export interface AnalyticsOverview {
  total_calls: number;
  total_cost: number;
  avg_duration_seconds: number;
  success_rate: number;
  calls_this_week: number;
  calls_last_week: number;
  live_calls: number;
  hot_leads_today: number;
  calls_today: number;
  cost_today: number;
}

export interface CallVolumePoint {
  date: string;
  calls: number;
}

export interface InterestBreakdownPoint {
  level: InterestLevel;
  count: number;
}

export interface AgentPerformancePoint {
  agent_id: string;
  agent_name: string;
  calls: number;
  success_rate: number;
  avg_duration_seconds: number;
}

export interface CallsByHourPoint {
  hour: number;
  calls: number;
}

export interface CostTrendPoint {
  date: string;
  cost: number;
}

export interface AppSettings {
  vapi_connected: boolean;
  phone_connected: boolean;
  has_gemini: boolean;
  has_elevenlabs: boolean;
  vapi_public_key: string;
}

export interface ApiEnvelope<T> {
  data: T;
  error: string | null;
}

export interface WsEvent {
  type: string;
  call_id?: string;
  status?: string;
  campaign_id?: string;
  calls_made?: number;
  entry?: TranscriptEntry;
  name?: string;
}
