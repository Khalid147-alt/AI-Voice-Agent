# VoiceDesk — Backend API

FastAPI backend for the VoiceDesk AI Voice Agent platform. Deployed as a
**Vercel Python serverless** project; the frontend is a separate Vercel project.

- **Health check:** `GET /health`
- **Config check:** `GET /api/settings`
- **API docs:** `GET /docs`

## Deploy to Vercel

1. In Vercel, **Add New → Project**, import this repo.
2. Set **Root Directory** to `backend`. Vercel detects `vercel.json` and the
   `api/index.py` Python entrypoint automatically.
3. Add the environment variables below (**Settings → Environment Variables**).
4. Add a database: **Storage → Create → Postgres** (Vercel Postgres, powered by
   Neon). This injects `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` automatically
   — no `DATABASE_URL` needed. (Or set `DATABASE_URL` to any external Postgres.)
5. Deploy. Tables are created automatically on the first request.

## Environment variables

| Name | Purpose |
|------|---------|
| `VAPI_PRIVATE_KEY` | VAPI private key (backend calls) |
| `VAPI_PUBLIC_KEY` | VAPI public key (returned to the browser SDK) |
| `GOOGLE_API_KEY` | Google Gemini — post-call analysis |
| `VAPI_PHONE_NUMBER_ID` | Only for outbound phone calls/campaigns |
| `ELEVENLABS_API_KEY` | Voice (also register in the VAPI org) |
| `FRONTEND_URL` | Your frontend Vercel URL, e.g. `https://your-app.vercel.app` |
| `BACKEND_URL` | This backend's Vercel URL, e.g. `https://your-api.vercel.app` |
| `CRON_SECRET` | Secret guarding the campaign cron endpoint (see below) |
| `DATABASE_URL` | Optional — only if using an external Postgres instead of Vercel Postgres |

## Serverless notes

This backend was adapted from a long-running server to Vercel's stateless,
per-request serverless model:

- **No WebSockets.** Vercel functions can't hold sockets open, so the live
  dashboard uses REST **polling** instead. Webhook handlers persist call state;
  the frontend polls for it.
- **No in-process scheduler.** Outbound campaign pacing is driven by **Vercel
  Cron** (`crons` in `vercel.json`), which calls `POST /api/cron/run-campaigns`
  every 2 minutes to dispatch one paced batch per active campaign. Launching a
  campaign also dispatches its first batch inline for instant feedback. The cron
  endpoint requires the `CRON_SECRET` as a Bearer token (Vercel sends it
  automatically).
- **Postgres, not SQLite.** The filesystem is ephemeral, so state lives in
  Vercel Postgres. The engine uses `NullPool` (one connection per invocation)
  with SSL, suitable for serverless.

## Local development

```bash
cd backend
python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1  |  macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in your keys; DATABASE_URL defaults to SQLite
uvicorn main:app --reload --port 8000
```

The code lives in the [GitHub repo](https://github.com/Khalid147-alt/AI-Voice-Agent) (`backend/`).
