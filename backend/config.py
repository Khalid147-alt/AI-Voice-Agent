from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    VAPI_PRIVATE_KEY: str = ""
    VAPI_PUBLIC_KEY: str = ""
    VAPI_PHONE_NUMBER_ID: str = ""  # Twilio number purchased in VAPI
    GOOGLE_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    ELEVENLABS_API_KEY: str = ""
    # On Hugging Face Spaces the working dir is writable but ephemeral (resets on
    # rebuild/restart). Attach a persistent disk and point this at it (e.g.
    # sqlite+aiosqlite:////data/voicedesk.db) or use an external DB for durability.
    DATABASE_URL: str = "sqlite+aiosqlite:///./voicedesk.db"
    BACKEND_URL: str = "http://localhost:8000"  # public URL, used for VAPI webhook URLs
    PORT: int = 8000  # HF Spaces set this to 7860

    # CORS — frontend origin (your Vercel URL in production)
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def vapi_ready(self) -> bool:
        """True when a VAPI private key is configured."""
        return bool(self.VAPI_PRIVATE_KEY.strip())

    @property
    def gemini_ready(self) -> bool:
        """True when a Google Gemini API key is configured."""
        return bool(self.GOOGLE_API_KEY.strip())

    @property
    def phone_ready(self) -> bool:
        """True when a VAPI phone number id is configured (needed for phone calls)."""
        return bool(self.VAPI_PHONE_NUMBER_ID.strip())

    def missing_required(self) -> list[str]:
        """Return the list of required production settings that are not configured."""
        missing = []
        if not self.vapi_ready:
            missing.append("VAPI_PRIVATE_KEY")
        if not self.gemini_ready:
            missing.append("GOOGLE_API_KEY")
        return missing


settings = Settings()
