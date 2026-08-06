#!/usr/bin/env python3
"""Remove zombie userData.panelData from .xrcourse snapshots.

Older saves JSON-serialized panelData as `{canvas:{}, tex:{…}}`. On load the
app used to treat that as "already hydrated" and skip redraw — after a section
switch (which strips panel materials) those panels became white squares.
"""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).parent


def scrub_node(node: dict) -> int:
    n = 0
    ud = node.get("userData")
    if isinstance(ud, dict) and "panelData" in ud:
        del ud["panelData"]
        n += 1
        # Prefer panelSpec rebuild — drop baked material so files stay smaller
        if ud.get("panelSpec") and "material" in node:
            del node["material"]
            n += 1
    for child in node.get("children") or []:
        n += scrub_node(child)
    return n


def prune_refs(scene: dict) -> None:
    """Drop materials/textures/images no longer referenced after material strip."""
    used_mat: set[str] = set()
    used_geo: set[str] = set()

    def walk(node):
        if node.get("material"):
            m = node["material"]
            if isinstance(m, list):
                used_mat.update(m)
            else:
                used_mat.add(m)
        if node.get("geometry"):
            used_geo.add(node["geometry"])
        for c in node.get("children") or []:
            walk(c)

    if not scene.get("object"):
        return
    walk(scene["object"])
    if scene.get("geometries"):
        scene["geometries"] = [g for g in scene["geometries"] if g.get("uuid") in used_geo]
    mats = [m for m in (scene.get("materials") or []) if m.get("uuid") in used_mat]
    scene["materials"] = mats
    used_tex: set[str] = set()
    for m in mats:
        for v in m.values():
            if isinstance(v, str):
                used_tex.add(v)
    if scene.get("textures"):
        scene["textures"] = [t for t in scene["textures"] if t.get("uuid") in used_tex]
        used_img = {t.get("image") for t in scene["textures"] if t.get("image")}
        if scene.get("images"):
            scene["images"] = [i for i in scene["images"] if i.get("uuid") in used_img]


def main() -> None:
    for path in sorted(HERE.glob("*.xrcourse")):
        data = json.loads(path.read_text(encoding="utf-8"))
        total = 0
        outline = (data.get("cfg") or {}).get("outline") or {}
        for ch in outline.get("chapters") or []:
            for sec in ch.get("sections") or []:
                scene = (sec.get("vr") or {}).get("scene")
                if not scene:
                    continue
                total += scrub_node(scene.get("object") or {})
                prune_refs(scene)
        if data.get("scene"):
            total += scrub_node(data["scene"].get("object") or {})
            prune_refs(data["scene"])
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{path.name}: scrubbed {total} panelData/material entries → {path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
