import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

APP_NAME = os.getenv("APP_NAME", "Система учета ЖКХ").strip()
