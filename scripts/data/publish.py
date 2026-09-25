"""Versioned output folders, so browsers and CloudFront can cache data forever.

    public/data/<source>/manifest.json   small, never cached; names the current folder
    public/data/<source>/<version>/...   data files; <version> is a hash of their contents

New data gets a new folder name, so a cached file is never stale.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path
from typing import Callable


def publish(source_dir: Path, write: Callable[[Path], dict]) -> Path:
    """Run `write(folder)` to produce the data files and return the manifest,
    then move them into their versioned folder and write the manifest with
    `dataDir` pointing there. Older versions are removed."""
    source_dir.mkdir(parents=True, exist_ok=True)
    staging = source_dir / ".staging"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir()

    manifest = write(staging)
    version = content_hash(staging)
    target = source_dir / version
    if target.exists():
        shutil.rmtree(staging)  # identical data is already published
    else:
        staging.rename(target)

    for entry in source_dir.iterdir():
        if entry.name in (version, "manifest.json"):
            continue
        if entry.is_dir():
            shutil.rmtree(entry)
        else:
            entry.unlink()

    (source_dir / "manifest.json").write_text(json.dumps({**manifest, "dataDir": version}, indent=2) + "\n")
    return target


def content_hash(folder: Path) -> str:
    h = hashlib.sha256()
    for path in sorted(p for p in folder.rglob("*") if p.is_file()):
        h.update(path.relative_to(folder).as_posix().encode())
        h.update(b"\0")
        h.update(path.read_bytes())
    return h.hexdigest()[:10]
