import os
import logging
from dotenv import load_dotenv, find_dotenv

# Loads environment variables
load_dotenv(find_dotenv())

# FastAPI env
FASTAPI_ENV = os.getenv("FASTAPI_ENV")


# Base URL
BASE_URL = os.getenv("BASE_URL")


# PostgreSQL database
POSTGRES_DB_NAME = os.getenv("DB_NAME")
POSTGRES_DB_USER = os.getenv("DB_USER")
POSTGRES_DB_PASSWORD = os.getenv("DB_PASSWORD")
POSTGRES_DB_HOST = os.getenv("DB_HOST")
POSTGRES_DB_PORT = os.getenv("DB_PORT")


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
