from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    VAPI_PRIVATE_KEY: str = ""
    VAPI_PUBLIC_KEY: str = ""
    VAPI_PHONE_NUMBER_ID: str = ""  # Twilio number purchased in VAPI
    GOOGLE_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    ELEVENLABS_API_KEY: str = ""
    DATABASE_URL: str = "sqlite+aiosqlite:///./voicedesk.db"
    BACKEND_URL: str = "http://localhost:8000"  # used for webhook URLs

    # CORS — frontend origin
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def demo_mode(self) -> bool:
        """Demo mode is active when no real VAPI private key is configured."""
        return not bool(self.VAPI_PRIVATE_KEY.strip())


settings = Settings()
