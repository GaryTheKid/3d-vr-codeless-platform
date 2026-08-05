#!/usr/bin/env python3
"""Generate short educational PDFs for the XR EduAgent usability study."""
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem

OUT = Path(__file__).resolve().parents[1] / "materials"

MATERIALS = [
    {
        "file": "M03-simple-pendulum.pdf",
        "title": "Simple Pendulum Motion",
        "subtitle": "Introductory physics · ~2 pages · for XR EduAgent study",
        "sections": [
            ("Learning goals",
             "After this short reading you should be able to: (1) state what a simple pendulum is; "
             "(2) recall the small-angle period formula; (3) explain how length and gravity affect period; "
             "(4) distinguish amplitude from period for small angles."),
            ("What is a simple pendulum?",
             "A simple pendulum is a point mass (bob) attached to a light inextensible string of length L, "
             "swinging under gravity about a fixed pivot. Real classroom pendulums approximate this ideal."),
            ("Forces and restoring torque",
             "When displaced by angle θ from vertical, the component of weight tangential to the arc is "
             "−mg sinθ. For small angles (θ in radians, |θ| ≲ 10–15°), sinθ ≈ θ, so the motion is approximately "
             "simple harmonic with angular frequency ω = √(g/L)."),
            ("Period formula (small angle)",
             "The period T (time for one full swing) is T = 2π √(L/g). Key consequences: "
             "longer L → larger T; stronger g → smaller T; for small angles, T is approximately independent of amplitude."),
            ("Common misconceptions",
             "Students often think heavier bobs swing faster. In the simple-pendulum model, mass cancels and does not "
             "appear in T. Large amplitudes break the small-angle approximation and lengthen the real period slightly."),
            ("Why 3D / interactive learning helps",
             "Seeing length change while a live period readout updates, and comparing two pendulums side by side, "
             "makes the √L dependence and the mass-independence claim concrete."),
        ],
    },
    {
        "file": "M04-dna-base-pairing.pdf",
        "title": "DNA Double Helix and Base Pairing",
        "subtitle": "Introductory biology · ~2 pages · for XR EduAgent study",
        "sections": [
            ("Learning goals",
             "You should be able to: (1) name the four bases; (2) state complementary pairing rules; "
             "(3) explain why pairing is specific; (4) relate base pairs to the double-helix structure."),
            ("Structure snapshot",
             "DNA is a double helix: two strands of nucleotides wind around a common axis. Each nucleotide has a sugar, "
             "a phosphate, and a nitrogenous base. The backbone is sugar–phosphate; bases point inward."),
            ("The four bases",
             "Adenine (A), Thymine (T), Guanine (G), and Cytosine (C). In RNA, uracil (U) replaces thymine."),
            ("Complementary pairing",
             "A pairs with T (two hydrogen bonds). G pairs with C (three hydrogen bonds). This complementarity "
             "lets each strand act as a template for the other during replication."),
            ("Antiparallel strands",
             "The two strands run in opposite directions (5′→3′ vs 3′→5′). Base pairs stack like rungs of a ladder; "
             "the helix turn and major/minor grooves matter for protein binding, but pairing rules are the core idea here."),
            ("Why spatial models help",
             "A 3D helix with clickable bases makes A–T vs G–C pairing and antiparallel orientation easier to remember "
             "than a flat textbook diagram alone."),
        ],
    },
    {
        "file": "M05-ohms-law-circuits.pdf",
        "title": "Ohm’s Law and Series Circuits",
        "subtitle": "Introductory physics / electronics · ~2 pages · for XR EduAgent study",
        "sections": [
            ("Learning goals",
             "You should be able to: (1) state Ohm’s law; (2) relate voltage, current, and resistance; "
             "(3) compute equivalent resistance for two resistors in series; (4) predict how current changes when R increases."),
            ("Ohm’s law",
             "For many conductors at fixed temperature, V = I R, where V is voltage (volts), I is current (amperes), "
             "and R is resistance (ohms). Rearrangements: I = V/R and R = V/I."),
            ("Intuition",
             "Think of voltage as the “push,” resistance as how hard it is for charge to flow, and current as the flow rate. "
             "Higher R with the same V means smaller I."),
            ("Series resistors",
             "In series, the same current flows through each resistor. Equivalent resistance is R_eq = R1 + R2 (+ …). "
             "Total voltage divides across resistors proportional to their resistances."),
            ("A quick example",
             "A 12 V battery, R1 = 2 Ω and R2 = 4 Ω in series → R_eq = 6 Ω → I = 12/6 = 2 A. "
             "Voltage across R1 is I·R1 = 4 V; across R2 is 8 V."),
            ("Why interactive circuits help",
             "Dragging resistance while watching current/voltage readouts reinforces V = I R better than memorizing the equation alone."),
        ],
    },
]


def build_pdf(meta: dict) -> Path:
    path = OUT / meta["file"]
    doc = SimpleDocTemplate(
        str(path),
        pagesize=letter,
        leftMargin=0.85 * inch,
        rightMargin=0.85 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "StudyTitle", parent=styles["Heading1"], fontSize=16, spaceAfter=6, leading=20
    )
    sub_style = ParagraphStyle(
        "StudySub", parent=styles["Normal"], fontSize=10, textColor="#444444", spaceAfter=14
    )
    h_style = ParagraphStyle(
        "StudyH", parent=styles["Heading2"], fontSize=12, spaceBefore=10, spaceAfter=4, leading=15
    )
    body = ParagraphStyle(
        "StudyBody", parent=styles["Normal"], fontSize=10.5, leading=14, spaceAfter=6
    )
    story = [
        Paragraph(meta["title"], title_style),
        Paragraph(meta["subtitle"], sub_style),
    ]
    for heading, text in meta["sections"]:
        story.append(Paragraph(heading, h_style))
        story.append(Paragraph(text, body))
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "Study use only · Short excerpt prepared for XR EduAgent usability study · Not a full textbook chapter.",
        ParagraphStyle("Foot", parent=styles["Normal"], fontSize=8, textColor="#666666"),
    ))
    doc.build(story)
    return path


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for m in MATERIALS:
        p = build_pdf(m)
        print("wrote", p)


if __name__ == "__main__":
    main()
