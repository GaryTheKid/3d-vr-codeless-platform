#!/usr/bin/env python3
"""Coverage-contract audit for Keyi .xrcourse packages (the 'short script').

Checks the as-shipped outline against the knowledge graph:
  covers[] ids ∈ nodes[]
  installsAha[] ids ∈ ahaKeys[]
  every aha installed by ≥1 section
  ≥1 reading + ≥1 quiz
  ahas whose primary installer is interactive (vr/h5)

Note: applyKgAndOutline already drops unknown aha ids and patches orphan ahas,
so aha_ref / aha_installed on saved packages are post-bind (often ~100%).
covers[] is NOT filtered at bind time — dangling covers are the interesting fail.

Usage (from repo root or this folder):
  python audit_coverage_contracts.py
"""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]  # repo root (…/Demo)
SAMPLES = ROOT / "pre-built-samples"


def sections(outline: dict) -> list[dict]:
    out = []
    for ch in (outline or {}).get("chapters") or []:
        out.extend(ch.get("sections") or [])
    return out


def audit(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    cfg = data.get("cfg") or {}
    outline = cfg.get("outline") or {}
    kg = cfg.get("knowledgeGraph") or {}
    nodes = {str(n.get("id")) for n in (kg.get("nodes") or []) if n.get("id")}
    ahas = {str(a.get("id")) for a in (kg.get("ahaKeys") or []) if a.get("id")}
    secs = sections(outline)

    covers = [str(x) for s in secs for x in (s.get("covers") or [])]
    installs = [str(x) for s in secs for x in (s.get("installsAha") or [])]
    installed = {str(x) for s in secs for x in (s.get("installsAha") or [])}

    def rate(ok: int, n: int) -> float | None:
        return round(100.0 * ok / n, 1) if n else None

    # primary installer = first section (outline order) that lists the aha
    primary = {}
    for s in secs:
        for aid in (s.get("installsAha") or []):
            primary.setdefault(str(aid), s.get("type"))

    interactive = sum(1 for aid in ahas if primary.get(aid) in ("vr", "h5"))
    dangling_covers = sorted({c for c in covers if c not in nodes})
    dangling_ahas = sorted({a for a in installs if a not in ahas})
    orphan_ahas = sorted(ahas - installed)

    return {
        "course": path.stem,
        "file": path.name,
        "n_nodes": len(nodes),
        "n_ahas": len(ahas),
        "n_sections": len(secs),
        "n_covers": len(covers),
        "n_installs": len(installs),
        "covers_ok_pct": rate(sum(c in nodes for c in covers), len(covers)),
        "aha_ref_ok_pct": rate(sum(a in ahas for a in installs), len(installs)),
        "aha_installed_pct": rate(sum(a in installed for a in ahas), len(ahas)),
        "sections_with_covers_pct": rate(sum(1 for s in secs if s.get("covers")), len(secs)),
        "interactive_install_pct": rate(interactive, len(ahas)),
        "has_reading_quiz": int(
            any(s.get("type") == "reading" for s in secs)
            and any(s.get("type") == "quiz" for s in secs)
        ),
        "dangling_covers": dangling_covers,
        "dangling_installsAha": dangling_ahas,
        "orphan_ahas": orphan_ahas,
    }


def fmt(v) -> str:
    if v is None:
        return "—"
    if isinstance(v, float):
        return f"{v:.1f}%"
    return str(v)


def main() -> None:
    files = sorted(SAMPLES.glob("*.xrcourse"))
    if not files:
        raise SystemExit(f"No .xrcourse files in {SAMPLES}")

    rows = [audit(p) for p in files]
    cols = [
        ("course", "course"),
        ("n_sec", "n_sections"),
        ("n_aha", "n_ahas"),
        ("covers_in_KG", "covers_ok_pct"),
        ("installs_in_aha", "aha_ref_ok_pct"),
        ("aha installed", "aha_installed_pct"),
        ("sec has covers", "sections_with_covers_pct"),
        ("aha on vr/h5", "interactive_install_pct"),
        ("read+quiz", "has_reading_quiz"),
    ]
    widths = [max(len(h), max(len(fmt(r[k])) for r in rows)) for h, k in cols]
    line = "  ".join(h.ljust(w) for (h, _), w in zip(cols, widths))
    print(line)
    print("-" * len(line))
    for r in rows:
        print("  ".join(fmt(r[k]).ljust(w) for (_, k), w in zip(cols, widths)))

    fails = []
    for r in rows:
        if r["dangling_covers"]:
            fails.append(f"  {r['course']}: dangling covers {r['dangling_covers']}")
        if r["dangling_installsAha"]:
            fails.append(f"  {r['course']}: dangling installsAha {r['dangling_installsAha']}")
        if r["orphan_ahas"]:
            fails.append(f"  {r['course']}: orphan ahas {r['orphan_ahas']}")
        if not r["has_reading_quiz"]:
            fails.append(f"  {r['course']}: missing reading or quiz")
    print()
    if fails:
        print("Failures:")
        print("\n".join(fails))
    else:
        print("Failures: none (as-shipped packages satisfy the structural checks).")
    print(
        "\nPost-bind caveat: unknown installsAha ids are dropped and orphan ahas "
        "are patched at applyKgAndOutline; this audit sees the saved package, not the raw planner JSON."
    )


if __name__ == "__main__":
    main()
