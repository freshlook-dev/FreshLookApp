from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
CAPTURE_DIR = ROOT / "app-store-real-captures"
OUT_DIR = ROOT / "play-store-screenshots"

PANEL_W = 1080
PANEL_H = 1920
COUNT = 5
CANVAS_W = PANEL_W * COUNT

FONT_DIR = Path("C:/Windows/Fonts")

INK = "#17130C"
PANEL = "#FFFDF8"
GOLD = "#D8AD3D"
GOLD_DARK = "#8A641A"
MUTED = "#6E6252"
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


def draw_wrapped(draw, xy, value, fnt, fill, width, gap=8):
    x, y = xy
    for line in wrap_text(draw, value, fnt, width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + gap
    return y


def draw_text_block(draw, x, y, value, fill, max_width, max_lines=3, start_size=58, min_size=44, gap=6):
    size = start_size
    while size >= min_size:
        fnt = font(size, True)
        lines = wrap_text(draw, value, fnt, max_width)
        if len(lines) <= max_lines:
            break
        size -= 3

    for line in lines[:max_lines]:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += size + gap
    return y


def draw_logo(canvas, x, y, max_w=210):
    logo_path = ROOT / "assets" / "images" / "LOGO_HORIZONTAL.png"
    d = ImageDraw.Draw(canvas)
    if not logo_path.exists():
        d.text((x, y), "FRESH LOOK", font=font(24, True), fill=GOLD_DARK)
        return

    logo = Image.open(logo_path).convert("RGBA")
    logo.thumbnail((max_w, 84), Image.Resampling.LANCZOS)
    tint = Image.new("RGBA", logo.size, rgba(GOLD_DARK, 255))
    canvas.paste(tint, (x, y), logo.getchannel("A"))


def draw_glow(canvas, box, color, blur=70):
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
        d.rounded_rectangle((x + 22, 46, x + PANEL_W - 22, PANEL_H - 64), radius=44, fill=rgba(PANEL, 235), outline=rgba(GOLD, 80), width=3)
        d.line((x + PANEL_W - 1, 80, x + PANEL_W - 1, PANEL_H - 80), fill=rgba(GOLD, 80), width=3)

    band = [
        (-210, 610),
        (380, 760),
        (895, 690),
        (1415, 880),
        (2005, 690),
        (2560, 850),
        (3130, 685),
        (3695, 845),
        (4315, 695),
        (CANVAS_W + 180, 875),
    ]
    d.line(band, fill=rgba(GOLD, 232), width=106, joint="curve")
    d.line([(x, y + 98) for x, y in band], fill=rgba("#F8EAC6", 240), width=42, joint="curve")
    d.line([(x, y + 168) for x, y in band], fill=rgba("#FFFFFF", 235), width=74, joint="curve")

    d.polygon([(0, 1480), (CANVAS_W, 1100), (CANVAS_W, PANEL_H), (0, PANEL_H)], fill=rgba("#FFFFFF", 225))
    d.polygon([(0, 1680), (CANVAS_W, 1295), (CANVAS_W, 1495), (0, 1860)], fill=rgba("#FFF8E8", 185))

    for panel in range(COUNT):
        x = panel * PANEL_W
        draw_glow(canvas, (x + 620, 500, x + 1220, 1110), rgba(GOLD, 70), 95)
        draw_glow(canvas, (x - 210, 1180, x + 360, 1730), rgba("#FFFFFF", 150), 80)
        d.ellipse((x + 805, 1470, x + 1048, 1713), fill=rgba(GOLD, 150))
        d.ellipse((x + 865, 278, x + 942, 355), fill=rgba(GOLD, 230))
        d.ellipse((x + 942, 350, x + 992, 400), fill=rgba("#FFFFFF", 245))

    return canvas


def clear_logo_area(canvas, x, y):
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle((x - 18, y - 12, x + 278, y + 72), radius=22, fill=rgba(PANEL, 248))


def android_phone_layer(capture_name, screen_w):
    capture = Image.open(CAPTURE_DIR / capture_name).convert("RGBA")
    screen_h = round(screen_w * capture.height / capture.width)
    phone_w = screen_w + 74
    phone_h = screen_h + 116
    layer = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    d.rounded_rectangle((0, 0, phone_w, phone_h), radius=76, fill="#D7DBDF", outline="#FFFFFF", width=6)
    d.rounded_rectangle((15, 15, phone_w - 15, phone_h - 15), radius=64, fill="#0B0C0E")
    d.rounded_rectangle((25, 25, phone_w - 25, phone_h - 25), radius=54, fill="#050506")

    screen_x = 37
    screen_y = 58
    screen = capture.resize((screen_w, screen_h), Image.Resampling.LANCZOS)
    layer.paste(screen, (screen_x, screen_y), rounded_mask((screen_w, screen_h), 42))
    d.rounded_rectangle((screen_x, screen_y, screen_x + screen_w, screen_y + screen_h), radius=42, outline="#2A2D34", width=2)
    d.ellipse((phone_w // 2 - 15, 31, phone_w // 2 + 15, 61), fill="#050506")
    d.ellipse((phone_w // 2 - 7, 39, phone_w // 2 + 7, 53), fill="#172134")

    shine = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shine)
    sd.polygon([(30, 58), (phone_w - 190, 0), (phone_w - 52, 0), (76, phone_h)], fill=rgba("#FFFFFF", 20))
    layer.alpha_composite(shine)
    return layer


def paste_angled_phone(canvas, capture_name, x, y, angle, screen_w=500, depth=26):
    phone = android_phone_layer(capture_name, screen_w)
    rotated = phone.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    alpha = rotated.getchannel("A")

    shadow = Image.new("RGBA", rotated.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 175), (0, 0), alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))
    canvas.alpha_composite(shadow, (x + 32, y + 44))

    for step in range(depth, 0, -4):
        side = Image.new("RGBA", rotated.size, rgba("#151515", min(205, 90 + step * 4)))
        canvas.paste(side, (x + step, y + step // 2), alpha)

    edge = Image.new("RGBA", rotated.size, (0, 0, 0, 0))
    ed = ImageDraw.Draw(edge)
    ed.line((20, rotated.height - 48, rotated.width - 34, rotated.height - 18), fill=rgba("#FFFFFF", 45), width=4)
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
        (330, 600, -10, 505),
        (360, 575, 8, 515),
        (408, 550, -7, 520),
        (340, 598, 9, 512),
        (390, 590, -10, 505),
    ]

    canvas = draw_background()
    d = ImageDraw.Draw(canvas)
    subtitle_font = font(24)

    for index, (capture, title, subtitle) in enumerate(slides):
        x0 = index * PANEL_W
        clear_logo_area(canvas, x0 + 56, 52)
        draw_logo(canvas, x0 + 56, 52)

        title_end = draw_text_block(d, x0 + 56, 180, title, INK, 615, max_lines=3, start_size=58, min_size=44, gap=6)
        subtitle_y = title_end + 18
        subtitle_end = draw_wrapped(d, (x0 + 58, subtitle_y), subtitle, subtitle_font, MUTED, 590, 7)

        pill_y = max(470, subtitle_end + 28)
        d.rounded_rectangle((x0 + 58, pill_y, x0 + 310, pill_y + 52), radius=26, fill=INK)
        d.text((x0 + 86, pill_y + 13), "REAL APP SCREEN", font=font(18, True), fill="#FFFFFF")

        px, py, angle, sw = phone_specs[index]
        paste_angled_phone(canvas, capture, x0 + px, py, angle, sw)

        d.rounded_rectangle((x0 + 58, 1716, x0 + 340, 1772), radius=28, fill=rgba(GOLD, 245))
        d.text((x0 + 90, 1731), "MY FRESHLOOK", font=font(20, True), fill="#111111")

    for index in range(COUNT):
        crop = canvas.crop((index * PANEL_W, 0, (index + 1) * PANEL_W, PANEL_H)).convert("RGB")
        crop.save(OUT_DIR / f"{index + 1:02d}-play-store.png", "PNG", optimize=True)


if __name__ == "__main__":
    make()
