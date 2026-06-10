import os
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_KEY_FILE = _PROJECT_ROOT / "yandex_maps_api_key.txt"


def _read_yandex_api_key() -> str:
    env_key = os.environ.get("YANDEX_MAPS_API_KEY", "").strip()
    if env_key:
        return env_key
    if _KEY_FILE.is_file():
        return _KEY_FILE.read_text(encoding="utf-8").strip()
    return ""


YANDEX_MAPS_API_KEY = _read_yandex_api_key()
