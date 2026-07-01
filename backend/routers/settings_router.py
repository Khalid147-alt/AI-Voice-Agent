from fastapi import APIRouter

from config import settings
from utils import envelope

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
async def get_settings():
    return envelope(
        {
            "demo_mode": settings.demo_mode,
            "vapi_connected": not settings.demo_mode,
            "has_gemini": bool(settings.GOOGLE_API_KEY.strip()),
            "has_elevenlabs": bool(settings.ELEVENLABS_API_KEY.strip()),
            "vapi_public_key": settings.VAPI_PUBLIC_KEY,
        }
    )
