from fastapi import APIRouter

from config import settings
from utils import envelope

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
async def get_settings():
    return envelope(
        {
            "vapi_connected": settings.vapi_ready,
            "phone_connected": settings.phone_ready,
            "has_gemini": settings.gemini_ready,
            "has_elevenlabs": bool(settings.ELEVENLABS_API_KEY.strip()),
            "vapi_public_key": settings.VAPI_PUBLIC_KEY,
        }
    )
