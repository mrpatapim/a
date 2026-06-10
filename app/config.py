import os
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_MAPS_KEY_FILE = _PROJECT_ROOT / "yandex_maps_api_key.txt"
_GEOCODER_KEY_FILE = _PROJECT_ROOT / "yandex_geocoder_api_key.txt"


def _read_key_file(path: Path) -> str:
    if path.is_file():
        return path.read_text(encoding="utf-8").strip()
    return ""


def _read_yandex_maps_api_key() -> str:
    env_key = os.environ.get("YANDEX_MAPS_API_KEY", "").strip()
    if env_key:
        return env_key
    return _read_key_file(_MAPS_KEY_FILE)


def _read_yandex_geocoder_api_key() -> str:
    env_key = os.environ.get("YANDEX_GEOCODER_API_KEY", "").strip()
    if env_key:
        return env_key
    return _read_key_file(_GEOCODER_KEY_FILE)


YANDEX_MAPS_API_KEY = _read_yandex_maps_api_key()
YANDEX_GEOCODER_API_KEY = _read_yandex_geocoder_api_key()
