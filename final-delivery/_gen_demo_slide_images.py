# -*- coding: utf-8 -*-
"""Regenerate demo-talk-slides art in vivid YouTube cartoon style (gpt-image-2)."""
from __future__ import annotations

import base64
import json
import re
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(r"E:\创业\XR+AI\Demo")
KEYS = ROOT / "xr-edu-agent" / "api-keys.txt"
OUT = ROOT / "final-delivery" / "demo-slide-assets"
OUT.mkdir(parents=True, exist_ok=True)

MODEL = "gpt-image-2"
FALLBACKS = ["gpt-image-1"]
FORCE = True  # overwrite previous soft editorial art

# Match the user's YouTuber thumbnail style reference
STYLE = (
    "EXACT STYLE: live vivid cartoon YouTube educational thumbnail illustration — "
    "2D digital vector look, thick clean black outlines, bold cel-shading, flat saturated color blocks, "
    "simplified expressive cartoon characters with large heads and big eyes, sticker-pop vibe, "
    "high contrast against a solid dark charcoal / near-black background, thin bright cyan-blue frame border optional, "
    "energetic humorous infographic aesthetic, NO photorealism, NO 3D render, NO soft cinematic lighting, "
    "NO grainy editorial concept art, NO text, NO letters, NO watermarks, NO logos, NO UI chrome text."
)

JOBS = [
    {
        "id": "p02_what_we_built",
        "size": "1536x1024",
        "prompt": STYLE + " "
        "Widescreen scene: a cute cartoon student holds a PDF paper on the left; "
        "magic arrows shoot right into four playful modules — open book, touch-screen interactive toy, "
        "tiny 3D molecule toy, and a quiz clipboard with a big checkmark. Bright cyan/yellow accents. "
        "Theme: document becomes a fun multimodal learning experience.",
    },
    {
        "id": "p03_pretty_empty",
        "size": "1536x1024",
        "prompt": STYLE + " "
        "Widescreen scene: a shiny cartoon AI slide deck facade with sparkles and fake applause, "
        "but a small confused student peeks behind it into a totally empty dark hole. "
        "Comedy thumbnail vibe. Theme: pretty course that teaches nothing.",
    },
    {
        "id": "p04_fail_learning",
        "size": "1024x1024",
        "prompt": STYLE + " "
        "Square thumbnail: cartoon student high-fives a cute robot helper while finishing homework, "
        "then stares blankly at an empty exam paper. Exaggerated expressions. Theme: AI task help ≠ real learning.",
    },
    {
        "id": "p04_fail_modality",
        "size": "1024x1024",
        "prompt": STYLE + " "
        "Square thumbnail: giant flashy cartoon VR headset / 3D fireworks towering over a tiny sticky note "
        "with a simple math idea. Mismatched scale gag. Theme: cool modality for the wrong concept.",
    },
    {
        "id": "p04_fail_coverage",
        "size": "1024x1024",
        "prompt": STYLE + " "
        "Square thumbnail: cartoon knowledge-graph balloons connected by broken dashed strings, "
        "orphan quiz bubbles floating away, a worried teacher pointing at gaps. Theme: no checkable coverage.",
    },
    {
        "id": "p04_fail_guidance",
        "size": "1024x1024",
        "prompt": STYLE + " "
        "Square thumbnail: cartoon student lost in a maze of floating content cards, "
        "no map, spinning question marks. Theme: unguided wandering.",
    },
    {
        "id": "p06_pedagogy_first",
        "size": "1536x1024",
        "prompt": STYLE + " "
        "Widescreen scene: a cartoon blacksmith-teacher forges a glowing insight KEY first, "
        "then locks it into a colorful knowledge-graph puzzle, then opens neat lesson boxes "
        "(book, interactive, 3D toy, quiz). Theme: pedagogy first, content second. Cheerful and clear.",
    },
    {
        "id": "p10_summary_keys",
        "size": "1536x1024",
        "prompt": STYLE + " "
        "Widescreen celebratory scene: cartoon student proudly holds a glowing insight key, "
        "sparkles around a tidy stack of multimodal lesson cards. Big smile. Theme: install insight keys, not dump slides.",
    },
]


def load_openai_key() -> str:
    text = KEYS.read_text(encoding="utf-8", errors="ignore")
    m = re.search(r"^\s*OPENAI_API_KEY\s*=\s*(\S+)", text, re.M | re.I)
    if m:
        return m.group(1).strip()
    m = re.search(r"^\s*GPT_API_KEY\s*=\s*(\S+)", text, re.M | re.I)
    if m:
        return m.group(1).strip()
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if re.match(r"^\s*GPT\s*API\s*:", line, re.I):
            rest = line.split(":", 1)[1].strip()
            if rest.startswith("sk-"):
                return rest
            for j in range(i + 1, min(i + 5, len(lines))):
                s = lines[j].strip()
                if s.startswith("sk-"):
                    return s
    for line in lines:
        s = line.strip()
        if s.startswith("sk-proj-") or (s.startswith("sk-") and not s.startswith("sk-ant")):
            return s
    raise SystemExit("No OpenAI/GPT image key found in api-keys.txt")


def _post(key: str, payload: dict) -> dict:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=body,
        method="POST",
        headers={
            "content-type": "application/json",
            "authorization": f"Bearer {key}",
            "accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code}: {err[:800]}") from e


def generate(key: str, prompt: str, size: str, model: str) -> bytes:
    base = {
        "model": model,
        "prompt": prompt[:3200],
        "n": 1,
        "size": size,
    }
    attempts = [{**base, "output_format": "png", "quality": "high"}, dict(base)]
    last = None
    data = None
    for payload in attempts:
        try:
            data = _post(key, payload)
            break
        except Exception as e:
            last = e
            if "unknown_parameter" in str(e).lower() or "unknown parameter" in str(e).lower():
                continue
            raise
    if data is None:
        raise RuntimeError(str(last))

    item = (data.get("data") or [None])[0]
    if not item:
        raise RuntimeError(f"empty data: {str(data)[:400]}")
    if item.get("b64_json"):
        return base64.b64decode(item["b64_json"])
    if item.get("url"):
        with urllib.request.urlopen(item["url"], timeout=120) as img:
            return img.read()
    raise RuntimeError(f"no b64_json or url: keys={list(item.keys())}")


def try_generate(key: str, job: dict) -> Path:
    out = OUT / f"{job['id']}.png"
    if out.exists() and not FORCE and out.stat().st_size > 10_000:
        print(f"skip existing {out.name}")
        return out
    sizes = [job["size"]]
    if job["size"] != "1024x1024":
        sizes += ["1024x1024"]
    last = None
    for model in [MODEL, *FALLBACKS]:
        for size in sizes:
            try:
                print(f"  try {job['id']} model={model} size={size} …")
                png = generate(key, job["prompt"], size, model)
                out.write_bytes(png)
                print(f"  OK {out.name} ({len(png)} bytes)")
                return out
            except Exception as e:
                last = e
                print(f"  fail: {e}")
                msg = str(e).lower()
                if "model" in msg and ("not" in msg or "exist" in msg or "access" in msg):
                    break
                continue
    raise RuntimeError(f"{job['id']} failed: {last}")


def main():
    key = load_openai_key()
    print("key prefix:", key[:12] + "…", "FORCE", FORCE)
    for job in JOBS:
        print("==", job["id"])
        try_generate(key, job)
    print("done →", OUT)


if __name__ == "__main__":
    main()
