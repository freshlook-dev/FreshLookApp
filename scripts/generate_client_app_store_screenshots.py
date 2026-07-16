from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path("screenshots/client-app/app-store-6.5-inch")
W, H = 1242, 2688

C = {
    "bg": "#FAF8F4",
    "card": "#FFFFFF",
    "elevated": "#FFFDF9",
    "text": "#241F18",
    "muted": "#7B7167",
    "border": "#E8DCCA",
    "primary": "#C9A24D",
    "primary_dark": "#8A6B25",
    "primary_soft": "#F1E3BE",
    "red": "#C2413D",
}

FONT_DIR = Path("C:/Windows/Fonts")

def font(size, bold=False):
    name = "arialbd.ttf" if bold else "arial.ttf"
    return ImageFont.truetype(str(FONT_DIR / name), size)

def wrap(text, max_chars):
    words = str(text).split()
    lines, line = [], ""
    for word in words:
        test = f"{line} {word}".strip()
        if len(test) > max_chars and line:
            lines.append(line)
            line = word
        else:
            line = test
    if line:
        lines.append(line)
    return lines

def text(draw, xy, value, size=36, fill=None, bold=False, max_chars=None, line_h=None, anchor=None):
    fill = fill or C["text"]
    x, y = xy
    f = font(size, bold)
    if max_chars:
        line_h = line_h or int(size * 1.28)
        for i, line in enumerate(wrap(value, max_chars)):
            draw.text((x, y + i * line_h), line, font=f, fill=fill, anchor=anchor)
    else:
        draw.text((x, y), value, font=f, fill=fill, anchor=anchor)

def rounded(draw, box, radius=34, fill=None, outline=None, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill or C["card"], outline=outline or C["border"], width=width)

def pill(draw, box, label, active=False):
    fill = C["primary"] if active else C["elevated"]
    outline = C["primary"] if active else C["border"]
    rounded(draw, box, radius=(box[3] - box[1]) // 2, fill=fill, outline=outline)
    text(draw, ((box[0] + box[2]) // 2, (box[1] + box[3]) // 2 + 12), label, 32, "#FFFFFF" if active else C["text"], True, anchor="mm")

def top(draw, title):
    draw.rectangle((0, 0, W, 132), fill=C["bg"])
    text(draw, (72, 70), "MY FRESH LOOK", 28, C["primary_dark"], True)
    text(draw, (W - 72, 70), title, 30, C["text"], True, anchor="ra")

def header(draw, eyebrow, title_value, subtitle):
    text(draw, (72, 175), eyebrow.upper(), 26, C["primary_dark"], True)
    text(draw, (72, 250), title_value, 72, C["text"], True, 20, 82)
    text(draw, (72, 430), subtitle, 32, C["muted"], False, 46, 42)

def nav(draw, active):
    tabs = [
        ("home", "Kryefaqja"),
        ("shop", "Produktet"),
        ("visits", "Vizitat"),
        ("rewards", "Shpërblimet"),
        ("profile", "Profili"),
    ]
    x0, y, w, h = 60, 2444, W - 120, 160
    rounded(draw, (x0, y, x0 + w, y + h), 54, "#FFFFFF", C["border"])
    item_w = w / len(tabs)
    for i, (key, label) in enumerate(tabs):
        cx = int(x0 + item_w * i + item_w / 2)
        is_active = key == active
        draw.ellipse((cx - 34, y + 20, cx + 34, y + 88), fill=C["primary_soft"] if is_active else "#F4EFE7")
        text(draw, (cx, y + 64), str(i + 1), 31, C["primary_dark"] if is_active else C["muted"], True, anchor="mm")
        text(draw, (cx, y + 122), label, 24, C["primary_dark"] if is_active else C["muted"], True, anchor="mm")

def service_card(draw, y, name, meta, active=False):
    rounded(draw, (72, y, 1170, y + 150), 34, "#FFF8E8" if active else C["card"], C["border"])
    text(draw, (116, y + 42), name, 36, C["text"], True)
    text(draw, (116, y + 94), meta, 28, C["muted"], True)
    draw.ellipse((1079, y + 44, 1141, y + 106), fill=C["primary"] if active else C["elevated"], outline=C["primary"] if active else C["border"], width=3)
    if active:
        draw.line((1095, y + 76, 1107, y + 89, 1127, y + 62), fill="#FFFFFF", width=8, joint="curve")

def time_chip(draw, x, y, label, state="free"):
    active = state == "active"
    disabled = state == "disabled"
    fill = C["primary"] if active else C["card"]
    rounded(draw, (x, y, x + 225, y + 104), 28, fill, C["primary"] if active else C["border"])
    if disabled:
        overlay = Image.new("RGBA", (225, 104), (250, 248, 244, 150))
        draw._image.paste(overlay, (x, y), overlay)
    text(draw, (x + 112, y + 43), label, 31, "#FFFFFF" if active else C["text"], True, anchor="mm")
    if disabled:
        text(draw, (x + 112, y + 78), "E kaluar", 18, C["muted"], True, anchor="mm")

def base(title, active):
    img = Image.new("RGB", (W, H), C["bg"])
    d = ImageDraw.Draw(img)
    top(d, title)
    nav(d, active)
    return img, d

def save(img, name):
    img.save(OUT_DIR / name, "PNG", optimize=True)

def make():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for p in OUT_DIR.glob("*.png"):
        p.unlink()

    img, d = base("Kryefaqja", "home")
    header(d, "Fresh Look", "Bukuria juaj, gjithmonë pranë", "Rezervo termine, ndiq vizitat dhe porosit produkte nga një aplikacion i vetëm.")
    rounded(d, (72, 560, 1170, 738), 44, C["primary"], C["primary"])
    text(d, (621, 650), "Rezervo termin të ri", 44, "#FFFFFF", True, anchor="mm")
    rounded(d, (72, 820, 1170, 1180), 44, "#E0BC60", "#D1AE54")
    text(d, (126, 900), "Fresh Points", 36, "#2B2111", True)
    text(d, (126, 1020), "640", 110, "#15110B", True)
    d.line((126, 1086, 1112, 1086), fill="#9E7A2C", width=2)
    text(d, (126, 1142), "Balanca e anëtarit", 31, "#33260E", True)
    text(d, (878, 1142), "Shpërblimet →", 31, "#33260E", True)
    text(d, (72, 1308), "ORARI JUAJ", 28, C["primary_dark"], True)
    text(d, (72, 1372), "Vizita e ardhshme", 54, C["text"], True)
    rounded(d, (72, 1438, 1170, 1763), 44, C["card"], C["border"])
    text(d, (126, 1530), "Laser Carbon Peeling", 38, C["text"], True)
    text(d, (126, 1590), "Sot · 18:00 · Prishtinë", 30, C["muted"], True)
    pill(d, (126, 1640, 376, 1712), "Në ardhje", False)
    save(img, "01-home.png")

    img, d = base("Rezervo", "visits")
    header(d, "Terminet", "Zgjidhni disa shërbime", "Lista është e renditur njësoj si në Fresh Look web dhe mund të zgjidhni më shumë se një trajtim.")
    service_card(d, 560, "Pastrimi Profesional i Fytyrës", "60 min · 40 EUR", True)
    service_card(d, 735, "Laser Carbon Peeling", "60 min · 50 EUR", True)
    service_card(d, 910, "Heqja e Qimeve me Laser", "30 min · 100 EUR")
    service_card(d, 1085, "Heqja e Tatuazhit me Laser", "30 min · 40 EUR")
    service_card(d, 1260, "EMS Formësim Trupi", "30 min · 50 EUR", True)
    rounded(d, (72, 1495, 1170, 1815), 40, "#FFF8E8", C["border"])
    text(d, (126, 1560), "TË ZGJEDHURA", 25, C["primary_dark"], True)
    text(d, (126, 1625), "Pastrimi Profesional i Fytyrës, Laser Carbon Peeling, EMS Formësim Trupi", 34, C["text"], True, 43, 44)
    text(d, (126, 1720), "150 min gjithsej · 140.00 EUR", 29, C["muted"], True)
    save(img, "02-book-treatments.png")

    img, d = base("Data & Ora", "visits")
    header(d, "Terminet", "Zgjidhni vetëm oraret e lira", "Datat dhe oraret e kaluara bllokohen automatikisht. Rezervimi lejohet të paktën 30 minuta më vonë.")
    rounded(d, (72, 560, 1170, 710), 34, C["card"], C["border"])
    text(d, (126, 635), "28 Qershor 2026", 38, C["text"], True)
    pill(d, (72, 760, 592, 848), "Prishtinë", True)
    pill(d, (628, 760, 1170, 848), "Fushë Kosovë")
    for x, y, label, state in [
        (72, 930, "09:00", "disabled"), (342, 930, "10:00", "disabled"), (612, 930, "11:00", "disabled"), (882, 930, "12:00", "disabled"),
        (72, 1070, "13:00", "disabled"), (342, 1070, "14:00", "free"), (612, 1070, "15:00", "free"), (882, 1070, "16:00", "free"),
        (72, 1210, "17:00", "free"), (342, 1210, "18:00", "active"), (612, 1210, "19:00", "free"), (882, 1210, "20:00", "free"),
    ]:
        time_chip(d, x, y, label, state)
    rounded(d, (72, 1425, 1170, 1645), 40, "#F7EFE1", C["border"])
    text(d, (126, 1500), "Rregull i ri", 35, C["text"], True)
    text(d, (126, 1560), "Klienti nuk mund të klikojë datë ose orë që ka kaluar.", 30, C["muted"], True, 48, 40)
    save(img, "03-book-time.png")

    img, d = base("Vizitat", "visits")
    header(d, "Vizitat", "Ndryshoni terminin kur duhet", "Shikoni vizitat e ardhshme dhe përditësoni datën, orën, lokacionin ose shënimin.")
    pill(d, (72, 540, 592, 622), "Në ardhje 2", True)
    pill(d, (628, 540, 1170, 622), "Historiku")
    rounded(d, (72, 690, 1170, 1020), 44, C["card"], C["border"])
    text(d, (126, 780), "Pastrimi Profesional i Fytyrës", 40, C["text"], True)
    text(d, (126, 840), "18:00 · Prishtinë", 31, C["muted"], True)
    pill(d, (126, 900, 376, 972), "Ndrysho")
    rounded(d, (72, 1090, 1170, 1790), 46, "#FFFFFF", C["border"])
    text(d, (126, 1170), "MODALI", 26, C["primary_dark"], True)
    text(d, (126, 1230), "Ndrysho terminin", 45, C["text"], True)
    pill(d, (126, 1300, 576, 1376), "Prishtinë", True)
    pill(d, (610, 1300, 1080, 1376), "Fushë Kosovë")
    time_chip(d, 126, 1430, "18:00", "active")
    time_chip(d, 386, 1430, "19:00")
    time_chip(d, 646, 1430, "20:00")
    rounded(d, (126, 1590, 1080, 1682), 26, C["primary"], C["primary"])
    text(d, (603, 1636), "Ruaj ndryshimet", 32, "#FFFFFF", True, anchor="mm")
    rounded(d, (126, 1705, 1080, 1797), 26, "#FFFFFF", C["red"])
    text(d, (603, 1751), "Anulo terminin", 32, C["red"], True, anchor="mm")
    save(img, "04-visits-edit.png")

    img, d = base("Produktet", "shop")
    header(d, "Dyqani", "Produktet Fresh Look në aplikacion", "Shfletoni produkte, shtoni në shportë dhe porositni me të njëjtën databazë si web.")
    for x, name, price, fill in [(72, "Serum Glow", "24.00 EUR", "#EFE3CF"), (658, "Krem Premium", "18.00 EUR", "#F2D79F")]:
        rounded(d, (x, 560, x + 512, 1080), 38, C["card"], C["border"])
        rounded(d, (x + 54, 620, x + 458, 870), 34, fill, fill)
        text(d, (x + 54, 910), name, 34, C["text"], True)
        text(d, (x + 54, 960), price, 31, C["primary_dark"], True)
        rounded(d, (x + 54, 1018, x + 354, 1074), 20, C["primary"], C["primary"])
        text(d, (x + 204, 1046), "Shto", 24, "#FFFFFF", True, anchor="mm")
    rounded(d, (72, 1160, 1170, 1410), 40, "#FFF8E8", C["border"])
    text(d, (126, 1240), "Shporta juaj", 38, C["text"], True)
    text(d, (126, 1302), "2 produkte · 42.00 EUR", 31, C["muted"], True)
    text(d, (970, 1302), "Hape →", 31, C["primary_dark"], True)
    save(img, "05-products.png")

    img, d = base("Shporta", "shop")
    header(d, "Porositë", "Porositni produktet me lehtësi", "Kontrolloni shportën, sasinë dhe detajet para konfirmimit.")
    for y, name, price in [(560, "Serum Glow", "24.00"), (790, "Krem Premium", "18.00")]:
        rounded(d, (72, y, 1170, y + 190), 38, C["card"], C["border"])
        text(d, (126, y + 72), name, 38, C["text"], True)
        text(d, (126, y + 132), f"1 × {price} EUR", 30, C["muted"], True)
        text(d, (1020, y + 96), price, 34, C["primary_dark"], True, anchor="ra")
    rounded(d, (72, 1100, 1170, 1520), 44, "#FFFFFF", C["border"])
    text(d, (126, 1180), "Detajet e porosisë", 40, C["text"], True)
    text(d, (126, 1260), "Emri dhe mbiemri", 31, C["muted"], True)
    rounded(d, (126, 1290, 1116, 1366), 22, C["bg"], C["border"])
    text(d, (126, 1440), "Totali", 36, C["text"], True)
    text(d, (1080, 1440), "42.00 EUR", 42, C["primary_dark"], True, anchor="ra")
    rounded(d, (72, 1600, 1170, 1696), 30, C["primary"], C["primary"])
    text(d, (621, 1648), "Konfirmo porosinë", 35, "#FFFFFF", True, anchor="mm")
    save(img, "06-cart-checkout.png")

    img, d = base("Shpërblimet", "rewards")
    header(d, "Fresh Points", "Shpërblime për klientët", "Krijoni QR për zbritje dhe ndiqni shpërblimet aktive në profilin tuaj.")
    rounded(d, (72, 560, 1170, 1030), 50, "#DDBB5F", "#D1AE54")
    text(d, (126, 650), "Balanca juaj", 39, "#2B2111", True)
    text(d, (126, 810), "640", 138, "#15110B", True)
    text(d, (126, 930), "Vlerë e përafërt: 64.00 EUR", 33, "#3E2C0D", True)
    rounded(d, (72, 1110, 1170, 1208), 32, C["primary"], C["primary"])
    text(d, (621, 1159), "Krijo QR për shpërblim", 35, "#FFFFFF", True, anchor="mm")
    rounded(d, (72, 1310, 1170, 1570), 42, C["card"], C["border"])
    text(d, (126, 1400), "QR aktiv", 39, C["text"], True)
    text(d, (126, 1460), "100 pikë · Pa skadim", 31, C["muted"], True)
    pill(d, (880, 1370, 1050, 1462), "Aktiv")
    save(img, "07-rewards.png")

    img, d = base("Profili", "profile")
    header(d, "Profili", "Menaxhoni llogarinë me qetësi", "Profili është ndarë në grupe të qarta për siguri, ndihmë dhe preferenca.")
    rounded(d, (72, 550, 1170, 800), 46, C["card"], C["border"])
    d.ellipse((112, 617, 228, 733), fill=C["primary_soft"])
    text(d, (170, 675), "F", 46, C["primary_dark"], True, anchor="mm")
    text(d, (260, 650), "Fresh Client", 42, C["text"], True)
    text(d, (260, 705), "client@freshlook.com", 29, C["muted"], True)
    rounded(d, (72, 900, 1170, 1370), 42, C["card"], C["border"])
    text(d, (126, 975), "PROFILI DHE SIGURIA", 26, C["primary_dark"], True)
    for i, row in enumerate(["Menaxho profilin", "Fjalëkalimi dhe siguria", "Pamja e aplikacionit", "Qendra e ndihmës"]):
        text(d, (126, 1055 + i * 70), row, 36, C["text"], True)
    rounded(d, (72, 1460, 1170, 1630), 42, "#FFF5F5", "#F0CACA")
    text(d, (126, 1545), "Dil nga llogaria", 37, C["red"], True)
    save(img, "08-profile.png")

    img, d = base("Siguria", "profile")
    header(d, "Siguria", "Veprime të mbrojtura me konfirmim", "Dalja dhe fshirja e llogarisë kërkojnë konfirmim, që të mos ndodhin aksidentalisht.")
    rounded(d, (72, 560, 1170, 920), 44, C["card"], C["border"])
    text(d, (126, 650), "Menaxho profilin", 40, C["text"], True)
    text(d, (126, 715), "Të dhënat personale dhe veprimet e llogarisë.", 31, C["muted"], True)
    rounded(d, (126, 790, 1116, 874), 26, "#FFF4F4", "#F0CACA")
    text(d, (621, 832), "Fshi llogarinë", 32, C["red"], True, anchor="mm")
    rounded(d, (72, 1035, 1170, 1545), 44, "#FFFFFF", C["border"])
    text(d, (126, 1120), "Konfirmim", 42, C["text"], True)
    text(d, (126, 1190), "Për të vazhduar, shkruani emailin tuaj dhe konfirmoni veprimin.", 31, C["muted"], True, 44, 42)
    rounded(d, (126, 1320, 1116, 1408), 26, C["bg"], C["border"])
    text(d, (156, 1376), "email@shembull.com", 29, C["muted"], True)
    rounded(d, (126, 1440, 1116, 1526), 26, C["red"], C["red"])
    text(d, (621, 1483), "Konfirmo", 32, "#FFFFFF", True, anchor="mm")
    save(img, "09-settings-security.png")

    img, d = base("Sukses", "shop")
    header(d, "Sukses", "Gjithçka u krye me sukses", "Rezervimet, porositë dhe shpërblimet ruhen në profilin tuaj Fresh Look.")
    d.ellipse((461, 600, 781, 920), fill=C["primary_soft"])
    d.ellipse((516, 655, 726, 865), fill=C["primary"])
    d.line((565, 765, 607, 808, 690, 700), fill="#FFFFFF", width=22, joint="curve")
    text(d, (621, 1010), "Porosia u pranua", 58, C["text"], True, anchor="mm")
    text(d, (190, 1090), "Stafi do të përgatisë porosinë dhe do t’ju kontaktojë nëse nevojitet.", 34, C["muted"], True, 37, 48)
    rounded(d, (72, 1320, 1170, 1620), 44, C["card"], C["border"])
    text(d, (126, 1410), "Përmbledhje", 38, C["text"], True)
    text(d, (126, 1480), "2 produkte · 42.00 EUR", 31, C["muted"], True)
    text(d, (126, 1540), "Statusi: Në pritje", 31, C["muted"], True)
    rounded(d, (72, 1720, 1170, 1816), 30, C["primary"], C["primary"])
    text(d, (621, 1768), "Kthehu në kryefaqe", 35, "#FFFFFF", True, anchor="mm")
    save(img, "10-order-success.png")

if __name__ == "__main__":
    make()
