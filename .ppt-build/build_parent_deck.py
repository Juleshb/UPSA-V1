#!/usr/bin/env python3
"""Sample deck: what the parent and guardian mobile app now does."""

from collections import deque
from pathlib import Path

from lxml import etree
from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parent
ICON = ROOT / "mark.png"
LOGO = ROOT / "logo.png"
OUT = ROOT.parent / "RUPSA-NEXT-Parent-Guardian-Mobile.pptx"

NAVY = "092B3C"
AQUA = "18D6B4"
SKY = "C7F7ED"
PAPER = "F3F8F7"
WHITE = "FFFFFF"
INK = "16384A"
MUTED = "5E7482"
LINE = "E3EEEA"
GREEN = "0E8F78"

W = Inches(13.333)
H = Inches(7.5)


def rgb(value):
    return RGBColor.from_string(value)


def paint(shape, color, opacity=1, line=None, line_pt=1):
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(color)
    if opacity < 1:
        solid = shape.fill._xPr.find(qn("a:solidFill"))
        node = solid.find(qn("a:srgbClr"))
        alpha = etree.SubElement(node, qn("a:alpha"))
        alpha.set("val", str(int(opacity * 100000)))
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = rgb(line)
        shape.line.width = Pt(line_pt)


def rect(slide, x, y, w, h, color, opacity=1, line=None, radius=0.12, line_pt=1):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
    # Corner radius is a fraction of the shorter side. Keep cards soft, not pill-shaped.
    shorter = min(w, h)
    shape.adjustments[0] = min(0.5, float(Inches(radius) / shorter))
    paint(shape, color, opacity, line, line_pt)
    return shape


def oval(slide, x, y, w, h, color, opacity):
    shape = slide.shapes.add_shape(MSO_SHAPE.OVAL, x, y, w, h)
    paint(shape, color, opacity)
    return shape


def text(slide, value, x, y, w, h, size=16, color=INK, bold=False, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, spacing=0):
    box = slide.shapes.add_textbox(x, y, w, h)
    frame = box.text_frame
    frame.word_wrap = True
    frame.auto_size = None
    frame.margin_left = Emu(0)
    frame.margin_right = Emu(0)
    frame.margin_top = Emu(0)
    frame.margin_bottom = Emu(0)
    frame.anchor = anchor
    lines = value.split("\n")
    for index, line in enumerate(lines):
        paragraph = frame.paragraphs[0] if index == 0 else frame.add_paragraph()
        paragraph.alignment = align
        paragraph.space_after = Pt(spacing)
        run = paragraph.add_run()
        run.text = line
        run.font.name = "Calibri"
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = rgb(color)
    return box


def wash(slide):
    background = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, W, H)
    paint(background, PAPER)
    oval(slide, Inches(9.4), Inches(-1.6), Inches(5.2), Inches(5.2), AQUA, 0.28)
    oval(slide, Inches(-1.8), Inches(4.6), Inches(4.6), Inches(4.6), NAVY, 0.08)


def footer(slide, number, total):
    text(slide, "RUPSA NEXT   ·   Parent & Guardian mobile", Inches(0.55), Inches(7.08), Inches(8), Inches(0.28), 11, MUTED)
    text(slide, f"{number}  /  {total}", Inches(11.2), Inches(7.08), Inches(1.55), Inches(0.28), 11, MUTED, align=PP_ALIGN.RIGHT)


def heading(slide, eyebrow, title, subtitle=None):
    text(slide, eyebrow.upper(), Inches(0.55), Inches(0.32), Inches(8.5), Inches(0.28), 12, AQUA, True)
    text(slide, title, Inches(0.55), Inches(0.58), Inches(8.8), Inches(0.55), 30, NAVY, True)
    if subtitle:
        text(slide, subtitle, Inches(0.55), Inches(1.18), Inches(8.6), Inches(0.7), 15, MUTED)


def notes(slide, body):
    slide.notes_slide.notes_text_frame.text = body


def card_copy(slide, x, y, w, h, title, body):
    rect(slide, x, y, w, h, WHITE, 0.78, WHITE, 0.16)
    text(slide, title, x + Inches(0.22), y + Inches(0.16), w - Inches(0.4), Inches(0.36), 16, NAVY, True)
    text(slide, body, x + Inches(0.22), y + Inches(0.52), w - Inches(0.4), h - Inches(0.66), 13, MUTED, spacing=2)


def phone(slide, x, y, w, h):
    rect(slide, x, y, w, h, WHITE, 0.82, WHITE, 0.28)
    # Speaker notch stand-in
    rect(slide, x + w / 2 - Inches(0.28), y + Inches(0.12), Inches(0.56), Inches(0.06), LINE, 1, radius=0.04)
    return x + Inches(0.16), y + Inches(0.32), w - Inches(0.32)


def step_pills(slide, x, y, w, labels, current):
    rect(slide, x, y, w, Inches(0.62), WHITE, 0.7, WHITE, 0.14)
    count = len(labels)
    gap = Inches(0.08)
    piece = (w - gap * (count + 1)) / count
    for index, label in enumerate(labels):
        left = x + gap + (piece + gap) * index
        on = index <= current
        dot = rect(slide, left + piece / 2 - Inches(0.11), y + Inches(0.08), Inches(0.22), Inches(0.22), NAVY if on else WHITE, 1, LINE if not on else None, 0.11)
        text(slide, "✓" if index < current else str(index + 1), left, y + Inches(0.07), piece, Inches(0.24), 10, WHITE if on else MUTED, True, PP_ALIGN.CENTER)
        text(slide, label, left, y + Inches(0.32), piece, Inches(0.24), 10, NAVY if index == current else MUTED, index == current, PP_ALIGN.CENTER)
        if index:
            line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left - gap, y + Inches(0.17), gap, Inches(0.035))
            paint(line, AQUA if index <= current else LINE)
        del dot


def prepare_images():
    def knock_out(src, dest):
        image = Image.open(src).convert("RGBA")
        pixels = image.load()
        width, height = image.size

        def background(color):
            red, green, blue, _alpha = color
            return red > 250 and green > 250 and blue > 250

        seen = set()
        queue = deque([(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)])
        while queue:
            x, y = queue.popleft()
            if (x, y) in seen or not (0 <= x < width and 0 <= y < height):
                continue
            seen.add((x, y))
            if not background(pixels[x, y]):
                continue
            pixels[x, y] = (255, 255, 255, 0)
            queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
        image.save(dest)

    knock_out(ROOT / "rupsa-next-icon.svg.png", ICON)
    logo = Image.open(ROOT / "rupsa-next-logo.svg.png").convert("RGBA")
    knocked = ROOT / "logo-raw.png"
    logo.save(knocked)
    knock_out(knocked, LOGO)
    cropped = Image.open(LOGO)
    box = cropped.getbbox()
    if box:
        cropped.crop(box).save(LOGO)


def build():
    prepare_images()
    deck = Presentation()
    deck.slide_width = W
    deck.slide_height = H
    deck.core_properties.title = "RUPSA NEXT — Parent and Guardian mobile"
    deck.core_properties.subject = "What the parent and guardian module does on the phone"
    blank = deck.slide_layouts[6]
    total = 12

    # 1. Title
    slide = deck.slides.add_slide(blank)
    wash(slide)
    slide.shapes.add_picture(str(LOGO), Inches(0.6), Inches(0.42), Inches(3.15))
    text(slide, "PARENT & GUARDIAN", Inches(0.62), Inches(1.7), Inches(8), Inches(0.32), 14, AQUA, True)
    text(slide, "What the mobile\napp now does", Inches(0.58), Inches(2.05), Inches(7.4), Inches(1.8), 44, NAVY, True)
    text(
        slide,
        "A sample walk-through of Module 2 on the parent phone:\nwho can open an account, how a child is linked, and how notices stay current.",
        Inches(0.62), Inches(4.15), Inches(7.2), Inches(0.8), 16, MUTED,
    )
    chips = ["Register", "Authorize", "Verify", "Link a student", "Fees & receipts", "Notices"]
    left = Inches(0.62)
    for chip in chips:
        width = Inches(0.22 + 0.11 * len(chip))
        rect(slide, left, Inches(5.25), width, Inches(0.42), WHITE, 0.8, WHITE, 0.2)
        text(slide, chip, left, Inches(5.32), width, Inches(0.3), 13, NAVY, True, PP_ALIGN.CENTER)
        left += width + Inches(0.12)
    px, py, pw = phone(slide, Inches(9.85), Inches(0.7), Inches(2.85), Inches(6.05))
    rect(slide, px, py, pw, Inches(1.35), NAVY, 1, radius=0.16)
    text(slide, "Fees outstanding", px + Inches(0.14), py + Inches(0.12), pw - Inches(0.28), Inches(0.24), 11, AQUA, True)
    text(slide, "One balance", px + Inches(0.14), py + Inches(0.4), pw - Inches(0.28), Inches(0.36), 20, WHITE, True)
    text(slide, "Then the children on this account", px + Inches(0.14), py + Inches(0.88), pw - Inches(0.28), Inches(0.32), 11, "C5D5DC")
    text(slide, "Pay     Activity     Link", px, py + Inches(1.55), pw, Inches(0.3), 12, NAVY, True, PP_ALIGN.CENTER)
    for index, (name, meta) in enumerate([("Aline Uwase", "S3  ·  Example Private School"), ("Eric Niyonzima", "S2  ·  Example Private School")]):
        row = py + Inches(1.95 + index * 0.72)
        rect(slide, px, row, pw, Inches(0.64), WHITE, 0.9, LINE, 0.12, 0.75)
        text(slide, name, px + Inches(0.12), row + Inches(0.08), pw - Inches(0.24), Inches(0.26), 12, NAVY, True)
        text(slide, meta, px + Inches(0.12), row + Inches(0.32), pw - Inches(0.24), Inches(0.22), 10, MUTED)
    notes(slide, "Open with the purpose: this deck explains the parent and guardian phone, not the operator workspace. The phone is a calm bank screen: one balance, a few actions, and the children linked to this account.")

    # 2. What the module covers
    slide = deck.slides.add_slide(blank)
    wash(slide)
    heading(slide, "Module 2", "Six jobs, one parent account", "The phone is only for a parent or guardian. School staff and operators stay on the web workspace.")
    jobs = [
        ("1", "Register", "A parent opens the account. The role cannot be chosen, and parental-responsibility consent is required."),
        ("2", "Authorize", "School and fee records for a child stay hidden until that consent is active."),
        ("3", "Verify", "National ID is sent in three steps and stays pending until it is reviewed."),
        ("4", "Link", "Search the school, enter the student number, and confirm the child before linking."),
        ("5", "See fees", "Outstanding fees, payment history, and digital receipts sit on Home and Activity."),
        ("6", "Be notified", "An unread badge on Home updates when a link completes or a payment is received."),
    ]
    for index, (num, title, body) in enumerate(jobs):
        col, row = index % 3, index // 3
        x = Inches(0.55 + col * 4.15)
        y = Inches(2.15 + row * 2.25)
        rect(slide, x, y, Inches(3.95), Inches(2.05), WHITE, 0.8, WHITE, 0.16)
        bubble = rect(slide, x + Inches(0.2), y + Inches(0.2), Inches(0.42), Inches(0.42), SKY, 1, radius=0.2)
        text(slide, num, x + Inches(0.2), y + Inches(0.26), Inches(0.42), Inches(0.32), 14, NAVY, True, PP_ALIGN.CENTER)
        text(slide, title, x + Inches(0.74), y + Inches(0.26), Inches(2.9), Inches(0.34), 18, NAVY, True)
        text(slide, body, x + Inches(0.2), y + Inches(0.82), Inches(3.55), Inches(1.05), 13, MUTED)
        del bubble
    footer(slide, 2, total)
    notes(slide, "These six jobs are the parent module. Stress that self-registration cannot create a school user or an operator. Those accounts are seeded, not opened from the phone.")

    # 3. The look
    slide = deck.slides.add_slide(blank)
    wash(slide)
    heading(slide, "The screen", "A bank layout, with liquid glass", "Each task has its own screen. Surfaces are frosted, and the wash behind them is aqua and midnight.")
    swatches = [("Midnight", NAVY, WHITE), ("Forward Aqua", AQUA, NAVY), ("Open Sky", SKY, NAVY), ("Paper", "F7FAF9", NAVY)]
    for index, (name, color, ink) in enumerate(swatches):
        x = Inches(0.55 + index * 2.15)
        rect(slide, x, Inches(2.2), Inches(2.0), Inches(1.15), color, 1, LINE if color == "F7FAF9" else None, 0.14)
        text(slide, name, x + Inches(0.12), Inches(2.55), Inches(1.76), Inches(0.4), 14, ink, True, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE)
    points = [
        ("One balance", "Home leads with fees outstanding, not a wall of invoices."),
        ("A few actions", "Pay, Activity, and Link. Everything else lives under You."),
        ("Steps, not forms", "Identity and linking walk one card at a time: School, Student, Confirm."),
        ("Frosted cards", "Sheets are translucent white, with a soft aqua wash showing through."),
    ]
    for index, (title, body) in enumerate(points):
        y = Inches(3.6 + (index % 2) * 1.45)
        x = Inches(0.55 + (index // 2) * 4.3)
        card_copy(slide, x, y, Inches(4.1), Inches(1.3), title, body)
    px, py, pw = phone(slide, Inches(9.7), Inches(2.05), Inches(2.9), Inches(4.55))
    text(slide, "Good afternoon", px, py, pw, Inches(0.22), 11, MUTED)
    text(slide, "Parent", px, py + Inches(0.2), pw, Inches(0.3), 16, NAVY, True)
    rect(slide, px, py + Inches(0.62), pw, Inches(0.95), NAVY, 1, radius=0.12)
    text(slide, "Fees outstanding", px + Inches(0.12), py + Inches(0.72), pw - Inches(0.2), Inches(0.22), 10, AQUA, True)
    text(slide, "Sample balance", px + Inches(0.12), py + Inches(1.0), pw - Inches(0.2), Inches(0.36), 16, WHITE, True)
    for index, label in enumerate(["Pay", "Activity", "Link"]):
        tile = px + index * (pw / 3)
        rect(slide, tile + Inches(0.04), py + Inches(1.75), pw / 3 - Inches(0.08), Inches(0.62), WHITE, 0.75, WHITE, 0.1)
        text(slide, label, tile, py + Inches(1.9), pw / 3, Inches(0.32), 11, NAVY, True, PP_ALIGN.CENTER)
    text(slide, "ACCOUNTS", px, py + Inches(2.55), pw, Inches(0.22), 10, MUTED, True)
    rect(slide, px, py + Inches(2.82), pw, Inches(0.7), WHITE, 0.9, LINE, 0.1, 0.75)
    text(slide, "Aline Uwase", px + Inches(0.12), py + Inches(2.92), pw - Inches(0.2), Inches(0.24), 12, NAVY, True)
    text(slide, "S3  ·  Example Private School", px + Inches(0.12), py + Inches(3.16), pw - Inches(0.2), Inches(0.22), 10, MUTED)
    footer(slide, 3, total)
    notes(slide, "The visual system matches the product: Midnight, Forward Aqua, Open Sky, and a paper wash. Liquid glass means frosted cards over soft color orbs, not a new brand. The layout is a bank home: one figure, three actions, then the children.")

    # 4. Register
    slide = deck.slides.add_slide(blank)
    wash(slide)
    heading(slide, "Register", "Only a parent can open this account", "The phone asks for the person, then for consent. It does not ask which role they want.")
    rows = [
        ("Who", "Full name, phone, email, and a password. A national ID can be added now or later."),
        ("Consent", "The account is created only when parental-responsibility consent is accepted."),
        ("Role", "The account is a parent. School, bank, and operator roles are not offered here."),
        ("After", "A welcome notice is saved. No child is linked until the parent does that on purpose."),
    ]
    for index, (title, body) in enumerate(rows):
        y = Inches(2.15 + index * 1.1)
        rect(slide, Inches(0.55), y, Inches(8.3), Inches(0.98), WHITE, 0.8, WHITE, 0.14)
        rect(slide, Inches(0.74), y + Inches(0.28), Inches(0.1), Inches(0.42), AQUA, 1, radius=0.05)
        text(slide, title, Inches(1.05), y + Inches(0.14), Inches(1.5), Inches(0.7), 16, NAVY, True, anchor=MSO_ANCHOR.MIDDLE)
        text(slide, body, Inches(2.6), y + Inches(0.16), Inches(5.9), Inches(0.68), 14, MUTED, anchor=MSO_ANCHOR.MIDDLE)
    px, py, pw = phone(slide, Inches(9.55), Inches(1.55), Inches(3.1), Inches(5.05))
    text(slide, "Create account", px, py, pw, Inches(0.32), 16, NAVY, True)
    for index, label in enumerate(["Full name", "Phone", "Email", "Password"]):
        field = py + Inches(0.5 + index * 0.72)
        text(slide, label.upper(), px, field, pw, Inches(0.2), 10, MUTED, True)
        rect(slide, px, field + Inches(0.22), pw, Inches(0.38), WHITE, 0.95, LINE, 0.08, 0.75)
    rect(slide, px, py + Inches(3.5), pw, Inches(0.55), SKY, 1, radius=0.1)
    text(slide, "I accept parental-responsibility consent", px + Inches(0.1), py + Inches(3.58), pw - Inches(0.16), Inches(0.4), 11, NAVY, anchor=MSO_ANCHOR.MIDDLE)
    rect(slide, px, py + Inches(4.2), pw, Inches(0.42), NAVY, 1, radius=0.1)
    text(slide, "Create account", px, py + Inches(4.28), pw, Inches(0.28), 13, WHITE, True, PP_ALIGN.CENTER)
    footer(slide, 4, total)
    notes(slide, "Registration used to accept a role. That is closed. A person can only become a parent, and only after ticking parental consent. If account setup fails, the half-created user is removed.")

    # 5. Authorization
    slide = deck.slides.add_slide(blank)
    wash(slide)
    heading(slide, "Authorize", "A child’s records stay closed until consent is active", "This is the safeguard for children’s personal data. The parent can give it, and can withdraw it.")
    rect(slide, Inches(0.55), Inches(2.15), Inches(8.2), Inches(2.15), WHITE, 0.82, WHITE, 0.18)
    text(slide, "Withheld", Inches(0.8), Inches(2.35), Inches(3.4), Inches(0.3), 13, AQUA, True)
    text(slide, "No students, fees, receipts, or schools on the home screen.", Inches(0.8), Inches(2.7), Inches(3.5), Inches(0.7), 15, NAVY, True)
    text(slide, "The parent still sees their own contact, identity, and the request to authorize.", Inches(0.8), Inches(3.45), Inches(3.5), Inches(0.6), 13, MUTED)
    rect(slide, Inches(4.7), Inches(2.45), Inches(0.08), Inches(1.55), AQUA, 1, radius=0.04)
    text(slide, "Available", Inches(5.05), Inches(2.35), Inches(3.4), Inches(0.3), 13, AQUA, True)
    text(slide, "Linked children, outstanding fees, history, and receipts appear.", Inches(5.05), Inches(2.7), Inches(3.4), Inches(0.7), 15, NAVY, True)
    text(slide, "Withdrawing consent hides those records again.", Inches(5.05), Inches(3.45), Inches(3.4), Inches(0.6), 13, MUTED)
    covers = ["Identity", "Enrolment", "Outstanding fees", "Payment history", "Receipts", "Notices"]
    text(slide, "Consent covers", Inches(0.55), Inches(4.5), Inches(3), Inches(0.28), 13, MUTED, True)
    for index, item in enumerate(covers):
        col, row = index % 3, index // 3
        x = Inches(0.55 + col * 2.7)
        y = Inches(4.88 + row * 0.5)
        rect(slide, x, y, Inches(2.55), Inches(0.4), WHITE, 0.85, WHITE, 0.16)
        text(slide, item, x, y + Inches(0.06), Inches(2.55), Inches(0.28), 13, NAVY, True, PP_ALIGN.CENTER)
    text(slide, "It lasts two years. Withdraw it from You, under Authorization.", Inches(0.55), Inches(6.0), Inches(8.4), Inches(0.35), 14, MUTED)
    px, py, pw = phone(slide, Inches(9.55), Inches(1.7), Inches(3.1), Inches(4.85))
    text(slide, "Authorization", px, py, pw, Inches(0.3), 16, NAVY, True)
    rect(slide, px, py + Inches(0.45), pw, Inches(1.35), WHITE, 0.92, LINE, 0.12, 0.75)
    text(slide, "CHILDREN’S DATA", px + Inches(0.14), py + Inches(0.58), pw - Inches(0.28), Inches(0.2), 10, MUTED, True)
    text(slide, "Withheld", px + Inches(0.14), py + Inches(0.8), pw - Inches(0.28), Inches(0.28), 16, NAVY, True)
    text(slide, "CONSENT", px + Inches(0.14), py + Inches(1.18), pw - Inches(0.28), Inches(0.18), 10, MUTED, True)
    text(slide, "Required", px + Inches(0.14), py + Inches(1.36), pw - Inches(0.28), Inches(0.26), 14, NAVY, True)
    rect(slide, px, py + Inches(2.05), pw, Inches(0.46), NAVY, 1, radius=0.1)
    text(slide, "Give parental authorization", px, py + Inches(2.15), pw, Inches(0.28), 12, WHITE, True, PP_ALIGN.CENTER)
    footer(slide, 5, total)
    notes(slide, "Rwanda’s data-protection framework treats children’s data with extra care and looks for parental-responsibility consent. The app enforces that: without an active consent, the family payload withholds students, invoices, payments, and receipts. The school directory used for linking is not the child’s record.")

    # 6. Identity
    slide = deck.slides.add_slide(blank)
    wash(slide)
    heading(slide, "Identity", "Verification is three cards", "The parent sends the national ID. They do not verify themselves.")
    steps = [
        ("Record", "The card shows the status already on the account, the masked ID, and the guardian reference."),
        ("Identity", "The parent enters the 16-digit national ID. Continue stays off until the number is complete."),
        ("Review", "They check the number and submit it. The status remains pending until someone reviews it."),
    ]
    for index, (title, body) in enumerate(steps):
        x = Inches(0.55 + index * 2.95)
        rect(slide, x, Inches(2.15), Inches(2.8), Inches(3.55), WHITE, 0.82, WHITE, 0.16)
        circle = rect(slide, x + Inches(0.2), Inches(2.35), Inches(0.42), Inches(0.42), NAVY, 1, radius=0.2)
        text(slide, str(index + 1), x + Inches(0.2), Inches(2.42), Inches(0.42), Inches(0.3), 14, WHITE, True, PP_ALIGN.CENTER)
        text(slide, title, x + Inches(0.74), Inches(2.4), Inches(1.85), Inches(0.36), 18, NAVY, True)
        text(slide, body, x + Inches(0.2), Inches(3.0), Inches(2.4), Inches(1.9), 14, MUTED)
        del circle
    text(slide, "The number is stored as a mask, such as ••••••••••••7654. Sending the same number again does not undo a record that is already verified.", Inches(0.55), Inches(6.0), Inches(12.2), Inches(0.7), 15, INK)
    footer(slide, 6, total)
    notes(slide, "Walk the three steps. The first card is what the platform already holds. The second is the 16-digit entry. The third is review and submit. Status values the parent can see are Not submitted, Pending review, Verified, or Rejected. Verified is not a self-serve button.")

    # 7. School search
    slide = deck.slides.add_slide(blank)
    wash(slide)
    heading(slide, "Link a student", "Choose the school by name or code", "The first step is a search, then a tick. Continue waits until a school is chosen.")
    card_copy(slide, Inches(0.55), Inches(2.15), Inches(4.15), Inches(1.7), "Search", "The parent types a school name, such as Hills, or a school code, such as SCH-20226. The list narrows to the matches.")
    card_copy(slide, Inches(0.55), Inches(4.05), Inches(4.15), Inches(1.7), "Select", "The chosen row turns aqua and shows a check. The code and district stay visible, so the parent can see which school they picked.")
    px, py, pw = phone(slide, Inches(5.15), Inches(2.05), Inches(3.35), Inches(4.55))
    step_pills(slide, px, py, pw, ["School", "Student", "Confirm"], 0)
    text(slide, "FIND A SCHOOL", px, py + Inches(0.78), pw, Inches(0.2), 10, MUTED, True)
    rect(slide, px, py + Inches(1.02), pw, Inches(0.4), WHITE, 0.95, LINE, 0.08, 0.75)
    text(slide, "hills", px + Inches(0.12), py + Inches(1.1), pw - Inches(0.2), Inches(0.26), 13, NAVY)
    rect(slide, px, py + Inches(1.58), pw, Inches(0.7), SKY, 1, radius=0.12)
    text(slide, "Green Hills Academy", px + Inches(0.12), py + Inches(1.66), pw - Inches(0.5), Inches(0.26), 13, NAVY, True)
    text(slide, "SCH-20126  ·  Kicukiro", px + Inches(0.12), py + Inches(1.92), pw - Inches(0.5), Inches(0.22), 11, MUTED)
    text(slide, "✓", px + pw - Inches(0.38), py + Inches(1.74), Inches(0.28), Inches(0.32), 16, NAVY, True)
    rect(slide, px, py + Inches(3.55), pw, Inches(0.42), NAVY, 1, radius=0.1)
    text(slide, "Continue", px, py + Inches(3.63), pw, Inches(0.28), 13, WHITE, True, PP_ALIGN.CENTER)
    text(slide, "Codes on the sample schools look like SCH-12345. The public school id can be searched too.", Inches(8.75), Inches(2.3), Inches(4.0), Inches(1.5), 15, INK)
    footer(slide, 7, total)
    notes(slide, "Show the search. Name and school code both work. The check is the selected state. Nothing is pre-selected, so the parent has to choose. A search with no match says so.")

    # 8. Student number
    slide = deck.slides.add_slide(blank)
    wash(slide)
    heading(slide, "Link a student", "The student number opens the school record", "Continue stays off until that number matches a student at the chosen school.")
    facts = [
        ("Who", "Name, class, year, and fee category."),
        ("Where", "School name, school code, and district."),
        ("Money", "Billed, paid, and due, plus each invoice."),
        ("Then", "The parent picks mother, father, or guardian and confirms."),
    ]
    for index, (title, body) in enumerate(facts):
        y = Inches(2.15 + index * 1.05)
        rect(slide, Inches(0.55), y, Inches(5.5), Inches(0.92), WHITE, 0.8, WHITE, 0.14)
        text(slide, title, Inches(0.78), y + Inches(0.14), Inches(1.3), Inches(0.64), 16, NAVY, True, anchor=MSO_ANCHOR.MIDDLE)
        text(slide, body, Inches(2.15), y + Inches(0.14), Inches(3.65), Inches(0.64), 14, MUTED, anchor=MSO_ANCHOR.MIDDLE)
    px, py, pw = phone(slide, Inches(6.4), Inches(1.85), Inches(3.2), Inches(4.85))
    text(slide, "STUDENT NUMBER", px, py, pw, Inches(0.2), 10, MUTED, True)
    rect(slide, px, py + Inches(0.24), pw, Inches(0.4), WHITE, 0.95, LINE, 0.08, 0.75)
    text(slide, "STU-10001", px + Inches(0.12), py + Inches(0.32), pw - Inches(0.2), Inches(0.26), 13, NAVY, True)
    text(slide, "Aline Uwase", px, py + Inches(0.8), pw, Inches(0.28), 16, NAVY, True)
    text(slide, "S3  ·  2026  ·  day", px, py + Inches(1.08), pw, Inches(0.22), 11, MUTED)
    text(slide, "Example Private School · SCH-12345", px, py + Inches(1.3), pw, Inches(0.22), 11, MUTED)
    for index, (label, value, tone) in enumerate([("Billed", "Sample", NAVY), ("Paid", "Sample", NAVY), ("Due", "Sample", GREEN)]):
        col = px + index * (pw / 3)
        text(slide, label.upper(), col, py + Inches(1.7), pw / 3, Inches(0.18), 9, MUTED, True)
        text(slide, value, col, py + Inches(1.88), pw / 3, Inches(0.24), 12, tone, True)
    text(slide, "Invoices appear under the figures, with status and balance.", px, py + Inches(2.3), pw, Inches(0.7), 12, MUTED)
    rect(slide, px, py + Inches(3.9), pw, Inches(0.42), NAVY, 1, radius=0.1)
    text(slide, "Continue", px, py + Inches(3.98), pw, Inches(0.28), 13, WHITE, True, PP_ALIGN.CENTER)
    text(slide, "A number that does not match says so, and does not reveal another school’s student.", Inches(9.8), Inches(2.1), Inches(3.1), Inches(1.6), 15, INK)
    footer(slide, 8, total)
    notes(slide, "This lookup requires the same parental consent as linking. It returns the school record for that number at the chosen school: enrolment and fees, not a national ID. The name used to link comes from that record, so the parent confirms the child they can see.")

    # 9. After link
    slide = deck.slides.add_slide(blank)
    wash(slide)
    heading(slide, "After linking", "A notice, then the list of children", "The parent does not stay on the form. Home opens on the accounts, with the new child highlighted.")
    rect(slide, Inches(0.55), Inches(2.2), Inches(5.7), Inches(1.55), SKY, 0.85, radius=0.16)
    text(slide, "Link completed", Inches(0.8), Inches(2.4), Inches(5.2), Inches(0.32), 16, NAVY, True)
    text(slide, "Aline Uwase at Example Private School is now on your account.", Inches(0.8), Inches(2.8), Inches(5.2), Inches(0.65), 15, INK)
    text(slide, "The same sentence is saved under Notices, so it is still there after the banner.", Inches(0.55), Inches(4.0), Inches(5.7), Inches(0.8), 15, MUTED)
    text(slide, "If the child is far down the list, the list opens far enough to show them.", Inches(0.55), Inches(4.8), Inches(5.7), Inches(0.7), 15, MUTED)
    px, py, pw = phone(slide, Inches(7.0), Inches(1.7), Inches(3.15), Inches(5.0))
    rect(slide, px, py, pw, Inches(0.85), SKY, 1, radius=0.12)
    text(slide, "Link completed. Aline Uwase is now on your account.", px + Inches(0.1), py + Inches(0.12), pw - Inches(0.2), Inches(0.62), 12, NAVY)
    rect(slide, px, py + Inches(1.05), pw, Inches(0.85), NAVY, 1, radius=0.12)
    text(slide, "Fees outstanding", px + Inches(0.12), py + Inches(1.16), pw, Inches(0.2), 10, AQUA, True)
    text(slide, "Updated total", px + Inches(0.12), py + Inches(1.4), pw, Inches(0.32), 16, WHITE, True)
    text(slide, "ACCOUNTS", px, py + Inches(2.1), pw, Inches(0.22), 10, MUTED, True)
    rect(slide, px, py + Inches(2.4), pw, Inches(0.62), SKY, 1, radius=0.1)
    text(slide, "Aline Uwase", px + Inches(0.12), py + Inches(2.48), pw - Inches(0.2), Inches(0.22), 13, NAVY, True)
    text(slide, "Just linked", px + Inches(0.12), py + Inches(2.7), pw - Inches(0.2), Inches(0.2), 11, MUTED)
    rect(slide, px, py + Inches(3.12), pw, Inches(0.55), WHITE, 0.9, LINE, 0.1, 0.75)
    text(slide, "Eric Niyonzima", px + Inches(0.12), py + Inches(3.24), pw - Inches(0.2), Inches(0.3), 13, NAVY, True)
    footer(slide, 9, total)
    notes(slide, "After a successful link the app refreshes the family, saves the notice, and navigates to Home. The banner is the immediate confirmation. Notices keeps the record. The highlighted row is the child whose number was just linked.")

    # 10. Home fees and activity
    slide = deck.slides.add_slide(blank)
    wash(slide)
    heading(slide, "Fees and history", "Outstanding fees, payments, and receipts", "Home is the balance. Activity is the history. Paying still uses an approved rail.")
    columns = [
        ("Home", "Fees outstanding for every linked child, then each child as an account. Pay on a child opens that child’s open invoice."),
        ("Activity", "A switch between receipts and payments. A payment row shows the flow code, the rail, and the corridor."),
        ("Rails", "The parent can pay by mobile money, bank, card, or a payment service, from Rwanda or the live Tanzania pilot."),
        ("Not here", "Refunds, reversals, and the full rail catalog stay on the operator workspace. A planned corridor is refused before any money moves."),
    ]
    for index, (title, body) in enumerate(columns):
        x = Inches(0.55 + (index % 2) * 6.3)
        y = Inches(2.15 + (index // 2) * 2.15)
        card_copy(slide, x, y, Inches(6.05), Inches(1.95), title, body)
    footer(slide, 10, total)
    notes(slide, "Outstanding fees are the sum of open invoices. Activity lists receipts and payments. Payment rows carry the architecture the platform already uses: flow code, rail, and corridor. Parents can start a payment on an approved rail. They cannot refund or reverse. Uganda, Kenya, Burundi, South Sudan, and DRC are visible as planned and are rejected until those corridors open.")

    # 11. Notices
    slide = deck.slides.add_slide(blank)
    wash(slide)
    heading(slide, "Notices", "An unread badge, updated while Home stays open", "The bell counts notices the parent has not opened. A new one changes that count without a refresh.")
    bits = [
        ("Badge", "The bell on Home shows the unread count. No unread notices, and the number is gone."),
        ("The list", "Unread rows wear an aqua dot. Opening Notices marks them read, and the badge clears."),
        ("Live", "A completed link or a received payment appears on Home while that screen is already open."),
        ("Where", "You → Notices still holds the same list. The row there says how many are unread."),
    ]
    for index, (title, body) in enumerate(bits):
        y = Inches(2.1 + index * 1.1)
        rect(slide, Inches(0.55), y, Inches(8.15), Inches(0.98), WHITE, 0.8, WHITE, 0.14)
        text(slide, title, Inches(0.8), y + Inches(0.14), Inches(1.5), Inches(0.7), 16, NAVY, True, anchor=MSO_ANCHOR.MIDDLE)
        text(slide, body, Inches(2.4), y + Inches(0.14), Inches(6.0), Inches(0.7), 14, MUTED, anchor=MSO_ANCHOR.MIDDLE)
    px, py, pw = phone(slide, Inches(9.15), Inches(1.85), Inches(3.5), Inches(4.7))
    text(slide, "Parent", px, py, pw - Inches(0.5), Inches(0.3), 16, NAVY, True)
    bell = rect(slide, px + pw - Inches(0.42), py, Inches(0.42), Inches(0.42), NAVY, 1, radius=0.2)
    text(slide, "4", px + pw - Inches(0.42), py + Inches(0.06), Inches(0.42), Inches(0.3), 12, WHITE, True, PP_ALIGN.CENTER)
    del bell
    for index, (title, unread) in enumerate([("Link completed", True), ("Payment received", True), ("Payment received", False)]):
        row = py + Inches(0.7 + index * 0.95)
        rect(slide, px, row, pw, Inches(0.85), WHITE, 0.9, LINE, 0.1, 0.75)
        if unread:
            dot = slide.shapes.add_shape(MSO_SHAPE.OVAL, px + Inches(0.12), row + Inches(0.16), Inches(0.14), Inches(0.14))
            paint(dot, AQUA)
        text(slide, title, px + Inches(0.36 if unread else 0.12), row + Inches(0.1), pw - Inches(0.5), Inches(0.26), 13, NAVY, True)
        text(slide, "On this account", px + Inches(0.12), row + Inches(0.42), pw - Inches(0.24), Inches(0.28), 11, MUTED)
    footer(slide, 11, total)
    notes(slide, "Unread means the notice has no read time. Opening the list marks the ones on screen as read. New notices are pushed on an open connection and also refreshed on a short poll, so the badge moves while the parent is looking at Home. Examples are a completed student link and a fee receipt.")

    # 12. You menu and boundary
    slide = deck.slides.add_slide(blank)
    wash(slide)
    heading(slide, "You", "The rest of the account, and the boundary", "Preferences remember how this parent likes to pay. The operator tools stay off the phone.")
    menu = [
        ("Authorization", "Give or withdraw parental consent."),
        ("Identity", "See status and submit the national ID."),
        ("Contact", "Update email and phone."),
        ("Link a student", "Connect another child at their school."),
        ("Payment preferences", "Preferred rail, country, and how notices arrive."),
        ("Notices", "The inbox, with the unread count."),
    ]
    for index, (title, body) in enumerate(menu):
        col, row = index % 2, index // 2
        x = Inches(0.55 + col * 4.35)
        y = Inches(2.15 + row * 1.15)
        rect(slide, x, y, Inches(4.15), Inches(1.02), WHITE, 0.8, WHITE, 0.14)
        text(slide, title, x + Inches(0.18), y + Inches(0.12), Inches(3.8), Inches(0.3), 15, NAVY, True)
        text(slide, body, x + Inches(0.18), y + Inches(0.46), Inches(3.8), Inches(0.4), 13, MUTED)
    text(slide, "Sign out sits under that menu. A parent session cannot open the school, bank, or operator boards.", Inches(0.55), Inches(5.7), Inches(8.5), Inches(0.55), 15, INK)
    rect(slide, Inches(9.4), Inches(2.15), Inches(3.4), Inches(3.35), NAVY, 1, radius=0.18)
    text(slide, "Kept off this phone", Inches(9.6), Inches(2.35), Inches(3.05), Inches(0.35), 14, AQUA, True)
    text(slide, "Refunds and reversals\nThe full rail catalog\nSchool administration\nVerifying an identity\nOpening another role", Inches(9.6), Inches(2.85), Inches(3.05), Inches(2.3), 15, WHITE, spacing=6)
    footer(slide, 12, total)
    notes(slide, "Close on the boundary. The phone is the parent’s account: consent, identity, contact, linking, preferences, fees, receipts, and notices. Operators still verify identity, refund, reverse, and run the rail catalog on the web workspace.")

    deck.save(OUT)
    print(OUT)


if __name__ == "__main__":
    build()
