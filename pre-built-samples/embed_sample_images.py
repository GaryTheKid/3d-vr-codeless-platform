#!/usr/bin/env python3
"""Embed local /uploads/… image refs inside .xrcourse packages as data URIs.

GitHub Pages cannot serve the gitignored uploads/ folder (or localhost).
After a sample is exported with Docling image URLs, run this script so the
package is self-contained for static hosting.

Usage (from repo root):
  python pre-built-samples/embed_sample_images.py
"""
from __future__ import annotations

import base64
import mimetypes
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = Path(__file__).resolve().parent
UPLOADS = ROOT / "uploads"

# Match /uploads/... and http://localhost:PORT/uploads/...
URL_RE = re.compile(
    r"(?:https?://localhost:\d+)?(/uploads/[^\"'\\)\s]+)",
    re.IGNORECASE,
)


def file_to_data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def rewrite_text(text: str) -> tuple[str, list[str], list[str]]:
    """Return (new_text, embedded_paths, missing_paths)."""
    embedded: list[str] = []
    missing: list[str] = []
    cache: dict[str, str] = {}

    def repl(m: re.Match) -> str:
        rel = m.group(1).split("?")[0]
        # Normalize
        rel_norm = rel.lstrip("/")
        if rel in cache:
            return cache[rel]
        disk = ROOT / rel_norm
        if not disk.is_file():
            missing.append(rel)
            return m.group(0)
        uri = file_to_data_uri(disk)
        cache[rel] = uri
        embedded.append(rel)
        return uri

    # Replace full localhost URLs and bare /uploads paths
    new = URL_RE.sub(repl, text)
    return new, embedded, missing


def main() -> int:
    courses = sorted(SAMPLES.glob("*.xrcourse"))
    if not courses:
        print("No .xrcourse files found", file=sys.stderr)
        return 1
    if not UPLOADS.is_dir():
        print(f"WARN: {UPLOADS} missing — cannot resolve image files", file=sys.stderr)

    any_missing = False
    for path in courses:
        raw = path.read_text(encoding="utf-8")
        if "/uploads/" not in raw and "localhost" not in raw:
            print(f"OK  {path.name}: no upload/localhost refs")
            continue
        new, embedded, missing = rewrite_text(raw)
        if missing:
            any_missing = True
            print(f"MISS {path.name}: {len(missing)} unresolved")
            for m in sorted(set(missing)):
                print(f"     {m}")
        if embedded:
            path.write_text(new, encoding="utf-8")
            before = len(raw)
            after = len(new)
            print(
                f"FIX {path.name}: embedded {len(set(embedded))} file(s), "
                f"{before/1e6:.2f}MB → {after/1e6:.2f}MB"
            )
            for e in sorted(set(embedded)):
                print(f"     {e}")
        elif not missing:
            print(f"OK  {path.name}: nothing to embed")
    return 1 if any_missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
