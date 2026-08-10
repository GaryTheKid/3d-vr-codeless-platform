#!/usr/bin/env python3
"""Full N=6 scoring: MCQ keys + rubric-guided SA + questionnaires."""
from __future__ import annotations

import json
import re
from pathlib import Path

try:
    import fitz  # pymupdf
except ImportError:
    fitz = None

ROOT = Path(r"E:\创业\XR+AI\Demo\experiment-study")
DATA = ROOT / "Data"
MAT = ROOT / "learning materials"
OUT = Path(r"E:\创业\XR+AI\Demo\final-delivery\_analysis_raw.json")

KEYS = {
    "virus": list("BBBBBBBABADCABB"),
    "vsepr": list("ABDBBAABDBBCBBB"),
    "terrain": list("BABABBBAABAABAA"),
    "gears": list("BBBBBBBBBACABCA"),
    "projectile": list("BACBACBCBCBABBA"),
}

# Authoritative pack from questionnaire / known assignment
PARTICIPANTS = {
    "P1-Kai": {
        "pack": "vsepr",
        "pre": "Kai_quiz-pre-test.txt",
        "post": "Kai-quiz-post-test.txt",
        "quest": "Kai_experience-questionnaire.txt",
        "interview": "Kai_semi-interview-transcription.vtt",
        "interview_kind": "vtt",
        "interview_start_hint": "one sentence",
    },
    "P2-Shiv": {
        "pack": "gears",
        "pre": "Shiv-quiz-pre-test.txt",
        "post": "Shiv-quiz-post-test.txt",
        "quest": "Shiv-experience-questionnaire.txt",
        "interview": "Shiv-feedback-interview-transcription.vtt",
        "interview_kind": "vtt",
        "interview_start_hint": "helped you learn|one sentence|what does this tool",
    },
    "P3-Charan": {
        "pack": "projectile",
        "pre": "Charan-pre-quiz-test.txt",
        "post": "Charan-quiz-post-test.txt",
        "quest": "Charan-experience-questionnaire.txt",
        "interview": "Charan-feedback-interview-transcription.vtt",
        "interview_kind": "vtt",
        "interview_start_hint": "one sentence",
    },
    "P4-Kirtan": {
        "pack": "virus",
        "pre": "Kirtan_quiz_pre_test.pdf",
        "post": "Kirtan-quiz-post-test.txt",
        "quest": "Kirtan_Questionnaire.txt",
        "interview": "Kirtan_interview_feedback_transcription.vtt",
        "interview_kind": "vtt",
        "interview_start_hint": "one sentence",
    },
    "P5-CC": {
        "pack": "terrain",
        "pre": "CC-quiz-pre-test.txt",
        "post": "CC-quiz-post.txt",
        "quest": "CC-experience-questionnaire.txt",
        "interview": "CC-semi-interview-keynotes.txt",
        "interview_kind": "keynotes",
    },
    "P6-BZ": {
        "pack": "projectile",
        "pre": "BZ-quiz-pre-test.txt",
        "post": "BZ-quiz-post-test.txt",
        "quest": "BZ_experience-questionnaire.txt",
        "interview": "BZ-semi-interview-keynotes.txt",
        "interview_kind": "keynotes",
    },
}

PACK_LABEL = {
    "virus": "1 Bio-Virus",
    "vsepr": "2 Chem-VSEPR",
    "terrain": "3 Geo-Terrain",
    "gears": "4 Mecha-Gear",
    "projectile": "5 Phys-Projectile",
}

RUBRIC_FILE = {
    "virus": MAT / "1. Bio-Virus" / "virus_grading_rubric.html",
    "vsepr": MAT / "2. Chem-VSEPR" / "vsepr_grading_rubric.html",
    "terrain": MAT / "3, Geo-Terrain" / "terrain_grading_rubric.html",
    "gears": MAT / "4, Mecha-Gear" / "gears_grading_rubric.html",
    "projectile": MAT / "5, Phys-Projectile Motion" / "projectile_grading_rubric.html",
}


def load_text(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        if not fitz:
            return ""
        doc = fitz.open(path)
        parts = [page.get_text() for page in doc]
        doc.close()
        return "\n".join(parts)
    return path.read_text(encoding="utf-8", errors="replace")


def parse_mcq(text: str) -> dict[int, str]:
    part = re.split(r"PART\s*II", text, maxsplit=1, flags=re.I)[0]
    answers = {}
    # Numbered blocks
    for m in re.finditer(
        r"(?:^|\n)\s*(\d{1,2})\.\s+.{0,500}?Student answer:\s*(\[blank\]|[A-Da-d])?",
        part,
        re.I | re.S,
    ):
        n = int(m.group(1))
        raw = (m.group(2) or "").strip().upper()
        answers[n] = "" if (not raw or raw.startswith("[")) else raw[0]
    if len(answers) >= 10:
        return answers
    # sequential fallback
    answers = {}
    i = 0
    for m in re.finditer(r"Student answer:\s*(\[blank\]|[A-Da-d])?", part, re.I):
        i += 1
        if i > 15:
            break
        raw = (m.group(1) or "").strip().upper()
        answers[i] = "" if (not raw or raw.startswith("[")) else raw[0]
    return answers


def parse_mcq_pdf_letters(text: str) -> dict[int, str]:
    """PDF printouts may use 'A)' selected differently — try common patterns."""
    answers = parse_mcq(text)
    if sum(1 for v in answers.values() if v) >= 3:
        return answers
    # Look for "Answer: B" or filled bubbles as "● B" / "[X] B"
    found = {}
    for m in re.finditer(r"(?:^|\n)\s*(\d{1,2})[\).]\s*.{0,300}", text, re.S):
        n = int(m.group(1))
        chunk = m.group(0)
        sel = re.search(r"(?:Answer|Selected|Choice)\s*[:=]\s*([A-D])", chunk, re.I)
        if sel:
            found[n] = sel.group(1).upper()
            continue
        # markdown-style checked
        sel = re.search(r"[\u25CF\u25A0●■]\s*([A-D])\b", chunk)
        if sel:
            found[n] = sel.group(1).upper()
    return found or answers


def parse_short(text: str) -> list[str]:
    parts = re.split(r"PART\s*II", text, maxsplit=1, flags=re.I)
    part = parts[1] if len(parts) > 1 else text
    answers = []
    for m in re.finditer(
        r"Short Answer\s*(\d+)\.\s*(.*?)\nStudent answer:\s*(.*?)(?=\nShort Answer|\n\d+\.\s|\Z)",
        part,
        re.I | re.S,
    ):
        ans = m.group(3).strip()
        answers.append("" if ans.lower() in ("[blank]", "") else ans)
    if len(answers) >= 3:
        return answers
    # PDF / alternate: "Short Answer N" then free text until next
    answers = []
    for m in re.finditer(
        r"Short Answer\s*(\d+)[\.:)]\s*(.*?)(?=Short Answer\s*\d+|\Z)",
        part,
        re.I | re.S,
    ):
        block = m.group(2).strip()
        # drop the question line
        lines = [ln for ln in block.splitlines() if ln.strip()]
        # heuristic: answer is after question
        ans = "\n".join(lines[1:]).strip() if len(lines) > 1 else ""
        if "Student answer:" in block:
            ans = block.split("Student answer:")[-1].strip()
        answers.append("" if ans.lower() in ("[blank]", "") else ans)
    return answers


def load_sa_points(pack: str) -> list[list[str]]:
    html = RUBRIC_FILE[pack].read_text(encoding="utf-8", errors="replace")
    points = []
    for block in re.finditer(
        r"Expected content points:</strong></p><ul>(.*?)</ul>", html, re.S
    ):
        items = re.findall(r"<li>(.*?)</li>", block.group(1), re.S)
        points.append([re.sub(r"<[^>]+>", "", x).strip() for x in items])
    return points


def score_sa(answer: str, points: list[str]) -> tuple[int, str]:
    """Analytic 0-3 against expected content points; return (score, rationale)."""
    if not answer or not answer.strip():
        return 0, "blank"
    a = answer.lower()
    hits = []
    for p in points:
        kws = [
            w
            for w in re.findall(r"[a-zA-Z]{4,}", p.lower())
            if w
            not in {
                "that", "this", "with", "from", "have", "they", "their", "which",
                "into", "also", "made", "using", "must", "other", "than", "when",
                "such", "only", "more", "each", "both", "does", "about", "after",
                "because", "between", "through", "under", "over", "where", "what",
                "will", "been", "were", "then", "than", "your", "into",
            }
        ]
        if not kws:
            continue
        matches = sum(1 for k in kws if k in a)
        ratio = matches / max(len(kws), 1)
        ok = matches >= 2 or ratio >= 0.35
        # synonym soft matches for common science terms
        if not ok:
            soft = {
                "capsid": ["protein coat", "coat"],
                "envelope": ["membrane", "lipid"],
                "host": ["host cell", "hijack"],
                "horizontal": ["x-direction", "x direction", "constant"],
                "vertical": ["y-direction", "y direction", "gravity"],
                "weathering": ["break down", "breakdown", "decay"],
                "erosion": ["transport", "carry away", "move sediment"],
                "torque": ["twisting", "moment"],
                "ratio": ["teeth", "gear ratio"],
            }
            for k in kws:
                for syn in soft.get(k, []):
                    if syn in a:
                        ok = True
                        break
        if ok:
            hits.append(p[:60])
    n = len(hits)
    if n >= 3:
        return 3, f"complete (~{n} points): " + "; ".join(hits[:3])
    if n == 2:
        return 2, "partial: " + "; ".join(hits)
    if n == 1:
        return 1, "minimal: " + hits[0]
    if len(a.split()) >= 12:
        return 1, "on-topic length but weak keyword match — minimal"
    return 0, "no credit / off-topic"


def score_mcq(answers: dict[int, str], key: list[str]):
    detail = []
    score = 0
    for i, correct in enumerate(key, 1):
        got = answers.get(i, "")
        ok = got == correct
        if ok:
            score += 1
        detail.append({"q": i, "got": got or "[blank]", "key": correct, "ok": ok})
    return score, detail


def parse_quest(text: str) -> dict:
    out = {}
    for line in text.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            out[k.strip()] = v.strip()
    return out


def extract_interview(path: Path, kind: str, hint: str | None) -> dict:
    text = path.read_text(encoding="utf-8", errors="replace")
    if kind == "keynotes":
        return {"kind": "keynotes", "start_line": 1, "text": text}
    # VTT: find start
    start_line = 1
    start_idx = 0
    if hint:
        for pat in hint.split("|"):
            m = re.search(pat, text, re.I)
            if m:
                start_idx = m.start()
                start_line = text[:start_idx].count("\n") + 1
                break
    # Also try common RA question phrases; take the earliest late-in-file marker
    markers = list(
        re.finditer(
            r"(what does this tool do|in one sentence|semi-structured|interview time|now (?:we|i)(?:'ll| will) ask)",
            text,
            re.I,
        )
    )
    if markers:
        # prefer last cluster start if early markers are false positives during learning
        # use first marker after 40% of file if any; else first
        thresh = int(len(text) * 0.35)
        late = [m for m in markers if m.start() >= thresh]
        pick = late[0] if late else markers[0]
        # if hint found something later, keep later
        if pick.start() >= start_idx:
            start_idx = pick.start()
            start_line = text[:start_idx].count("\n") + 1

    # slice from ~30s before marker (a bit of context) — here just from marker line
    lines = text.splitlines()
    # back up a few cue lines
    start_line = max(1, start_line - 6)
    slice_text = "\n".join(lines[start_line - 1 :])
    # strip timestamps for readability in quotes
    spoken = []
    for ln in slice_text.splitlines():
        if re.match(r"\d{2}:\d{2}:\d{2}", ln):
            continue
        if ln.strip() in ("WEBVTT", "") or ln.startswith("NOTE"):
            continue
        if re.match(r"^\d+$", ln.strip()):
            continue
        spoken.append(ln.strip())
    return {
        "kind": "vtt",
        "start_line": start_line,
        "text": "\n".join(spoken[:400]),
        "raw_len": len(text),
    }


def grade_phase(path: Path, pack: str) -> dict:
    text = load_text(path)
    is_pdf = path.suffix.lower() == ".pdf"
    answers = parse_mcq_pdf_letters(text) if is_pdf else parse_mcq(text)
    shorts = parse_short(text)
    mcq_score, detail = score_mcq(answers, KEYS[pack])
    points = load_sa_points(pack)
    sa_detail = []
    for i in range(5):
        ans = shorts[i] if i < len(shorts) else ""
        pts = points[i] if i < len(points) else []
        sc, why = score_sa(ans, pts)
        sa_detail.append({"q": i + 1, "score": sc, "why": why, "answer": ans[:300]})
    sa_total = sum(x["score"] for x in sa_detail)
    blank = all(not answers.get(i) for i in range(1, 16)) and all(
        not (shorts[i] if i < len(shorts) else "") for i in range(5)
    )
    return {
        "file": path.name,
        "is_pdf": is_pdf,
        "mcq": mcq_score,
        "mcq_detail": detail,
        "sa": sa_total,
        "sa_detail": sa_detail,
        "total": mcq_score + sa_total,
        "answered_mcq_n": sum(1 for i in range(1, 16) if answers.get(i)),
        "blank": blank,
        "text_preview": text[:200].replace("\n", " | "),
    }


def main():
    results = []
    for pid, meta in PARTICIPANTS.items():
        folder = DATA / pid
        pack = meta["pack"]
        entry = {
            "id": pid,
            "pack": pack,
            "pack_label": PACK_LABEL[pack],
        }
        for phase in ("pre", "post"):
            p = folder / meta[phase]
            entry[phase] = grade_phase(p, pack) if p.exists() else {"missing": True}
        qpath = folder / meta["quest"]
        entry["questionnaire"] = parse_quest(load_text(qpath)) if qpath.exists() else {}
        ipath = folder / meta["interview"]
        entry["interview"] = extract_interview(
            ipath, meta["interview_kind"], meta.get("interview_start_hint")
        )
        # gains
        if "total" in entry["pre"] and "total" in entry["post"]:
            entry["gain"] = {
                "mcq": entry["post"]["mcq"] - entry["pre"]["mcq"],
                "sa": entry["post"]["sa"] - entry["pre"]["sa"],
                "total": entry["post"]["total"] - entry["pre"]["total"],
            }
        results.append(entry)

    OUT.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    # summary print
    for r in results:
        print(
            f"{r['id']:12} {r['pack_label']:18} "
            f"pre={r['pre'].get('mcq')}/{r['pre'].get('sa')}/{r['pre'].get('total')} "
            f"post={r['post'].get('mcq')}/{r['post'].get('sa')}/{r['post'].get('total')} "
            f"gain={r.get('gain',{}).get('total')} "
            f"blank_pre={r['pre'].get('blank')} pdf_pre={r['pre'].get('is_pdf')} "
            f"iv={r['interview']['kind']}@{r['interview'].get('start_line')}"
        )


if __name__ == "__main__":
    main()
