"""Generate seed_products.json from tools.csv using manual grouping logic."""

import csv
import json
import re


def parse_csv(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(
                {
                    "number": int(r["Number"]),
                    "name": r["Name"].strip(),
                    "qty": int(r["Quantity"]),
                    "cost": float(r["Cost"]),
                    "price": float(r["Price"]),
                }
            )
    return rows


# ── Manual groups (same as analyze_products.py) ──
MANUAL_GROUPS = {
    "فرشاية دهان Agron": {
        "numbers": [1, 2, 3, 4, 5, 6, 7],
        "category": "فراشي",
        "trademark": "Agron",
    },
    "فرشاية Crown ابيض": {
        "numbers": [13, 14, 15, 16, 17, 18],
        "category": "فراشي",
        "trademark": "Crown",
    },
    "فرشاية Painto ازرق": {
        "numbers": [21, 22, 23, 24, 25, 26],
        "category": "فراشي",
        "trademark": "Painto",
    },
    "فرشاية Super Agron": {
        "numbers": [27, 28, 29, 30, 31],
        "category": "فراشي",
        "trademark": "Super Agron",
    },
    "فرشاية Max": {
        "numbers": [335, 336, 337, 338, 339, 340],
        "category": "فراشي",
        "trademark": "Max",
    },
    "فرشاية قلم": {
        "numbers": [32, 33, 34, 35, 36, 37, 500],
        "category": "فراشي",
        "trademark": "Agron",
    },
    "فرشاية Agron العلبة الصفراء": {
        "numbers": [10, 11, 12, 230, 231],
        "category": "فراشي",
        "trademark": "Agron",
    },
    "فرشاية Agron الاصلي": {
        "numbers": [251, 252, 253],
        "category": "فراشي",
        "trademark": "Agron",
    },
    "فرشاية بلوفا": {
        "numbers": [385, 386, 387, 388, 406, 407, 453],
        "category": "فراشي",
        "trademark": "بلوفا",
    },
    "فرشاية تيرا": {
        "numbers": [19, 20, 115, 116],
        "category": "فراشي",
        "trademark": "تيرا",
    },
    "فرشاية معكوفه": {
        "numbers": [39, 40, 41, 42],
        "category": "فراشي",
        "trademark": "",
    },
    "فرشاية طراشه": {"numbers": [43, 44, 45], "category": "فراشي", "trademark": ""},
    "رول طراشه A": {"numbers": [48, 50], "category": "رولات", "trademark": ""},
    "رول طراشه B": {"numbers": [34, 49], "category": "رولات", "trademark": ""},
    "رول بشكير": {"numbers": [51, 59], "category": "رولات", "trademark": ""},
    "رول اسفنج ابيض": {"numbers": [52, 60], "category": "رولات", "trademark": ""},
    "رول مبطن": {"numbers": [61, 62, 75, 76], "category": "رولات", "trademark": ""},
    "رول تكس": {"numbers": [63, 64, 82], "category": "رولات", "trademark": ""},
    "رول مهير": {"numbers": [53, 69, 70, 411], "category": "رولات", "trademark": ""},
    "طقم رولات": {
        "numbers": [54, 55, 56, 57, 58, 493],
        "category": "رولات",
        "trademark": "",
    },
    "يد رول": {"numbers": [181, 182], "category": "رولات", "trademark": ""},
    "رول تركي DOGRU": {
        "numbers": [260, 262, 334],
        "category": "رولات",
        "trademark": "DOGRU",
    },
    "مجراد عادي": {
        "numbers": [508, 132, 133, 134, 135, 136, 185, 186],
        "category": "مجاريد",
        "trademark": "",
    },
    "مجراد هايد": {
        "numbers": [272, 273, 274, 275, 276, 277, 278],
        "category": "مجاريد",
        "trademark": "هايد",
    },
    "مجراد هايد copy": {
        "numbers": [436, 437, 438, 439, 440, 441, 448],
        "category": "مجاريد",
        "trademark": "هايد",
    },
    "مجراد هايد Master كعب حديد": {
        "numbers": [496, 497, 498],
        "category": "مجاريد",
        "trademark": "Master Hyde",
    },
    "مجراد ستانلس": {"numbers": [404, 405], "category": "مجاريد", "trademark": ""},
    "سكتش عادي": {
        "numbers": [202, 203, 204, 205, 211, 212, 221, 222, 239, 246, 248],
        "category": "ورق حف",
        "trademark": "",
    },
    'سكتش 4.5"': {"numbers": [247, 366], "category": "ورق حف", "trademark": ""},
    "ورق اسفنج عادي": {
        "numbers": [207, 208, 209, 210, 234, 296],
        "category": "ورق حف",
        "trademark": "",
    },
    "ورق اسفنج سيا": {
        "numbers": [256, 257, 258, 259, 361, 367],
        "category": "ورق حف",
        "trademark": "سيا",
    },
    "نورتن اسفنج": {
        "numbers": [311, 312, 313, 315, 316],
        "category": "ورق حف",
        "trademark": "نورتن",
    },
    "ورق حف رول تمساح اسود": {
        "numbers": [269, 270, 271, 341, 343, 344, 345, 346],
        "category": "ورق حف",
        "trademark": "تمساح",
    },
    "ورق حف رول تمساح احمر": {
        "numbers": [284, 285, 292, 347, 348, 349, 350],
        "category": "ورق حف",
        "trademark": "تمساح",
    },
    "ورق حف رول كتان": {
        "numbers": [263, 264, 266],
        "category": "ورق حف",
        "trademark": "",
    },
    "تيب سم": {"numbers": [171, 173, 172, 452], "category": "تيب", "trademark": ""},
    "تيب 5سم": {
        "numbers": [175, 368, 198, 199, 219, 177, 486],
        "category": "تيب",
        "trademark": "",
    },
    "تيب عريض شفاف": {
        "numbers": [176, 310, 377, 449],
        "category": "تيب",
        "trademark": "",
    },
    "زاوية جبص": {"numbers": [168, 331], "category": "زوايا", "trademark": ""},
    "زاوية U": {"numbers": [303, 420], "category": "زوايا", "trademark": ""},
    "ستانسل Painto": {
        "numbers": [160, 161, 163, 158],
        "category": "ستانسل",
        "trademark": "Painto",
    },
    "عصا": {
        "numbers": [148, 149, 150, 151, 152, 153, 154],
        "category": "عصي",
        "trademark": "",
    },
    "ورق جبص": {"numbers": [169, 170, 288], "category": "ورق جبص", "trademark": "يوتا"},
    "فتحة صيانه": {
        "numbers": [462, 463, 464, 465, 466, 479, 480, 481, 495],
        "category": "فتحات صيانه",
        "trademark": "",
    },
    "مالج ملتينه Level5": {
        "numbers": [473, 474, 475, 476],
        "category": "موالج",
        "trademark": "Level5",
    },
    "نصلة Level5": {
        "numbers": [487, 488, 489, 490],
        "category": "موالج",
        "trademark": "Level5",
    },
    "فرد سلكون": {
        "numbers": [319, 330, 320, 369, 468],
        "category": "ادوات",
        "trademark": "",
    },
    "كمامة": {
        "numbers": [88, 314, 206, 235, 236, 355, 354, 353, 381],
        "category": "حماية",
        "trademark": "",
    },
    "كباية اسود": {"numbers": [391, 392, 393], "category": "كبايات", "trademark": ""},
    "كباية ازرق": {"numbers": [394, 395], "category": "كبايات", "trademark": ""},
    "براغي جبص": {
        "numbers": [245, 254, 432, 429, 471],
        "category": "براغي",
        "trademark": "",
    },
    "بوت صغير مشمع": {"numbers": [419, 422], "category": "احذية", "trademark": ""},
    "قشاطة ابوكسي": {"numbers": [501, 502], "category": "ادوات", "trademark": ""},
    "مالج ابوكسي": {"numbers": [503, 504], "category": "ادوات", "trademark": ""},
    "رول حواف": {"numbers": [491, 492], "category": "رولات", "trademark": ""},
    "سبري ATC": {
        "numbers": [309, 447, 450, 451],
        "category": "سبري",
        "trademark": "ATC",
    },
    "بويه تعتيق": {"numbers": [242, 243, 244], "category": "دهان", "trademark": ""},
    "ريشت يوتا": {"numbers": [167, 460], "category": "ريشت", "trademark": "يوتا"},
    "تنر ايطالي": {"numbers": [402, 413], "category": "مواد", "trademark": ""},
    "ورق فيبر": {"numbers": [233, 362], "category": "ورق حف", "trademark": ""},
    "شفرة تنظيف": {"numbers": [91, 92, 93], "category": "ادوات", "trademark": ""},
    "جلدة لازور": {
        "numbers": [103, 104, 105, 108, 224],
        "category": "جلود",
        "trademark": "",
    },
    "مالج Enox": {"numbers": [140, 141], "category": "موالج", "trademark": "Enox"},
    'رول 9" ماركات': {
        "numbers": [65, 66, 67, 68, 80],
        "category": "رولات",
        "trademark": "",
    },
    "سوبر جلو": {"numbers": [289, 290], "category": "لواصق", "trademark": ""},
    "مطبة كابرس": {
        "numbers": [118, 119, 156, 184],
        "category": "ديكور",
        "trademark": "كابرس",
    },
    "مطبة مدوره": {"numbers": [129, 130, 131], "category": "ديكور", "trademark": ""},
    "مشرط": {"numbers": [95, 94, 323, 321, 356], "category": "ادوات", "trademark": ""},
    "تكنه": {"numbers": [96, 145, 216, 281, 297], "category": "ادوات", "trademark": ""},
    "رول جومي": {"numbers": [73, 74, 79], "category": "رولات", "trademark": ""},
    "مالج ملتينه": {"numbers": [188, 189], "category": "موالج", "trademark": ""},
    "طقم لازور احمر": {"numbers": [106, 107], "category": "جلود", "trademark": ""},
    "منشار جبص": {"numbers": [249, 396], "category": "ادوات", "trademark": ""},
}

# ── English translations ──
NAME_EN = {
    "فرشاية دهان Agron": "Paint Brush Agron",
    "فرشاية Crown ابيض": "Paint Brush Crown White",
    "فرشاية Painto ازرق": "Paint Brush Painto Blue",
    "فرشاية Super Agron": "Paint Brush Super Agron",
    "فرشاية Max": "Paint Brush Max",
    "فرشاية قلم": "Liner Brush",
    "فرشاية Agron العلبة الصفراء": "Paint Brush Agron Yellow Box",
    "فرشاية Agron الاصلي": "Paint Brush Agron Original",
    "فرشاية بلوفا": "Paint Brush Bulova",
    "فرشاية تيرا": "Paint Brush Tera",
    "فرشاية معكوفه": "Angled Brush",
    "فرشاية طراشه": "Block Brush",
    "رول طراشه A": "Paint Roller A",
    "رول طراشه B": "Paint Roller B",
    "رول بشكير": "Terry Roller",
    "رول اسفنج ابيض": "White Sponge Roller",
    "رول مبطن": "Padded Roller",
    "رول تكس": "Texture Roller",
    "رول مهير": "Mohair Roller",
    "طقم رولات": "Roller Set",
    "يد رول": "Roller Handle",
    "رول تركي DOGRU": "Turkish Roller DOGRU",
    "مجراد عادي": "Spatula Standard",
    "مجراد هايد": "Spatula Hyde",
    "مجراد هايد copy": "Spatula Hyde Copy",
    "مجراد هايد Master كعب حديد": "Spatula Hyde Master Iron Heel",
    "مجراد ستانلس": "Stainless Steel Spatula",
    "سكتش عادي": "Sandpaper Standard",
    'سكتش 4.5"': 'Sandpaper 4.5"',
    "ورق اسفنج عادي": "Sponge Paper Standard",
    "ورق اسفنج سيا": "Sponge Paper Sia",
    "نورتن اسفنج": "Norton Sponge",
    "ورق حف رول تمساح اسود": "Crocodile Sanding Roll Black",
    "ورق حف رول تمساح احمر": "Crocodile Sanding Roll Red",
    "ورق حف رول كتان": "Linen Sanding Roll",
    "تيب سم": "Masking Tape Narrow",
    "تيب 5سم": "Masking Tape 5cm",
    "تيب عريض شفاف": "Wide Clear Tape",
    "زاوية جبص": "Plaster Corner Bead",
    "زاوية U": "U Corner Bead",
    "ستانسل Painto": "Stencil Painto",
    "عصا": "Extension Pole",
    "ورق جبص": "Drywall Joint Tape",
    "فتحة صيانه": "Access Panel",
    "مالج ملتينه Level5": "Finishing Trowel Level5",
    "نصلة Level5": "Blade Level5",
    "فرد سلكون": "Caulking Gun",
    "كمامة": "Mask",
    "كباية اسود": "Mixing Cup Black",
    "كباية ازرق": "Mixing Cup Blue",
    "براغي جبص": "Drywall Screws",
    "بوت صغير مشمع": "Kids Rain Boot",
    "قشاطة ابوكسي": "Epoxy Scraper",
    "مالج ابوكسي": "Epoxy Trowel",
    "رول حواف": "Edge Roller",
    "سبري ATC": "Spray Paint ATC",
    "بويه تعتيق": "Antiquing Paint",
    "ريشت يوتا": "Fiberglass Mesh Tape Yuta",
    "تنر ايطالي": "Italian Thinner",
    "ورق فيبر": "Fiber Paper",
    "شفرة تنظيف": "Cleaning Blade",
    "جلدة لازور": "Lazure Pad",
    "مالج Enox": "Trowel Enox",
    'رول 9" ماركات': '9" Roller Assorted Brands',
    "سوبر جلو": "Super Glue",
    "مطبة كابرس": "Decoration Stamp Caprice",
    "مطبة مدوره": "Round Stamp",
    "مشرط": "Utility Knife",
    "تكنه": "Paint Tray",
    "رول جومي": "Rubber Roller",
    "مالج ملتينه": "Finishing Trowel",
    "طقم لازور احمر": "Red Lazure Set",
    "منشار جبص": "Drywall Saw",
}

# ── Standalone translations (partial map for common Arabic words) ──
STANDALONE_EN = {
    8: 'Paint Brush 5" Agron',
    9: "Brush Set",
    46: 'Paint Roller 9"B',
    47: 'Paint Roller 10" Super',
    72: "Yellow Sponge Corner Roller",
    77: "Caprice Roller Chinese",
    78: "Caprice Roller Italian",
    80: 'Paint Roller 9" Akram',
    81: 'Roller Set 16" (3 Rollers + Handle)',
    83: "Sanding Block",
    84: "Hand Sander",
    85: "Telescopic Sander",
    86: "Paint Tray Set 10cm",
    87: "Metal Squeegee 10cm",
    88: "Filter Mask",
    89: "Safety Glasses",
    90: "Safety Earmuffs",
    94: "Rubber Utility Knife",
    96: 'Paint Tray 10"',
    97: "Super Wash Sponge",
    98: "Kids Stamp Set",
    99: "Single Kids Stamp",
    100: "Decorative Sticker",
    101: "Decorative Mirror",
    102: "Marbling Pad",
    109: "Plastic Trowel Beige",
    110: "Yellow Foam Trowel",
    111: "Spatula Set Foreman",
    112: "Italian Decorative Brush T",
    113: "Sponge Wash Mitt",
    114: "Sponge Wash Mitt with Brush",
    117: "Round Sponge Decoration Stamp",
    120: "Decoration Stamp 15x15 Italian",
    121: "Natural Sea Sponge",
    122: "Rose Sponge Italian",
    123: "Decorative Belt 13cm",
    124: "Decorative Belt 10cm",
    125: "Decorative Belt 5cm",
    126: "Crazy Stamp",
    127: "Caprice Leather Set Italian",
    128: "Rose Roller",
    137: "Sponge Hand Mitt for Decoration",
    138: "Gold Trowel",
    139: "French Trowel 20x8",
    142: "Plastic Decoration Trowel Italian",
    143: "Double Stucco Card",
    144: "Orange Stucco Card",
    146: "Brush / Stamp / Roller Set",
    147: "Super Texture Roller Machine",
    155: "Leather Embossing Hand Mitt Painto",
    157: "Deer Skin Decoration Pad",
    159: "A4 Stencil Double",
    162: "Border Stencil Painto",
    164: "Ornament Stencil",
    165: "Stencil 30x45",
    166: "Nylon Film 5m",
    174: "Tape 4cm",
    178: "Adhesive Powder 125g German",
    179: "Supermarket Tape Monta",
    180: 'Turkon Paint Roller 10"',
    187: "Kabriol Trowel",
    190: "Welding Rods 3.25mm DOZ",
    191: "Welding Rods 2.5mm DOZ",
    192: "Nylon Film 50cm x 25m",
    193: "Decorative Wool Bag",
    194: "Wide Adhesive 100 Yards",
    195: "Tape 2cm Blue Line",
    196: "Utility Knife Blade Set",
    197: "Fiba Fuse 152.3m",
    200: "Asphalt Brush Plastic",
    201: "Scissors Aroa Taiwanese",
    213: "Tin Snips German",
    214: "Rope Tying Machine",
    215: "12 Liter Bucket",
    217: 'Decoration Roller 10" Dekor',
    218: "Brown Tape 5cm 120 Yards",
    220: "Tape 2.5cm Blue Line",
    223: "Large Sponge Decoration Stamp",
    225: "Adhesive Machine",
    226: "Pier Block Brush 100/9",
    227: "Nail Sandal (Epoxy)",
    228: "Epoxy Spike Roller",
    229: "Epoxy Spike Roller",
    232: 'Cage Handle 9"',
    237: "Tin Snips",
    238: "Tape 5cm 20m",
    240: "Paint Gun 4001S",
    241: "Glue Gun 4001G",
    250: "Tera Card + Brush Set",
    255: "Fiba Fuse 76.2m",
    261: "Turkish Roller 1017 DOGRU",
    265: "Clear Tape 5cm 30 Yards",
    267: "Lens Head Screws (5000x1)",
    268: "Block Brush 7x17 Bulova",
    279: "Red Glass Paper",
    280: "Yellow Glass Paper",
    282: "Double Bag Wedges (1x1000)",
    283: "Herbol",
    286: 'Sandpaper 9"',
    287: "Corner Bead L with Paper 3m",
    291: "Sponge Paper (Blue Line) 240",
    293: 'Sandpaper 9" German',
    294: "Blue Crack Filler 5kg",
    295: "Green Plaster Filler 1kg",
    298: "Plastic Telescopic Sander",
    299: 'Turkon Set 10"',
    300: 'Agron Set 9"',
    301: "Plastic Corner Bead 2.8m",
    302: "Aluminum Corner Bead 3m",
    304: "Sponge Paper 240 Hormoz",
    305: "Tin Snips Wiss",
    306: 'Spatula 6" Hyde (Norsta)',
    307: 'Spatula 8" Hyde Norsta',
    308: "Double Bag (100x1) Wurth",
    317: "Sanding Roll 120 Black Lala",
    318: "Plaster Corner Bead Lala",
    322: "Notched Adhesive Trowel",
    324: "Block Brush 1406",
    325: "Grout Trowel 5x25 Italian",
    326: "Sponge Paper 220",
    327: "Bright Sandpaper for Tile Grout",
    328: "Paint Strainer Set 2x1",
    329: "Angled Hyde Spatula",
    332: "Redback Work Boot",
    333: "Sparkle 1kg",
    342: "Sanding Paper 10m Crocodile Black 100",
    351: "Metal Cutting Fiber Disc",
    352: 'Spatula 6" Hyde Iron Heel',
    357: "Standard Trowel MS",
    358: "Cleaning Blade Orange Handle MS",
    359: "Small Drywall Rasp",
    360: "Large Drywall Rasp",
    363: "Brush 3x7 Bulova",
    364: "Brush 3x10 Bulova",
    365: "Brush 3x12 Bulova",
    370: "Drywall Screws 2.5 Drill Point",
    371: "Drywall Screws Drill Point Pan Head",
    372: "Italian Grout 5kg",
    373: "Rubber Grout Trowel",
    374: "German Finishing Roller Frees",
    375: "Water Glass Hydroseal 5kg",
    376: "Sandpaper 280",
    378: 'Sandpaper 9" Japanese',
    379: 'Metal Cutting Fiber 9" Norton',
    380: "Hollow Drill Bit",
    382: "American Chalk Gun",
    383: "Screws 3.5",
    384: "Screws 4.5",
    389: "Silicone",
    390: "Screws 7cm",
    397: "Utility Knife Blade Set Assist",
    398: "Cup Set 9 Pieces",
    399: "Tin Snips Stanley",
    400: "Tin Snips Narrow Nose",
    401: "Pencil Card",
    403: 'Plastic Frame Sandpaper 4.5"',
    408: "Liner Brush Set",
    409: 'Plastic Frame Sandpaper 6"',
    410: "Adhesive Powder 200g",
    412: "Superall Adhesive Finger",
    414: "L Corner 3cm x 3cm",
    415: "Blundstone Work Boot Large 40-46",
    416: "Redback Work Boot with Steel Toe",
    417: "Mid Work Boot 36-39 Leather",
    418: "Kids Leather Boot 28-35",
    421: "Broom Pole 1.4m",
    423: "Miter Saw for Corners",
    424: "Magic Steel",
    425: "Transparent Boxpol",
    426: "Blue Chalk Line",
    428: "L Corner with Sheetrock Paper",
    430: "Lens Screws 500 (Small Box)",
    431: "Decoration Roller 10cm",
    433: "Loofah Brush",
    434: "Terry Roller 10cm DOGRU",
    435: "Roller 10cm + Handle Turkish DOGRU",
    442: "Adhesive Powder 175g",
    443: "Square Decoration Brush",
    444: "Clear Plastic Trowel",
    445: "Drain Snake",
    446: "Brush 3x12 Agron Original",
    455: "Plastering Hawk",
    456: "Plastering Float",
    457: "Fiba Fuse 76.2 European",
    458: "Herbol Universal",
    459: "Terry Decoration Roller 10cm DEKOR",
    461: "Paint Strainer Set (2x1) ALOFOK",
    467: 'Angled Screw Brush 3"',
    469: "Flashlight Lux",
    470: "Caulking Gun KAPRO",
    472: "Trowel Set Bag 6 Pieces",
    477: 'Finishing Roller 9" Level5',
    478: "Finishing Trowel Handle Level5",
    482: "Access Panel Hinges",
    483: 'Paint Roller 10" Bulova',
    484: 'Decoration Roller 10" 1081 (Copy)',
    485: "American Fiber 76m",
    494: "Grout Syringe Hose",
    499: "Shadow Corner Z (Bass Netok)",
    505: 'Decoration Roller 10" 1017 (Copy)',
    506: "Tape 2cm 45m",
    507: "Angled Spatula Alofok",
    427: "Scrubber",
    454: 'Sandpaper 17" for Tile Polishing',
}


def extract_size_label(name, group_name):
    """Extract clean size label from product name."""
    # Inch sizes
    m = re.search(r'(\d+/\d+\s+\d+|\d+/\d+|\d+\.?\d*)\s*"', name)
    if m:
        raw = m.group(1).strip()
        # Convert fractions: 1/2 1 -> 1½, 1/2 2 -> 2½, 1/2 -> ½
        if " " in raw:
            parts = raw.split()
            frac = parts[0]
            whole = parts[1]
            frac_map = {"1/2": "\u00bd", "1/4": "\u00bc", "3/4": "\u00be"}
            frac_char = frac_map.get(frac, frac)
            return f'{whole}{frac_char}"'
        elif "/" in raw:
            frac_map = {"1/2": "\u00bd", "1/4": "\u00bc", "3/4": "\u00be"}
            return f'{frac_map.get(raw, raw)}"'
        return f'{raw}"'

    # No. sizes (for Max brushes)
    m = re.search(r"No\.?\s*(\d+\.?\d*)", name)
    if m:
        return f"No.{m.group(1)}"

    # Hash sizes (liner brushes)
    m = re.search(r"(\d+)\s*#", name)
    if m:
        return f"#{m.group(1)}"

    # Dimension sizes like 10*3, 3*12, 15*5, 20*20
    m = re.search(r"(\d+)\s*[*×x]\s*(\d+)", name)
    if m:
        return f"{m.group(1)}\u00d7{m.group(2)}"

    # CM sizes
    m = re.search(r"(\d+)\s*سم", name)
    if m:
        return f"{m.group(1)}سم"

    # Meter sizes
    m = re.search(r"(\d+\.?\d*)\s*م(?!\w)", name)
    if m:
        return f"{m.group(1)}م"

    # KG sizes
    m = re.search(r"(\d+\.?\d*)\s*كغم?", name)
    if m:
        return f"{m.group(1)}كغم"

    # Liter sizes
    m = re.search(r"(\d+\.?\d*)\s*لتر", name)
    if m:
        return f"{m.group(1)}لتر"

    # Grit numbers (2-3 digit standalone)
    m = re.search(r"\b(\d{2,3})\b", name)
    if m:
        return f"#{m.group(1)}"

    # Yard counts
    m = re.search(r"(\d+)\s*يارد", name)
    if m:
        return f"{m.group(1)} يارد"

    # Fallback: use the full name
    return name


def guess_standalone_en(number, name_ar):
    """Return English name from map or fallback to Arabic."""
    if number in STANDALONE_EN:
        return STANDALONE_EN[number]
    return name_ar


def main():
    rows = parse_csv("tools.csv")
    by_number = {r["number"]: r for r in rows}

    grouped_numbers = set()
    products = []

    # Process grouped products
    for group_name, config in MANUAL_GROUPS.items():
        members = []
        for num in config["numbers"]:
            if num in by_number:
                row = by_number[num]
                label = extract_size_label(row["name"], group_name)
                members.append(
                    {
                        "label": label,
                        "price": round(row["price"], 2),
                        "cost": round(row["cost"], 2),
                        "quantity": max(row["qty"], 0),
                    }
                )
                grouped_numbers.add(num)

        if not members:
            continue

        members.sort(key=lambda x: x["price"])
        cheapest = members[0]

        products.append(
            {
                "name_ar": group_name,
                "name_en": NAME_EN.get(group_name, group_name),
                "category": config["category"],
                "trademark": config["trademark"],
                "price": cheapest["price"],
                "purchase_price": cheapest["cost"],
                "stock_qty": None,
                "unit": "piece",
                "options": [
                    {
                        "name": "الحجم",
                        "values": members,
                    }
                ],
            }
        )

    # Process standalone products
    for row in rows:
        if row["number"] in grouped_numbers:
            continue
        products.append(
            {
                "name_ar": row["name"],
                "name_en": guess_standalone_en(row["number"], row["name"]),
                "category": "",
                "trademark": "",
                "price": round(row["price"], 2),
                "purchase_price": round(row["cost"], 2),
                "stock_qty": max(row["qty"], 0),
                "unit": "piece",
                "options": None,
            }
        )

    # Write JSON
    with open("scripts/seed_products.json", "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    print(
        f"Generated {len(products)} products ({sum(1 for p in products if p['options'])} grouped, {sum(1 for p in products if not p['options'])} standalone)"
    )


if __name__ == "__main__":
    main()
