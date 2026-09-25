from __future__ import annotations

import urllib.request
from pathlib import Path


def download(url: str, dest: Path) -> Path:
    """Download `url` to `dest` unless it is already cached."""
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    print(f"Downloading {url}")
    urllib.request.urlretrieve(url, tmp)
    tmp.rename(dest)
    return dest
