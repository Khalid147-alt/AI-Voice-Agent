# 🎙️ VoiceDesk — AI Voice Agent Management Platform

A production-grade, full-stack platform for building, launching, and monitoring AI phone agents. Create voice agents, run inbound/outbound call campaigns, watch live calls in real time, and review transcripts, recordings, and AI-powered post-call analysis — all from one beautiful dashboard.

> Built to demonstrate end-to-end voice AI engineering with **VAPI**, **FastAPI**, **LangGraph**, **ElevenLabs**, and real-time call management.

![VoiceDesk dashboard](docs/hero.png)

> Dark, electric-blue dashboard — KPI cards (Total Calls · Connected Rate · Avg Duration · Qualified Leads), call-volume and sentiment-breakdown charts, and an agents panel with per-agent stats.

---

## ✨ Features

- **AI Agents** — Create voice agents with custom prompts, first messages, ElevenLabs voices, and temperature; synced to VAPI assistants.
- **Live Call Monitoring** — Real-time dashboard feed of in-progress calls with animated waveforms and live duration timers (via WebSockets).
- **In-Browser Test Calls** — Talk to any agent directly in the browser using the VAPI Web SDK (or a simulated call in demo mode).
- **Campaigns** — 3-step wizard to select an agent + contacts and launch batched outbound calling with configurable pacing (APScheduler).
- **Contacts** — Manual add + CSV import with status tracking (new → contacted → qualified → booked).
- **Transcripts & Analysis** — Chat-style transcript viewer, recording playback, lead score, intent, sentiment, objections, and recommended next action.
- **LangGraph Pipeline** — 4-node post-call analysis: sentiment → intent → lead score → recommended action.
- **Analytics** — Call volume, interest breakdown, success rate by agent, calls by hour, and cost trend charts.
- **Demo Mode** — Runs fully without any API keys, using rich seed data and simulated calls.

---

## 🧰 Tech Stack

**Backend:** Python 3.11 · FastAPI · SQLAlchemy (async + aiosqlite) · LangGraph · APScheduler · httpx · WebSockets · VAPI REST API

**Frontend:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Recharts · Framer Motion · Lucide · @vapi-ai/web

---

## 🚀 Quick Start

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1   |   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # leave keys blank for demo mode
uvicorn main:app --reload --port 8000
```

The API starts on **http://localhost:8000**, auto-creates the SQLite DB, and seeds demo data (3 agents, 20 contacts, 15 calls incl. 3 live) on first run.

### 2. Frontend

```bash
cd frontend
npm install
# .env.local already points at http://localhost:8000
npm run dev
```

Open **http://localhost:3000** → you'll be redirected to the dashboard.

> On Windows you can also use the helper scripts: `backend/start.ps1` and `npm run dev` in `frontend/`.

### 3–5. Explore

3. **Dashboard** — watch the live calls feed animate.
4. **Agents** → open one → **Start Test Call** (simulated in demo mode).
5. **Campaigns → New** — build a campaign and hit *Launch* to see calls stream in.

---

## 🏗️ Architecture

```
┌──────────────────────────────┐         WebSocket (/ws)        ┌───────────────────────────┐
│      Next.js 14 Frontend     │ ◄───────live call events──────►│      FastAPI Backend       │
│  Dashboard · Agents · Calls  │                                │                            │
│  Campaigns · Contacts · A/n  │ ───────REST /api/* ──────────► │  Routers ─► Services ─► DB  │
└──────────────┬───────────────┘                                │   │           │            │
               │ @vapi-ai/web (browser call)                    │   │           ├─ VAPI client (httpx)
               ▼                                                 │   │           ├─ LangGraph pipeline
        ┌─────────────┐         webhooks (/api/webhooks/vapi)   │   │           └─ APScheduler
        │    VAPI      │ ──────────────────────────────────────►│   ▼
        │  (telephony) │   status · transcript · end-of-call    │  SQLite (async / aiosqlite)
        └─────────────┘                                         └───────────────────────────┘
```

**Post-call flow:** VAPI `end-of-call-report` → webhook persists transcript/cost/recording → fires the LangGraph pipeline (sentiment → intent → lead score → next action) → broadcasts `analysis_ready` over WebSocket → dashboard updates.

---

## 📞 VAPI Setup (for real calls)

1. Create an account at [dashboard.vapi.ai](https://dashboard.vapi.ai).
2. Copy your **Private** and **Public** API keys.
3. Buy/import a phone number and copy its **Phone Number ID**.
4. Fill these into `backend/.env` and set `NEXT_PUBLIC_VAPI_PUBLIC_KEY` in `frontend/.env.local`.
5. Expose your backend for webhooks (e.g. `ngrok http 8000`) and set `BACKEND_URL` to the public URL so VAPI can reach `/api/webhooks/vapi`.
6. Restart the backend — agents you create are now synced to real VAPI assistants and "Test Call" places real calls.

---

## 🧪 Demo Mode

When `VAPI_PRIVATE_KEY` is blank, VoiceDesk runs in **demo mode**:

- A yellow "Demo Mode" banner appears in the top bar.
- All VAPI network calls are skipped; the app uses seed data.
- **Test Call** simulates a conversation using the browser's Web Speech API with a streaming mock transcript.
- Campaigns simulate outbound calls (with realistic outcomes) so the dashboard, analytics, and transcripts all populate.

This makes the entire product explorable with zero setup.

---

## 🌐 Deployment

- **Backend** → Railway / Render (set env vars, run `uvicorn main:app`).
- **Frontend** → Vercel (set `NEXT_PUBLIC_API_URL` to your deployed backend URL).

> Live demo: deployed to **Railway** (backend) + **Vercel** (frontend).

---

## 📁 Project Structure

```
voicedesk/
├── backend/    FastAPI · models · schemas · routers · services (VAPI, LangGraph, scheduler) · ws
└── frontend/   Next.js App Router · components (layout, dashboard, agents, calls, campaigns, voice, shared) · lib · types
```

---

## 📄 License

MIT
