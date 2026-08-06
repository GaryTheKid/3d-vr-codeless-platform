#!/usr/bin/env python3
"""
Extract figures from experiment-study PDFs and inject them into the
matching .xrcourse packages so GitHub Pages / sample open shows real images.

Images are saved under pre-built-samples/assets/<course-id>/ and referenced
from the course HTML as sample-asset:<course-id>/<file>. The app rewrites
those tokens to real URLs when a sample is opened (works on both
localhost and GitHub project pages).
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import re
from pathlib import Path

import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parent
MATERIALS = ROOT.parent / "experiment-study" / "learning materials"
ASSETS = ROOT / "assets"

# course-id → (pdf path, xrcourse path)
COURSES = {
    "bio-virus": (
        MATERIALS / "1. Bio-Virus" / "Bio-Virus.pdf",
        ROOT / "Bio-Virus.xrcourse",
    ),
    "chem-vsepr": (
        MATERIALS / "2. Chem-VSEPR" / "Chem-VSEPR Theory.pdf",
        ROOT / "Chem-VSEPR.xrcourse",
    ),
    "geo-terrain": (
        MATERIALS / "3, Geo-Terrain" / "Geo-Terrain.pdf",
        ROOT / "Geo-Terrain.xrcourse",
    ),
    "mecha-gear": (
        MATERIALS / "4, Mecha-Gear" / "Mecha-Gear.pdf",
        ROOT / "Mecha-Gear.xrcourse",
    ),
    "phys-projectile": (
        MATERIALS / "5, Phys-Projectile Motion" / "Phys-Projectile Motion.pdf",
        ROOT / "Phys-Projectile Motion.xrcourse",
    ),
}

MAX_DIM = 1100
MIN_SIDE = 120          # drop logos / spacers
MIN_BYTES = 2500
MAX_JPEG_KB = 280


def pix_to_pil(pix: fitz.Pixmap) -> Image.Image:
    if pix.n - pix.alpha >= 4:  # CMYK
        pix = fitz.Pixmap(fitz.csRGB, pix)
    if pix.alpha:
        pix = fitz.Pixmap(pix, 0)  # drop alpha
    mode = "RGB" if pix.n == 3 else "L"
    return Image.frombytes(mode, (pix.width, pix.height), pix.samples)


def shrink(im: Image.Image) -> Image.Image:
    w, h = im.size
    scale = min(1.0, MAX_DIM / max(w, h))
    if scale < 1.0:
        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    return im


def encode_image(im: Image.Image, stem: str) -> tuple[str, bytes, str]:
    """Return (filename, file_bytes, mime). Prefer JPEG for photos, PNG for diagrams."""
    im = shrink(im)
    # Heuristic: few unique colors → diagram → PNG; else JPEG
    sample = im.copy()
    sample.thumbnail((64, 64))
    colors = len(sample.getcolors(maxcolors=512) or [])
    buf = io.BytesIO()
    if colors and colors < 64 and im.mode in ("RGB", "L"):
        im.save(buf, format="PNG", optimize=True)
        data = buf.getvalue()
        if len(data) <= MAX_JPEG_KB * 1024:
            return f"{stem}.png", data, "image/png"
        buf = io.BytesIO()
    # JPEG path (photos / large diagrams)
    if im.mode != "RGB":
        im = im.convert("RGB")
    quality = 85
    while True:
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=quality, optimize=True)
        data = buf.getvalue()
        if len(data) <= MAX_JPEG_KB * 1024 or quality <= 55:
            return f"{stem}.jpg", data, "image/jpeg"
        quality -= 8


def extract_figures(pdf_path: Path, course_id: str) -> list[dict]:
    """Extract unique pedagogical figures from a PDF."""
    doc = fitz.open(pdf_path)
    out_dir = ASSETS / course_id
    out_dir.mkdir(parents=True, exist_ok=True)
    # wipe previous assets for this course
    for old in out_dir.glob("*"):
        if old.is_file():
            old.unlink()

    seen_hash: set[str] = set()
    seen_xref: set[int] = set()
    figures: list[dict] = []
    idx = 0

    for page_i, page in enumerate(doc):
        for img in page.get_images(full=True):
            xref = img[0]
            if xref in seen_xref:
                continue
            seen_xref.add(xref)
            try:
                pix = fitz.Pixmap(doc, xref)
                im = pix_to_pil(pix)
            except Exception as e:
                print(f"  skip xref={xref}: {e}")
                continue
            w, h = im.size
            if min(w, h) < MIN_SIDE:
                continue
            # Skip ultra-wide thin banners (headers)
            if w > 4 * h and h < 100:
                continue
            raw_png = io.BytesIO()
            im.save(raw_png, format="PNG")
            digest = hashlib.md5(raw_png.getvalue()).hexdigest()
            if digest in seen_hash:
                continue
            # Also skip near-empty / tiny file after encode probe
            if len(raw_png.getvalue()) < MIN_BYTES and min(w, h) < 200:
                continue
            seen_hash.add(digest)
            idx += 1
            stem = f"fig-{idx:02d}-p{page_i + 1}"
            filename, data, mime = encode_image(im, stem)
            (out_dir / filename).write_bytes(data)
            # nearby text for caption / matching
            text = page.get_text("text").strip().replace("\n", " ")
            caption = re.sub(r"\s+", " ", text)[:160]
            figures.append({
                "file": filename,
                "page": page_i + 1,
                "w": w,
                "h": h,
                "bytes": len(data),
                "mime": mime,
                "caption": caption,
                "token": f"sample-asset:{course_id}/{filename}",
            })
            print(f"  + {course_id}/{filename}  page={page_i+1}  {w}x{h} → {len(data)} B")

    return figures


FIGURE_HTML = (
    '<figure class="ws-pedagogy-fig">'
    '<img class="ws-inline-img" src="{src}" alt="{alt}" />'
    '<figcaption>{alt}</figcaption>'
    "</figure>"
)


def esc(s: str) -> str:
    return (
        str(s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def strip_existing_figures(html: str) -> str:
    """Remove previously injected pedagogy figures (keep the prose)."""
    html = re.sub(
        r'<figure\b[^>]*class="[^"]*ws-pedagogy-fig[^"]*"[^>]*>.*?</figure>',
        "",
        html or "",
        flags=re.I | re.S,
    )
    # orphan imgs that look like pedagogy embeds
    html = re.sub(
        r'<img\b[^>]*class="[^"]*ws-inline-img[^"]*"[^>]*/?>',
        "",
        html,
        flags=re.I,
    )
    return html


def inject_after_first_p(html: str, src: str, alt: str) -> str:
    fig = FIGURE_HTML.format(src=src, alt=esc(alt))
    h = strip_existing_figures(html)
    m = re.search(r"</p>", h, flags=re.I)
    if m:
        i = m.end()
        return h[:i] + fig + h[i:]
    return fig + h


def walk_sections(outline: dict):
    for ch in outline.get("chapters") or []:
        for sec in ch.get("sections") or []:
            yield sec


def clear_all_pedagogy_images(data: dict) -> None:
    """Remove every previously injected sample/reading figure before a fresh pass."""
    outline = (data.get("cfg") or {}).get("outline") or {}
    for sec in walk_sections(outline):
        if sec.get("type") == "reading":
            for chunk in (sec.get("reading") or {}).get("chunks") or []:
                chunk["html"] = strip_existing_figures(chunk.get("html") or "")
        if sec.get("type") == "h5" and sec.get("h5"):
            html = sec["h5"].get("html") or ""
            html = strip_existing_figures(html)
            # Also drop sample-asset / pedagogy imgs that aren't wrapped in figure
            html = re.sub(
                r'<img\b[^>]*src=["\']sample-asset:[^"\']+["\'][^>]*/?>',
                "",
                html,
                flags=re.I,
            )
            sec["h5"]["html"] = html


def assign_figures(course_id: str, figures: list[dict], data: dict) -> None:
    """Place figures into reading chunks / H5 by simple page→section heuristics."""
    clear_all_pedagogy_images(data)
    outline = (data.get("cfg") or {}).get("outline") or {}
    readings = [s for s in walk_sections(outline) if s.get("type") == "reading"]
    h5s = [s for s in walk_sections(outline) if s.get("type") == "h5"]

    # Prefer first 2 chunks of each reading + every H5 (avoid flooding every chunk)
    targets: list[tuple[str, dict, int | None]] = []
    for sec in readings:
        chunks = (sec.get("reading") or {}).get("chunks") or []
        for i in range(min(2, len(chunks))):
            targets.append(("reading", sec, i))
        # If a reading has many chunks and we still have figures, allow a 3rd slot
        if len(chunks) >= 4:
            targets.append(("reading", sec, min(3, len(chunks) - 1)))
    for sec in h5s:
        targets.append(("h5", sec, None))

    if not targets or not figures:
        print(f"  ! nothing to inject ({len(figures)} figs, {len(targets)} targets)")
        return

    preferred = COURSE_PREFS.get(course_id, [])
    used_targets: set[tuple] = set()
    used_figs: set[int] = set()

    def target_key(t):
        kind, sec, ci = t
        return (kind, sec.get("id"), ci)

    def find_target(keywords: list[str]):
        keys = [k.lower() for k in keywords]
        for t in targets:
            if target_key(t) in used_targets:
                continue
            kind, sec, ci = t
            hay = (sec.get("title") or "").lower()
            if kind == "reading" and ci is not None:
                chunk = sec["reading"]["chunks"][ci]
                hay += " " + (chunk.get("title") or "").lower()
            if any(k in hay for k in keys):
                return t
        for t in targets:
            if target_key(t) not in used_targets:
                return t
        return None

    for pref in preferred:
        fi = pref["fig"]
        if fi >= len(figures):
            continue
        t = find_target(pref.get("match") or [])
        if not t:
            continue
        place_figure(t, figures[fi], pref.get("alt") or figures[fi]["caption"])
        used_targets.add(target_key(t))
        used_figs.add(fi)

    # Reuse the sole Bio figure on every reading target
    if course_id == "bio-virus" and figures:
        for t in targets:
            if target_key(t) in used_targets:
                continue
            if t[0] != "reading":
                continue
            place_figure(t, figures[0], "Virus structure overview from the source PDF")
            used_targets.add(target_key(t))

    fi = 0
    for t in targets:
        if target_key(t) in used_targets:
            continue
        while fi < len(figures) and fi in used_figs:
            fi += 1
        if fi >= len(figures):
            break
        place_figure(t, figures[fi], figures[fi]["caption"])
        used_targets.add(target_key(t))
        used_figs.add(fi)
        fi += 1

    print(f"  injected into {len(used_targets)} slot(s) using {len(used_figs) or (1 if course_id == 'bio-virus' else 0)} unique figure(s)")


def place_figure(target, fig: dict, alt: str) -> None:
    kind, sec, ci = target
    src = fig["token"]
    alt = (alt or fig["caption"] or fig["file"])[:180]
    if kind == "reading":
        chunk = sec["reading"]["chunks"][ci]
        chunk["html"] = inject_after_first_p(chunk.get("html") or "", src, alt)
    else:
        h5 = sec.setdefault("h5", {"prompt": "", "html": "", "status": "ready", "followUp": None})
        html = h5.get("html") or ""
        # If H5 already has an <img>, replace its src; else prepend a figure block
        if re.search(r"<img\b", html, re.I):
            html = re.sub(
                r'(<img\b[^>]*?\bsrc=["\'])([^"\']*)(["\'])',
                rf"\g<1>{src}\3",
                html,
                count=1,
                flags=re.I,
            )
            # ensure class for styling if missing
            if "ws-inline-img" not in html:
                html = re.sub(r"<img\b", '<img class="ws-inline-img"', html, count=1, flags=re.I)
        else:
            fig_html = (
                f'<div class="ws-pedagogy-fig" style="margin:8px 0">'
                f'<img class="ws-inline-img" src="{src}" alt="{esc(alt)}" '
                f'style="max-width:100%;border-radius:8px;border:1px solid #ddd" />'
                f'<div style="font-size:12px;color:#666;margin-top:4px">{esc(alt)}</div></div>'
            )
            # insert after first heading or at top
            m = re.search(r"</h[1-3]>", html, re.I)
            if m:
                html = html[: m.end()] + fig_html + html[m.end() :]
            else:
                html = fig_html + html
        h5["html"] = html
        h5["status"] = h5.get("status") or "ready"


# Manual highlights so key textbook figures land on the right section
COURSE_PREFS = {
    "bio-virus": [
        {"fig": 0, "match": ["meet the virion", "virion"], "alt": "Virus structure overview from the source PDF"},
    ],
    "chem-vsepr": [
        {"fig": 0, "match": ["language of vsepr", "terms"], "alt": "VSEPR molecular geometry diagram"},
        {"fig": 2, "match": ["full geometry", "geometry table"], "alt": "VSEPR geometry catalog table"},
        {"fig": 3, "match": ["worked example", "co2"], "alt": "Example molecular shapes"},
        {"fig": 4, "match": ["worked example", "co2"], "alt": "Lone-pair geometry shapes"},
        {"fig": 5, "match": ["worked example", "co2"], "alt": "More VSEPR molecular shapes"},
    ],
    "geo-terrain": [
        {"fig": 0, "match": ["welcome to zion"], "alt": "Zion canyon landscape"},
        {"fig": 1, "match": ["welcome to zion"], "alt": "Weathering and erosion at Zion"},
        {"fig": 2, "match": ["virgin river"], "alt": "The Virgin River shaping the canyon"},
        {"fig": 3, "match": ["virgin river"], "alt": "Sediment and river work"},
        {"fig": 4, "match": ["did it move", "weathering-vs-erosion"], "alt": "Weathering vs erosion comparison"},
    ],
    "mecha-gear": [
        {"fig": 0, "match": ["what is a gear"], "alt": "Meshing gears"},
        {"fig": 1, "match": ["what is a gear"], "alt": "Gear train example"},
        {"fig": 2, "match": ["ratio rule"], "alt": "Compound gear train"},
    ],
    "phys-projectile": [
        {"fig": 0, "match": ["straight lines", "curved flight"], "alt": "Projectile trajectory diagram"},
        {"fig": 1, "match": ["rollerblader"], "alt": "Rollerblader ball toss sequence"},
        {"fig": 2, "match": ["splitting the launch"], "alt": "Launch velocity components"},
        {"fig": 3, "match": ["shot from a cannon", "cannon"], "alt": "Cannon projectile example"},
    ],
}


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    for course_id, (pdf, course_path) in COURSES.items():
        print(f"\n=== {course_id} ===")
        if not pdf.exists():
            print(f"  missing PDF: {pdf}")
            continue
        if not course_path.exists():
            print(f"  missing course: {course_path}")
            continue
        figures = extract_figures(pdf, course_id)
        data = json.loads(course_path.read_text(encoding="utf-8"))
        # Drop any leftover localhost /uploads refs just in case
        raw = json.dumps(data)
        if "/uploads/" in raw or "localhost:" in raw:
            print("  warning: course still contains local upload URLs")
        assign_figures(course_id, figures, data)
        course_path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"  wrote {course_path.name} ({course_path.stat().st_size} bytes)")

    # small manifest of assets for humans
    catalog = {}
    for course_id in COURSES:
        d = ASSETS / course_id
        if d.exists():
            catalog[course_id] = sorted(p.name for p in d.iterdir() if p.is_file())
    (ASSETS / "README.md").write_text(
        "# Sample course figures\n\n"
        "Extracted from `experiment-study/learning materials/*.pdf` by "
        "`embed_pdf_images.py`.\n\n"
        "Referenced from `.xrcourse` HTML as `sample-asset:<course-id>/<file>`; "
        "the app rewrites these to real URLs when a sample is opened.\n\n"
        + "\n".join(f"- **{k}**: {', '.join(v)}" for k, v in catalog.items())
        + "\n",
        encoding="utf-8",
    )
    print("\nDone.")


if __name__ == "__main__":
    main()
