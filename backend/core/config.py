import os
import logging
from dotenv import load_dotenv, find_dotenv

# Loads environment variables
load_dotenv(find_dotenv())

# FastAPI env
FASTAPI_ENV = os.getenv("FASTAPI_ENV")

# Every API route is mounted under this prefix
API_PREFIX = "/api"


# PostgreSQL database
POSTGRES_DB_NAME = os.getenv("DB_NAME")
POSTGRES_DB_USER = os.getenv("DB_USER")
POSTGRES_DB_PASSWORD = os.getenv("DB_PASSWORD")
POSTGRES_DB_HOST = os.getenv("DB_HOST")
POSTGRES_DB_PORT = os.getenv("DB_PORT")


# Auth: short-lived access JWT (client memory, Bearer header) + rotating refresh token (httpOnly cookie)
JWT_SECRET = os.getenv("JWT_SECRET_KEY", "")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
REFRESH_COOKIE_NAME = "refresh_token"
# Refresh cookie is only sent to the auth endpoints
REFRESH_COOKIE_PATH = f"{API_PREFIX}/auth"
# Always Secure (browsers accept Secure cookies on http://localhost too)
AUTH_COOKIE_SECURE = True
# Cross-site deploys (frontend and API on different sites) need SameSite=none
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "lax").lower()

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET_KEY is not set; add it to backend/.env")


# Browser origins allowed to call the API with cookies (comma-separated)
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,https://travel-flow-production.up.railway.app",
    ).split(",")
    if origin.strip()
]


# Logs filename
LOGS_FILENAME = "logs_travel_flow.log"

# Logging
logger = logging.getLogger("travel_flow")
logger.setLevel(logging.INFO if FASTAPI_ENV != "dev" else logging.DEBUG)

# Create a file handler
file_handler = logging.FileHandler(LOGS_FILENAME)
formatter = logging.Formatter("%(asctime)s %(levelname)s:%(message)s")
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# PostgreSQL DB URL
POSTGRES_DATABASE_URL = (
    f"postgresql+psycopg://{POSTGRES_DB_USER}:{POSTGRES_DB_PASSWORD}"
    f"@{POSTGRES_DB_HOST}:{POSTGRES_DB_PORT}/{POSTGRES_DB_NAME}"
)


