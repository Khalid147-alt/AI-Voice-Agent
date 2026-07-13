---
title: AI Voice Agent
emoji: 🎙️
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# VoiceDesk — Backend API

FastAPI backend for the VoiceDesk AI Voice Agent platform. Deployed as a
Hugging Face Docker Space; the frontend runs separately on Vercel.

- **Health check:** `GET /health`
- **Config check:** `GET /api/settings`
- **API docs:** `GET /docs`

## Required Space secrets

Set these in **Settings → Variables and secrets** (never commit them):

| Name | Purpose |
|------|---------|
| `VAPI_PRIVATE_KEY` | VAPI private key (backend calls) |
| `VAPI_PUBLIC_KEY` | VAPI public key (returned to the browser SDK) |
| `GOOGLE_API_KEY` | Google Gemini — post-call analysis |
| `VAPI_PHONE_NUMBER_ID` | Only for outbound phone calls/campaigns |
| `ELEVENLABS_API_KEY` | Voice (also register in the VAPI org) |
| `FRONTEND_URL` | Your Vercel URL, e.g. `https://your-app.vercel.app` |
| `BACKEND_URL` | This Space URL, e.g. `https://khalid147-ai-voice-agent.hf.space` |

The code lives in the [GitHub repo](https://github.com/Khalid147-alt/AI-Voice-Agent) (`backend/`).
