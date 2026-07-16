from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
CAPTURE_DIR = ROOT / "app-store-real-captures"
OUT_DIR = ROOT / "app-store-connected-screenshots"

PANEL_W = 1242
PANEL_H = 2688
COUNT = 5
CANVAS_W = PANEL_W * COUNT

FONT_DIR = Path("C:/Windows/Fonts")

INK = "#17130C"
PANEL = "#FFFDF8"
GOLD = "#D8AD3D"
GOLD_DARK = "#8A641A"
CREAM = "#FFF8E8"
MUTED = "#6E6252"
CHAMPAGNE = "#F4E3B5"
PEARL = "#FFFFFF"


def font(size, bold=False):
    names = ["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]
    for name in names:
        path = FONT_DIR / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def rgba(hex_value, alpha=255):
    value = hex_value.strip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def wrap_text(draw, value, fnt, width):
    lines, line = [], ""
    for word in value.split():
        test = f"{line} {word}".strip()
        if line and draw.textlength(test, font=fnt) > width:
            lines.append(line)
            line = word
        else:
            line = test
    if line:
        lines.append(line)
    return lines


def draw_wrapped(draw, xy, value, fnt, fill, width, gap=10):
    x, y = xy
    for line in wrap_text(draw, value, fnt, width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + gap
    return y


def draw_text_block(draw, x, y, value, fill, max_width, max_lines=3, start_size=76, min_size=56, gap=8):
    size = start_size
    while size >= min_size:
        fnt = font(size, True)
        lines = wrap_text(draw, value, fnt, max_width)
        if len(lines) <= max_lines:
            break
        size -= 4

    for line in lines[:max_lines]:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += size + gap
    return y, size


def draw_logo(canvas, x, y, max_w=255):
    logo_path = ROOT / "assets" / "images" / "LOGO_HORIZONTAL.png"
    d = ImageDraw.Draw(canvas)
    if not logo_path.exists():
        d.text((x, y), "FRESH LOOK", font=font(30, True), fill=CREAM)
        return

    logo = Image.open(logo_path).convert("RGBA")
    logo.thumbnail((max_w, 110), Image.Resampling.LANCZOS)
    tint = Image.new("RGBA", logo.size, rgba(GOLD_DARK, 255))
    alpha = logo.getchannel("A")
    canvas.paste(tint, (x, y), alpha)


def draw_glow(canvas, box, color, blur=80):
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse(box, fill=color)
    glow = glow.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(glow)


def draw_background():
    canvas = Image.new("RGBA", (CANVAS_W, PANEL_H), rgba(PEARL))
    d = ImageDraw.Draw(canvas)

    for y in range(PANEL_H):
        ratio = y / PANEL_H
        top = (255, 253, 248)
        bottom = (246, 236, 212)
        color = tuple(int(top[i] * (1 - ratio) + bottom[i] * ratio) for i in range(3)) + (255,)
        d.line((0, y, CANVAS_W, y), fill=color)

    for x in range(0, CANVAS_W, PANEL_W):
        d.rounded_rectangle((x + 26, 84, x + PANEL_W - 26, PANEL_H - 92), radius=58, fill=rgba(PANEL, 235), outline=rgba(GOLD, 80), width=3)
        d.line((x + PANEL_W - 1, 112, x + PANEL_W - 1, PANEL_H - 112), fill=rgba(GOLD, 80), width=3)

    band = [
        (-240, 870),
        (440, 1070),
        (1030, 970),
        (1630, 1240),
        (2300, 970),
        (2940, 1195),
        (3580, 955),
        (4240, 1190),
        (4960, 980),
        (CANVAS_W + 220, 1210),
    ]
    d.line(band, fill=rgba(GOLD, 232), width=140, joint="curve")
    d.line([(x, y + 132) for x, y in band], fill=rgba("#F8EAC6", 240), width=54, joint="curve")
    d.line([(x, y + 222) for x, y in band], fill=rgba("#FFFFFF", 230), width=96, joint="curve")

    d.polygon([(0, 2015), (CANVAS_W, 1515), (CANVAS_W, PANEL_H), (0, PANEL_H)], fill=rgba("#FFFFFF", 225))
    d.polygon([(0, 2310), (CANVAS_W, 1780), (CANVAS_W, 2070), (0, 2600)], fill=rgba("#FFF8E8", 185))

    for panel in range(COUNT):
        x = panel * PANEL_W
        draw_glow(canvas, (x + 700, 700, x + 1390, 1390), rgba(GOLD, 75), 115)
        draw_glow(canvas, (x - 260, 1580, x + 420, 2260), rgba("#FFFFFF", 150), 95)
        d.ellipse((x + 920, 2010, x + 1215, 2305), fill=rgba(GOLD, 150))
        d.ellipse((x + 1000, 400, x + 1090, 490), fill=rgba(GOLD, 230))
        d.ellipse((x + 1088, 486, x + 1144, 542), fill=rgba("#FFFFFF", 245))

    return canvas


def clear_logo_area(canvas, x, y):
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle((x - 22, y - 16, x + 318, y + 88), radius=26, fill=rgba(PANEL, 248))


def phone_layer(capture_name, screen_w):
    capture = Image.open(CAPTURE_DIR / capture_name).convert("RGBA")
    screen_h = round(screen_w * capture.height / capture.width)
    phone_w = screen_w + 104
    phone_h = screen_h + 174
    layer = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    d.rounded_rectangle((0, 0, phone_w, phone_h), radius=118, fill="#D3D8DE", outline="#FFFFFF", width=7)
    d.rounded_rectangle((18, 18, phone_w - 18, phone_h - 18), radius=100, fill="#0B0C0E")
    d.rounded_rectangle((29, 30, phone_w - 29, phone_h - 30), radius=86, fill="#060607")

    screen_x = 52
    screen_y = 88
    screen = capture.resize((screen_w, screen_h), Image.Resampling.LANCZOS)
    layer.paste(screen, (screen_x, screen_y), rounded_mask((screen_w, screen_h), 58))
    d.rounded_rectangle((screen_x, screen_y, screen_x + screen_w, screen_y + screen_h), radius=58, outline="#2A2D34", width=3)
    d.rounded_rectangle((phone_w // 2 - 145, 40, phone_w // 2 + 145, 86), radius=24, fill="#030304")
    d.ellipse((phone_w // 2 + 92, 53, phone_w // 2 + 113, 74), fill="#172134")

    shine = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shine)
    sd.polygon([(34, 70), (phone_w - 240, 0), (phone_w - 60, 0), (88, phone_h)], fill=rgba("#FFFFFF", 20))
    layer.alpha_composite(shine)
    return layer


def paste_angled_phone(canvas, capture_name, x, y, angle, screen_w=650, depth=34):
    phone = phone_layer(capture_name, screen_w)
    rotated = phone.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    alpha = rotated.getchannel("A")

    shadow = Image.new("RGBA", rotated.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 190), (0, 0), alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(38))
    canvas.alpha_composite(shadow, (x + 42, y + 58))

    for step in range(depth, 0, -4):
        side = Image.new("RGBA", rotated.size, rgba("#151515", min(210, 85 + step * 4)))
        canvas.paste(side, (x + step, y + step // 2), alpha)

    edge = Image.new("RGBA", rotated.size, (0, 0, 0, 0))
    ed = ImageDraw.Draw(edge)
    ed.line((24, rotated.height - 70, rotated.width - 44, rotated.height - 26), fill=rgba("#FFFFFF", 45), width=5)
    rotated.alpha_composite(edge)
    canvas.alpha_composite(rotated, (x, y))


def make():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.png"):
        old.unlink()

    slides = [
        ("home.png", "Beauty care in one place", "Book faster, check Fresh Points, and see your next visit instantly."),
        ("visits.png", "Track every treatment", "Upcoming appointments and visit history stay clean and simple."),
        ("rewards.png", "QR rewards from points", "Redeem Fresh Points at the salon with a code that is ready to scan."),
        ("shop.png", "Salon products on the go", "Browse care products, compare offers, and add favorites to your cart."),
        ("profile.png", "Profile, rewards & settings", "Manage account details, preferences, and membership status in seconds."),
    ]
    phone_specs = [
        (360, 820, -11, 626),
        (405, 785, 8, 640),
        (475, 745, -7, 650),
        (390, 815, 9, 638),
        (420, 805, -10, 626),
    ]

    canvas = draw_background()
    d = ImageDraw.Draw(canvas)
    subtitle_font = font(31)

    for index, (capture, title, subtitle) in enumerate(slides):
        x0 = index * PANEL_W
        clear_logo_area(canvas, x0 + 78, 78)
        draw_logo(canvas, x0 + 78, 78)

        title_end, _ = draw_text_block(d, x0 + 82, 270, title, INK, 735, max_lines=3, start_size=76, min_size=58, gap=8)
        subtitle_y = title_end + 28
        subtitle_end = draw_wrapped(d, (x0 + 84, subtitle_y), subtitle, subtitle_font, MUTED, 690, 9)

        pill_y = max(650, subtitle_end + 38)
        d.rounded_rectangle((x0 + 84, pill_y, x0 + 398, pill_y + 66), radius=33, fill=INK)
        d.text((x0 + 118, pill_y + 16), "REAL APP SCREEN", font=font(23, True), fill="#FFFFFF")

        px, py, angle, sw = phone_specs[index]
        paste_angled_phone(canvas, capture, x0 + px, py, angle, sw)

        d.rounded_rectangle((x0 + 82, 2410, x0 + 428, 2478), radius=34, fill=rgba(GOLD, 245))
        d.text((x0 + 120, 2428), "MY FRESHLOOK", font=font(25, True), fill="#111111")

    for index in range(COUNT):
        crop = canvas.crop((index * PANEL_W, 0, (index + 1) * PANEL_W, PANEL_H)).convert("RGB")
        crop.save(OUT_DIR / f"{index + 1:02d}-connected.png", "PNG", optimize=True)


if __name__ == "__main__":
    make()
