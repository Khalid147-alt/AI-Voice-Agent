# 🎙️ VoiceDesk — AI Voice Agent Management Platform

A production-grade, full-stack platform for building, launching, and monitoring AI phone agents. Create voice agents, run inbound/outbound call campaigns, watch live calls in real time, and review transcripts, recordings, and AI-powered post-call analysis — all from one beautiful dashboard.

> Built to demonstrate end-to-end voice AI engineering with **VAPI**, **FastAPI**, **LangGraph**, **ElevenLabs**, and real-time call management.

![VoiceDesk dashboard](docs/hero.png)

> Dark, electric-blue dashboard — KPI cards (Total Calls · Connected Rate · Avg Duration · Qualified Leads), call-volume and sentiment-breakdown charts, and an agents panel with per-agent stats.

---

## ✨ Features

- **AI Agents** — Create voice agents with custom prompts, first messages, ElevenLabs voices, and temperature; synced to VAPI assistants.
- **Live Call Monitoring** — Real-time dashboard feed of in-progress calls with animated waveforms and live duration timers (via WebSockets).
- **In-Browser Test Calls** — Talk to any agent directly in the browser using the VAPI Web SDK (microphone → live assistant).
- **Campaigns** — 3-step wizard to select an agent + contacts and launch batched outbound calling with configurable pacing (APScheduler).
- **Contacts** — Manual add + CSV import with status tracking (new → contacted → qualified → booked).
- **Transcripts & Analysis** — Chat-style transcript viewer, recording playback, lead score, intent, sentiment, objections, and recommended next action.
- **LangGraph Pipeline** — 4-node post-call analysis: sentiment → intent → lead score → recommended action.
- **Analytics** — Call volume, interest breakdown, success rate by agent, calls by hour, and cost trend charts.

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
cp .env.example .env          # then fill in your VAPI + Gemini keys
uvicorn main:app --reload --port 8000
```

The API starts on **http://localhost:8000** and auto-creates an empty SQLite DB on first run. On startup it logs a warning if any required key (`VAPI_PRIVATE_KEY`, `GOOGLE_API_KEY`) or the phone number is missing.

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

3. **Agents → New** — create an agent; it's synced to a real VAPI assistant automatically.
4. **Agents** → open one → **Start Test Call** — talk to it live in your browser via the mic.
5. **Campaigns → New** — build a campaign and hit *Launch* to place real outbound calls (requires a VAPI phone number).

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

## 📞 VAPI Setup

1. Create an account at [dashboard.vapi.ai](https://dashboard.vapi.ai) and copy your **Private** and **Public** API keys.
2. **Register provider credentials in your VAPI org** so the live assistant can use them (Dashboard → Providers, or via the API):
   - **Google (Gemini)** — the assistant's LLM (`gemini-2.5-flash`).
   - **ElevenLabs** — the assistant's voice.
   > Your backend `GOOGLE_API_KEY` only powers the post-call analysis pipeline. VAPI runs the *live* assistant on its own infra, so those keys must also be registered inside VAPI.
3. For **outbound phone calls / campaigns**: buy or import a phone number in VAPI and copy its **Phone Number ID** into `VAPI_PHONE_NUMBER_ID`. (In-browser web calls don't need a number.)
4. Fill the keys into `backend/.env` and set `NEXT_PUBLIC_VAPI_PUBLIC_KEY` in `frontend/.env.local`.
5. Set `BACKEND_URL` to a **public** URL so VAPI can reach `/api/webhooks/vapi` (use `ngrok http 8000` locally, or your deployed URL in production). localhost is not reachable by VAPI.
6. Restart the backend — agents you create sync to real VAPI assistants, "Test Call" runs a live browser call, and campaigns place real outbound calls.

---

## ✅ Production Checklist

- [ ] `VAPI_PRIVATE_KEY`, `VAPI_PUBLIC_KEY`, `GOOGLE_API_KEY` set in `backend/.env`
- [ ] Google + ElevenLabs credentials registered **in the VAPI org**
- [ ] `NEXT_PUBLIC_VAPI_PUBLIC_KEY` + `NEXT_PUBLIC_API_URL` set in `frontend/.env.local`
- [ ] `BACKEND_URL` points to a public/deployed URL (for webhooks)
- [ ] `VAPI_PHONE_NUMBER_ID` set (only if using outbound phone calls/campaigns)
- [ ] Startup log shows no missing-key warnings; `GET /api/settings` returns `vapi_connected: true`

The app starts with an empty database — create your own agents and contacts. There is no demo/seed data.

---

## 🌐 Deployment

**Backend → Hugging Face Docker Space** ([Space](https://huggingface.co/spaces/Khalid147/AI-Voice-Agent))

The `backend/` folder is the Space root: it contains a `Dockerfile` (binds `0.0.0.0:7860`) and a `README.md` with the Docker frontmatter HF requires. Set the keys under **Settings → Variables and secrets** (see the backend README table). Set `BACKEND_URL` to the Space URL and `FRONTEND_URL` to your Vercel URL.

**Frontend → Vercel**

1. Import the GitHub repo in Vercel.
2. Set **Root Directory** to `frontend`.
3. Add env vars:
   - `NEXT_PUBLIC_API_URL` = your HF Space URL (e.g. `https://khalid147-ai-voice-agent.hf.space`)
   - `NEXT_PUBLIC_VAPI_PUBLIC_KEY` = your VAPI public key
4. Deploy. The WebSocket URL is derived from `NEXT_PUBLIC_API_URL` automatically (`https→wss`).

> The two services are cross-origin: the backend allows the Vercel origin via CORS (`FRONTEND_URL` + any `*.vercel.app`).

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
