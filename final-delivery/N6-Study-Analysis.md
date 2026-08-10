# XR EduAgent Usability Study — Full Analysis (N = 6)

> **Purpose.** Detailed analysis of learning gain, experience questionnaire (incl. NASA-TLX), and semi-structured interview evidence for later use in the ACM-style course report / presentation.  
> **Data root.** `experiment-study/Data/` (P1–P6).  
> **Rubrics.** `experiment-study/learning materials/<pack>/*_grading_rubric.html`.  
> **Protocol.** `experiment-study/RA-run-sheet.md`.  
> **Machine-readable scores.** `_analysis_raw.json` (auto MCQ + draft SA); **short-answer totals below include manual rubric adjudication** where the keyword heuristic under-scored clear answers.  
> **Scope note.** Folders `P7-DA` / `P8-ZDE` contain duplicated Kai-named files and are **excluded**. P6 also contains stray `Kai_*` copies; analysis uses `BZ-*` / `BZ_*` only.

---

## 1. Method snapshot

| Item | Detail |
|------|--------|
| Design | Single-condition remote tryout (Zoom), pre → learn sample course → post → questionnaire → interview |
| N | **6** (target met) |
| System | [GitHub Pages demo](https://garythekid.github.io/3d-vr-codeless-platform/) — **pre-built sample courses** (not live PDF upload) |
| Pre/post | Same pack quiz: 15 MCQ (1 pt) + 5 SA (0–3 pts) = **/30** |
| Questionnaire | Demographics + NASA-TLX (6×0–100) + 11 Likert (1–7) + open best/worst |
| Interview | RA outline Q1–Q8; P1–P4 full VTT (interview segment extracted); **P5–P6 keynotes only** |

### 1.1 Pack assignment

| ID | Name | Pack | Sample course | Quiz |
|----|------|------|---------------|------|
| P1 | Kai | **2 Chem-VSEPR** | VSEPR Theory… | `vsepr_quiz.html` |
| P2 | Shiv | **4 Mecha-Gear** | Gears and More Gears… | `gears_quiz.html` |
| P3 | Charan | **5 Phys-Projectile** | Projectile Motion… | `projectile_quiz.html` |
| P4 | Kirtan | **1 Bio-Virus** | Viruses… | `virus_quiz.html` |
| P5 | CC | **3 Geo-Terrain** | Weathering / Zion… | `terrain_quiz.html` |
| P6 | BZ | **5 Phys-Projectile** | Projectile Motion… | `projectile_quiz.html` |

All five packs were used; Projectile was assigned twice (P3, P6).

### 1.2 Scoring rules

- **MCQ:** exact letter match to rubric answer key.  
- **SA:** analytic 0–3 vs “Expected content points” in the pack rubric (Complete / Partial / Minimal / No credit). Auto-scored first, then **manually adjusted** for obvious under-scores (esp. P4 SA5, P6 post SA1–4).  
- **P4 pretest:** submitted as **image-only PDF** (`Kirtan_quiz_pre_test.pdf`); OCR/text extract yielded no answers. Interview states they “did not have any idea” on the first quiz → treated as **pre = 0/30** (blank / unscorable).  
- **P5 pretest:** not blank — 4 MCQ attempted, all incorrect → MCQ 0; SA blank → total 0.  
- **P6 pretest:** genuinely attempted (15 MCQ answered) → only non-zero pretest in the sample.

### 1.3 Interview segment markers (VTT)

| ID | File | Interview start (approx.) | Notes |
|----|------|---------------------------|-------|
| P1-Kai | `Kai_semi-interview-transcription.vtt` | **line ~991** — “so first question… in one sentence… What does this tool do?” | Learning chatter before this |
| P2-Shiv | `Shiv-feedback-interview-transcription.vtt` | **line ~14 / 00:00:09** — “last bit now, just a quick chat” → Q1 at ~line 28 | Entire file is mostly interview |
| P3-Charan | `Charan-feedback-interview-transcription.vtt` | **line ~21** — “in one sentence, what would you say this thing actually does?” | |
| P4-Kirtan | `Kirtan_interview_feedback_transcription.vtt` | **line ~938** — “In one sentence, what you did you like?” (formal Qs); learning/post-quiz talk ~856–930 | Slightly looser question order |
| P5-CC | `CC-semi-interview-keynotes.txt` | full file | No VTT |
| P6-BZ | `BZ-semi-interview-keynotes.txt` | full file | No VTT |

---

## 2. Participants (demographics)

| ID | Age | Role | Field | AI use | Material (self-report) |
|----|-----|------|-------|--------|------------------------|
| P1-Kai | 24 | Working / other | Computer science | Weekly+ | VSEPR Theory… |
| P2-Shiv | 24 | Grad student | Data Science | Weekly+ | Gears and More Gears… |
| P3-Charan | 24 | Grad student | Computer Science | Weekly+ | Projectile Motion… |
| P4-Kirtan | 24 | Grad student | Computer Science | Weekly+ | Viruses… |
| P5-CC | 32 | Working / other | Finance | Sometimes | Geo-Terrain |
| P6-BZ | 18 | Undergrad | Art | Weekly+ | Physics Projectile Motion |

Skew: mostly CS/adjacent grads, ages 18–32, high AI familiarity (5/6 weekly+). Only P5 (Finance) and P6 (Art undergrad) diversify the sample.

---

## 3. Learning gain

### 3.1 Score table (points)

| ID | Pack | Pre MCQ /15 | Pre SA /15 | Pre /30 | Post MCQ /15 | Post SA /15 | Post /30 | Gain /30 | Gain MCQ |
|----|------|-------------|------------|---------|--------------|-------------|----------|----------|----------|
| P1-Kai | VSEPR | 0 | 0 | **0** | 15 | 13 | **28** | **+28** | +15 |
| P2-Shiv | Gears | 0 | 0 | **0** | 15 | 12 | **27** | **+27** | +15 |
| P3-Charan | Projectile | 0 | 0 | **0** | 15 | 11 | **26** | **+26** | +15 |
| P4-Kirtan | Virus | 0† | 0† | **0**† | 14 | 6‡ | **20** | **+20** | +14 |
| P5-CC | Terrain | 0§ | 0 | **0** | 11 | 7 | **18** | **+18** | +11 |
| P6-BZ | Projectile | 7 | 2‡ | **9** | 13 | 11‡ | **24** | **+15** | +6 |
| **Mean** | | **1.17** | **0.33** | **1.50** | **13.83** | **10.00** | **23.83** | **+22.33** | **+12.67** |
| **SD (total)** | | | | 3.67 | | | 3.97 | 5.28 | |

† P4 pretest = image PDF / treated as blank (see §1.2).  
§ P5 pretest: 4 wrong MCQ attempts, not left empty.  
‡ SA includes manual rubric adjudication (see §3.3).

### 3.2 Headline quantitative results

1. **Large mean gain:** +22.3 /30 (~74% of the scale), driven mainly by MCQ (+12.7 /15).  
2. **Post performance is strong but not ceiling-uniform:** three participants hit 15/15 MCQ; post totals range **18–28**.  
3. **Pretest floor effect** for P1–P4 (and effectively P5): blank or near-zero baselines inflate gain magnitude. **P6 is the only informative non-zero pretest** (7→13 MCQ; 9→24 total).  
4. **SA lags MCQ:** mean post SA = 10.0/15 vs MCQ 13.8/15 — participants recognize facts better than they articulate full rubric points (and some skipped SA items, esp. P4).  
5. **Pack difficulty signal (descriptive only):** Terrain (P5) and Virus (P4) post totals lowest (18–20); VSEPR/Gears highest (27–28). N per pack is 1–2 — do not over-interpret.

### 3.3 Short-answer adjudication notes

| ID | Auto SA → Final SA | Rationale |
|----|--------------------|-----------|
| P1 | 13 → **13** | Kept; strong Lewis / domain answers |
| P2 | 12 → **12** | Kept |
| P3 | 11 → **11** | Kept; solid independence / apex answers |
| P4 | 4 → **6** | SA1 partial (genetic material + protein coat)→2; SA5 living/nonliving evidence→3; SA3–4 “skip”→0 |
| P5 | 7 → **7** | Kept |
| P6 post | 6 → **11** | SA1 independence clearly stated→3; SA2 horiz const / vert gravity→2; SA4 apex (v_y=0, a=g)→3; SA5 outline minimal→1 |
| P6 pre | 0 → **2** | SA1 minimal independence→1; SA5 vague→1; SA2–4 misconceptions→0 |

### 3.4 MCQ error patterns (post)

- **P4:** 14/15 — miss Q13 (envelope-less family; answered D vs key A).  
- **P5:** 11/15 — several weathering/erosion confusions remain (aligned with interview: reading lacked prior knowledge).  
- **P6:** 13/15 — residual component/acceleration confusions despite large improvement from pre=7.

### 3.5 Interpretation caveats (must carry into paper)

- Not a controlled experiment (no comparison condition).  
- Blank-pre dominant → gains show “could answer after the course,” not ANCOVA-style learning.  
- Same quiz pre/post → practice/memory effects possible (sessions were long; still a threat).  
- Sample courses were **pre-generated**; gains reflect learner experience quality, not live generation latency/quality variance.

---

## 4. Experience questionnaire

### 4.1 NASA-TLX (0–100, as recorded)

| ID | Mental | Physical | Temporal | Performance* | Effort | Frustration | Raw mean |
|----|--------|----------|----------|--------------|--------|-------------|---------|
| P1-Kai | 75 | 10 | 30 | 10 | 50 | 75 | 41.7 |
| P2-Shiv | 80 | 65 | 15 | 90 | 70 | 30 | 58.3 |
| P3-Charan | 75 | 60 | 10 | 80 | 70 | 20 | 52.5 |
| P4-Kirtan | 80 | 25 | 25 | 50 | 75 | 25 | 46.7 |
| P5-CC | 40 | 30 | 35 | 60 | 80 | 70 | 52.5 |
| P6-BZ | 30 | 20 | 15 | 75 | 15 | 35 | 31.7 |
| **Mean** | **63.3** | **35.0** | **21.7** | **60.8** | **60.0** | **42.5** | **47.2** |

\*UI wording: Performance **0 = did great, 100 = did poorly** (reverse-coded load). Participants appear inconsistent (Kai low Perf = success; several others high).  

**Adjusted Performance** (= `100 − Perf`, so higher = worse load):  
Kai 90, Shiv 10, Charan 20, Kirtan 50, CC 40, BZ 25 → **mean 39.2**.

**Adjusted six-dimension means** (Perf flipped): Mental 63.3, Phys 35.0, Temp 21.7, Perf_adj 39.2, Effort 60.0, Frust 42.5 → **overall adj. mean ≈ 43.6**.

**TLX patterns**

1. **Mental demand moderately high** (M≈63), especially CS grads on STEM packs (75–80). P5/P6 lower (40/30).  
2. **Temporal demand low** (M≈22) — waiting/generation was not the main burden when using samples.  
3. **Effort high** (M≈60) except P6 (15) who also gave ceiling satisfaction.  
4. **Frustration bimodal:** Kai 75 + CC 70 vs others 20–35. Maps to trust/reading themes in interviews.  
5. **Do not over-claim a single “workload score”** without Perf polarity cleaning in future runs.

### 4.2 Likert items (1–7)

**Item keys (from `questionnaire.html`):**  
S1 overall satisfaction · S2 would reuse · S3 would recommend ·  
A1 authoring/clarity-of-flow · A2 wait acceptable · A3 outline clear · A4 trust content ·  
L1 reading helped · L2 quiz helped · L3 interactive/H5 helped · L4 3D helped  

| ID | S1 | S2 | S3 | A1 | A2 | A3 | A4 | L1 | L2 | L3 | L4 | S1–S3 M | All-11 M |
|----|----|----|----|----|----|----|----|----|----|----|----|---------|----------|
| P1 | 6 | 7 | 7 | 6 | 6 | 5 | 5 | 5 | 6 | 7 | 6 | 6.67 | 6.00 |
| P2 | 7 | 6 | 7 | 5 | 5 | 6 | 7 | 6 | 6 | 6 | 6 | 6.67 | 6.09 |
| P3 | 6 | 6 | 7 | 5 | 4 | 6 | 6 | 6 | 7 | 6 | 7 | 6.33 | 6.00 |
| P4 | 4 | 6 | 5 | 6 | 5 | 4 | 4 | 6 | 6 | 6 | 6 | 5.00 | 5.27 |
| P5 | 7 | 7 | 7 | 5 | 5 | 6 | 6 | 4 | 7 | 7 | 7 | 7.00 | 6.18 |
| P6 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7.00 | 7.00 |
| **Mean** | **6.17** | **6.50** | **6.67** | **5.67** | **5.33** | **5.67** | **5.83** | **5.67** | **6.50** | **6.50** | **6.50** | **6.44** | **6.09** |

**Likert patterns**

1. **Satisfaction cluster strong:** S1–S3 mean **6.44/7**; recommend (S3) mean **6.67** (only P4 below 6).  
2. **Learning modalities:** L2/L3/L4 all **6.50** — quiz / interactive / 3D rated as helpful. **L1 reading lowest (5.67)**, pulled down by P5=4 and P1=5.  
3. **Authoring/trust softer than satisfaction:** A2 wait **5.33**, A3 outline **5.67**, A4 trust **5.83** — matches “content fidelity / UI” concerns.  
4. **P4 is the dissatisfied outlier** on S1 (4) and A3/A4 (4) — aligns with “UI-UX” as worst + shallow course comments.  
5. **P6 is a ceiling responder** (all 7s) — still useful as existence proof of delight on Projectile + viz, but treat as high-leverage qualitative case, not average.

### 4.3 Open best / worst

| ID | Best | Worst |
|----|------|-------|
| P1 | 3D makes abstract concepts easier; experience hard-to-access situations | Concern AI truly understands real-world physics/chemistry rules in VR |
| P2 | Organized interactive learning of a new topic | Generation sometimes not conveying proper information |
| P3 | 2D/3D visualizations made concepts click faster | Reading too short (2–3 lines) for trickier topics |
| P4 | Follow-up quiz | UI-UX |
| P5 | Follow-up quiz + learning companion for reviewing understanding | Reading needs more context for novices → frustration |
| P6 | “any part is good” / loves the product | “No frustration” |

---

## 5. Semi-structured interview (qualitative)

### 5.1 Theme codebook (inductive from N=6)

| Theme | Definition | Who |
|-------|------------|-----|
| T1 Auto multimodal builder | Tool = PDF/chat → full lesson with visuals/quizzes | P1–P4, P6 (P5: “fancy things”) |
| T2 Waiting acceptable | Load/generation fine or minor | P1–P3, P5–P6; P2: first load slow but OK |
| T3 Viz / 3D as learning engine | 2D/3D or interactives drive understanding | P1, P3, P4, P6 |
| T4 Quiz / companion as check | Quiz or follow-ups force comprehension | P2, P4, P5 |
| T5 Thin / under-scaffolded reading | Readings too short or assume prior knowledge | P1, P3, P5 |
| T6 3D trust / render glitches | Broken scenes or fidelity doubt | P1 (fidelity), P2 (half-broken), P3 (settle-in) |
| T7 Depth “light but OK” | About right → slightly shallow | P2–P5; P1 matched well; P6 strong match |
| T8 Study yes / teach maybe | Would self-study; teaching needs control or polish | Most; P5 won’t recommend friends yet |
| T9 Top fix requests | Tutor, 3D, reading depth, UI, upload | Diversified — see §5.3 |

### 5.2 Per-participant interview digest

#### P1-Kai (VSEPR) — VTT from ~line 991

| Q | Summary | Quote |
|---|---------|-------|
| Tool | NL course ideas → interactive experience | “let teachers to describe their course ideas in natural language… create an interactive learning experience for students.” |
| Wait | Acceptable | “waiting time was pretty normal and acceptable” |
| Helped most | **3D** | “the 3D helps the most because it makes the abstract concept easier to understand” |
| Pain | AI fidelity + thin reading | “confused that… the AI truly understand the real world rules like chemistry or physical rules”; reading “only… two or three sentence to introduce one concept” |
| Depth | Matched PDF, level good | “matched the PDF very well” |
| Use | Study + teach | Would use to “turn my course idea into… actual lessons” |
| One fix | **AI tutor** (step-by-step explanation) | “improve the AI tutor feature… concepts are easier… when someone explains… step by step” |

#### P2-Shiv (Gears) — VTT from start (~line 14)

| Q | Summary | Quote |
|---|---------|-------|
| Tool | PDF/chat → full course + AI guide | “builds a whole course by itself, 3D scenes, readings, little interactives, quizzes… with an AI guide.” |
| Wait | First load slow, then fine | “a bit slower than I expected at first… wasn’t really a dealbreaker” |
| Helped most | **Quiz** | “Honestly the quiz… forced me to actually check if I understood… instead of just skimming” |
| Pain | **3D half-broken** | “scene would load half broken or some objects just wouldn't show up right” → “shakes your trust” (later in file) |
| Depth | A little basic | (questionnaire/interview: leaned basic) |
| Use | Study yes; teach needs more control | |
| One fix | **3D rendering** | Fixing 3D rendering |

#### P3-Charan (Projectile) — VTT from ~line 21

| Q | Summary | Quote |
|---|---------|-------|
| Tool | Auto lesson from material | “builds a whole lesson for you automatically… quizzes and visuals” |
| Wait | Fine | “small wait but nothing that bothered me… pretty reasonable” |
| Helped most | **2D/3D viz** | “seeing the concept actually laid out… made it click faster than reading” |
| Pain | Thin reading; minor viz settle | “reading part felt really short… two or three lines… wasn’t really enough” |
| Depth | About right, lighter | “mostly about right, but leaning a bit on the lighter side” |
| Use | Study definitely; teach after beefing reading | |
| One fix | **More text for harder topics** | |

#### P4-Kirtan (Virus) — VTT from ~line 938 (after post-quiz)

| Q | Summary | Quote |
|---|---------|-------|
| Experience | Decent; pre = no idea | “1st quiz… did not have any idea about the particular section” |
| Helped | Visuals/diagrams + quiz + AI assistant | “visuals and the diagrams… helped me a lot to keep me engaged”; segregate bacteria/virus traits “stand out”; assistant helpful when questions pop up |
| Wait / polish | Quiz UX + image quality | Quiz “scope of improvement”; “image quality… may get better” |
| Pain | Follow-up quiz navigation / technical | “follow up quiz section… underdeveloped… problem navigating” |
| Depth | **Bit shallow** | “didn't go as deep” |
| Use | Teach if structure control; study depends on material | |
| One fix | **UI** — less congested; hide agent/outline for focus study | “definitely do some work on the UI” |

#### P5-CC (Terrain) — keynotes

| Q | Summary |
|---|---------|
| Tool | “helps learning with fancy things” |
| Wait | “No feeling” (neutral/none) |
| Helped most | **Quizzes** — check understanding; mistakes show how |
| Pain | Reading lacks prior-knowledge context → hard to follow later chunks/quizzes |
| Depth | “Yes, very much” (matches) |
| Use | Self yes; **not recommend to friends yet** (preview phase; reading not tailored for novices) |
| One fix | Reading with more prior knowledge **or** a button to pick start level by background |

#### P6-BZ (Projectile) — keynotes

| Q | Summary |
|---|---------|
| Tool | Helps students/teachers create high-quality content and test it |
| Wait | “Its OK” |
| Helped most | **3D and 2D visualization/interaction** — “wish I could have such a system when I was high school” |
| Pain | None — “very easy to use” |
| Depth | Matches and explains well with fitting viz; can drag around |
| Use | Definitely; would recommend in high school; “will go viral” |
| One fix | **Public site should support doc uploading** for own topics |

### 5.3 Cross-cutting qualitative findings

1. **Value prop is understood** after one session (auto multimodal course + guide).  
2. **Constructivist modalities work in perception:** 3D/H5 and quizzes are the named learning engines; reading is the weak scaffold.  
3. **Trust is fragile around 3D** (broken renders, physical/chemical fidelity). This is not cosmetic — participants link it to willingness to trust the lesson.  
4. **Companion/quiz loop is appreciated** when visible (P4, P5); P1 wants a stronger explanatory tutor.  
5. **UI chrome** (P4) and **missing upload on Pages** (P6) are top practical fixes orthogonal to pedagogy.  
6. **Novice accessibility** (P5 finance background on geology) exposes the missing “prior knowledge on-ramp.”

---

## 6. Joint interpretation (gain × survey × interview)

| Finding | Evidence | Implication for product / paper |
|---------|----------|----------------------------------|
| Courses teach *something* measurable | Mean gain +22.3/30; P6 non-zero pre also gains +15 | Support claim of usable learning experience; caveats on floor effect |
| Multimodal construct is the perceived engine | High L2–L4; interviews favor 3D/quiz | Keep aha→construct pathway; invest in viz reliability |
| Scaffold under-delivered | Low L1; thin-reading theme (P1,P3,P5) | Raise reading minimum depth; add prior-knowledge gateway |
| Satisfaction high despite workload | S1–S3 6.44; Mental ~63 | Mental effort ≠ dissatisfaction; frustration is about trust/UI/reading |
| Outlier dissatisfaction = UI + shallow | P4 S1=4, worst=UI-UX, depth shallow | UI pass + depth controls for teacher |
| Pages demo gap | P6 wants upload | Document local vs Pages capability matrix in paper |
| Tutor is a differentiator request | P1 fix=tutor; P4/P5 praise companion/quiz | Learn-mode companion roadmap |

**One-paragraph verdict for the report.**  
Across N=6 remote sessions on five STEM sample courses, learners showed large pre→post gains on pack quizzes (M_gain≈22/30; M_post≈24/30), high satisfaction and recommendation (S1–S3≈6.4/7), and consistently understood the system as an automatic multimodal lesson builder. Qualitative data converge on interactive/3D and quiz checks as the learning core, while thin reading scaffolds, occasional 3D fidelity/render issues, UI congestion, and the lack of upload on the public demo are the primary frictions. NASA-TLX shows elevated mental demand but low temporal demand, matching “worth the wait” comments when samples are used.

---

## 7. Limitations of this analysis

1. N=6, convenience sample, CS-heavy.  
2. No control / no delayed posttest.  
3. Blank-pre dominance; P4 pretest not text-extractable.  
4. SA scoring mixes automation + single-rater manual adjudication (not double-blind).  
5. P5/P6 interviews are keynotes (lossy vs VTT).  
6. TLX Performance polarity inconsistently used.  
7. Sessions used samples — does not measure Docling/live-generation UX.  
8. Same instrument pre/post.

---

## 8. Numbers ready to paste into the paper

```
N = 6
Pre total M (SD)  = 1.50 (3.67) / 30
Post total M (SD) = 23.83 (3.97) / 30
Gain total M (SD) = 22.33 (5.28) / 30
Pre MCQ M         = 1.17 / 15
Post MCQ M        = 13.83 / 15
Post SA M         = 10.00 / 15

S1–S3 mean        = 6.44 / 7
S3 recommend mean = 6.67 / 7
All-11 Likert M   = 6.09 / 7
L1 reading M      = 5.67 / 7   (lowest modality)
L2/L3/L4 M        = 6.50 / 7

TLX Mental M      = 63.3
TLX Temporal M    = 21.7
TLX Effort M      = 60.0
TLX Frustration M = 42.5
TLX raw overall M = 47.2
```

---

## 9. Suggested figure/table list for slides / paper

1. Protocol timeline (pre → sample learn → post → survey → interview).  
2. Table: per-participant pre/post/gain.  
3. Bar chart: mean pre vs post (MCQ + total).  
4. Likert profile (S / A / L groups).  
5. TLX radar (with Perf polarity note).  
6. Theme map: Helps (3D/quiz) vs Frictions (reading/3D trust/UI/upload).  
7. Quote callouts (one per major theme).

---

## 10. File checklist used

```
experiment-study/Data/P1-Kai/   … quiz pre/post, questionnaire, VTT
experiment-study/Data/P2-Shiv/  …
experiment-study/Data/P3-Charan/…
experiment-study/Data/P4-Kirtan/… (pre PDF image)
experiment-study/Data/P5-CC/    … keynotes
experiment-study/Data/P6-BZ/    … keynotes (ignore Kai_* copies)
experiment-study/learning materials/*/ *_grading_rubric.html
final-delivery/_analysis_raw.json   # machine scores + interview slices metadata
final-delivery/_analyze_study.py    # reproducible scoring script
```

---

*End of N=6 analysis. Update `XR-EduAgent-ACM-Style-Report.md` Results section to cite this file (replace n=3 tables).*
