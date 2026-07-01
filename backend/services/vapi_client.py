"""Async wrapper around the VAPI REST API.

When no VAPI private key is configured (demo mode), all network methods raise
``DemoModeError`` so callers can gracefully fall back to local-only behaviour.
"""
from typing import List, Optional

import httpx

from config import settings


class DemoModeError(RuntimeError):
    """Raised when a VAPI network call is attempted without credentials."""


class VAPIClient:
    BASE_URL = "https://api.vapi.ai"

    def __init__(self, private_key: Optional[str] = None) -> None:
        self.private_key = private_key if private_key is not None else settings.VAPI_PRIVATE_KEY

    @property
    def enabled(self) -> bool:
        return bool(self.private_key.strip())

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.private_key}",
            "Content-Type": "application/json",
        }

    def _guard(self) -> None:
        if not self.enabled:
            raise DemoModeError("VAPI private key not configured (demo mode).")

    async def _request(self, method: str, path: str, **kwargs):
        self._guard()
        url = f"{self.BASE_URL}{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(method, url, headers=self._headers(), **kwargs)
            resp.raise_for_status()
            if resp.status_code == 204 or not resp.content:
                return None
            return resp.json()

    # ----- Assistants -----
    async def create_assistant(self, config: dict) -> dict:
        return await self._request("POST", "/assistant", json=config)

    async def update_assistant(self, assistant_id: str, config: dict) -> dict:
        return await self._request("PATCH", f"/assistant/{assistant_id}", json=config)

    async def delete_assistant(self, assistant_id: str) -> None:
        await self._request("DELETE", f"/assistant/{assistant_id}")

    async def list_assistants(self) -> List[dict]:
        data = await self._request("GET", "/assistant")
        return data or []

    # ----- Calls -----
    async def create_call(self, payload: dict) -> dict:
        return await self._request("POST", "/call", json=payload)

    async def get_call(self, call_id: str) -> dict:
        return await self._request("GET", f"/call/{call_id}")

    async def list_calls(self, limit: int = 50) -> List[dict]:
        data = await self._request("GET", "/call", params={"limit": limit})
        return data or []

    # ----- Phone numbers -----
    async def list_phone_numbers(self) -> List[dict]:
        data = await self._request("GET", "/phone-number")
        return data or []


def build_assistant_config(agent) -> dict:
    """Build the VAPI assistant config payload from an Agent ORM instance."""
    return {
        "name": agent.name,
        "firstMessage": agent.first_message,
        "model": {
            "provider": "google",
            "model": "gemini-2.5-flash",
            "temperature": agent.temperature or 0.5,
            "systemPrompt": agent.system_prompt,
            "tools": [
                {"type": "endCall"},
                {
                    "type": "function",
                    "function": {
                        "name": "book_appointment",
                        "description": "Book a demo appointment when the prospect agrees",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "email": {"type": "string"},
                                "preferred_time": {"type": "string"},
                            },
                            "required": ["name", "email"],
                        },
                    },
                    "server": {"url": f"{settings.BACKEND_URL}/api/webhooks/tool-call"},
                },
            ],
        },
        "voice": {
            "provider": agent.voice_provider or "11labs",
            "voiceId": agent.voice_id or "21m00Tcm4TlvDq8ikWAM",
            "stability": 0.5,
            "similarityBoost": 0.75,
        },
        "transcriber": {
            "provider": "deepgram",
            "model": "nova-2",
            "language": "en-US",
        },
        "recordingEnabled": True,
        "serverUrl": f"{settings.BACKEND_URL}/api/webhooks/vapi",
        "serverMessages": [
            "end-of-call-report",
            "status-update",
            "transcript",
            "tool-calls",
        ],
        "endCallPhrases": ["goodbye", "take care", "bye for now"],
        "silenceTimeoutSeconds": 30,
        "maxDurationSeconds": 600,
        "backgroundSound": "off",
        "backchannelingEnabled": True,
        "analysisPlan": {
            "summaryPrompt": (
                "Summarize this sales call in 2-3 sentences. "
                "Note if the prospect is interested."
            ),
            "structuredDataPrompt": (
                "Extract: prospect_name, interest_level (hot/warm/cold), "
                "objections, next_steps"
            ),
            "structuredDataSchema": {
                "type": "object",
                "properties": {
                    "prospect_name": {"type": "string"},
                    "interest_level": {
                        "type": "string",
                        "enum": ["hot", "warm", "cold"],
                    },
                    "objections": {"type": "array", "items": {"type": "string"}},
                    "next_steps": {"type": "string"},
                },
            },
            "successEvaluationPrompt": (
                "Did the agent successfully qualify the lead and book a demo "
                "or get a clear next step?"
            ),
            "successEvaluationRubric": "PassFail",
        },
    }


vapi_client = VAPIClient()
