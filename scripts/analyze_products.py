"""Analyze tools.csv to identify product families (variants of the same product)."""
import csv
import re
from collections import defaultdict

def parse_csv(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append({
                "number": int(r["Number"]),
                "name": r["Name"].strip(),
                "qty": int(r["Quantity"]),
                "cost": float(r["Cost"]),
                "price": float(r["Price"]),
            })
    return rows

# Size patterns to extract from names
SIZE_PATTERNS = [
    # Inch sizes like 1/2", 1", 1/2 1", 2", etc.
    (r'(\d+/\d+\s+\d+|\d+/\d+|\d+\.?\d*)\s*"', "inch"),
    # Hash sizes like 3#, 4#
    (r'(\d+)\s*#', "hash"),
    # Numbered sizes like No. 1, No. 2.5
    (r'No\.?\s*(\d+\.?\d*)', "no"),
    # CM sizes like 10سم, 15سم
    (r'(\d+)\s*سم', "cm"),
    # Dimension sizes like 7*17, 15*15, 20*20
    (r'(\d+\*\d+)', "dim"),
    # Meter sizes like 25م, 50م, 75م (but not سم)
    (r'(?<!سم\s)(?<!s)(\d+)\s*م(?!ل|ت|ج|ش|ع|ق|ك|ن|ح|ر|د|ب|ز|و|ا|ي|ل|س|ف|ه|خ|ص|ض|ط|ظ|غ)', "m"),
    # Kg sizes like 1 كغم, 5 كغم
    (r'(\d+\.?\d*)\s*كغم?', "kg"),
    # Liter sizes like 1 لتر, 5 لتر
    (r'(\d+\.?\d*)\s*لتر', "liter"),
    # Grit numbers for sandpaper (standalone 3-digit numbers)
    (r'\b(\d{2,3})\b', "grit"),
]

def extract_size(name):
    """Try to extract a size/variant indicator from a product name."""
    # Try inch first (most common for brushes)
    m = re.search(r'(\d+/\d+\s+\d+|\d+/\d+|\d+\.?\d*)\s*"', name)
    if m:
        return m.group(1).strip() + '"', m.start(), m.end()

    m = re.search(r'(\d+)\s*#', name)
    if m:
        return m.group(1) + '#', m.start(), m.end()

    m = re.search(r'No\.?\s*(\d+\.?\d*)', name)
    if m:
        return 'No.' + m.group(1), m.start(), m.end()

    return None, -1, -1

def normalize_name(name, size_start, size_end):
    """Remove the size portion from a name to get the base product name."""
    if size_start >= 0:
        base = name[:size_start] + name[size_end:]
        # Clean up extra spaces
        base = re.sub(r'\s+', ' ', base).strip()
        return base
    return name

# ── Manual grouping rules (based on domain knowledge of the CSV) ──
# Each rule: (group_name, category, trademark, pattern_to_match_names, size_extraction_method)

MANUAL_GROUPS = {
    # Brushes by brand with inch sizes
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
    "فرشاية طراشه": {
        "numbers": [43, 44, 45],
        "category": "فراشي",
        "trademark": "",
    },

    # Rollers
    "رول طراشه A": {
        "numbers": [48, 50],
        "category": "رولات",
        "trademark": "",
    },
    "رول طراشه B": {
        "numbers": [34, 49],  # 34 is 9"B, 49 is 10"B
        "category": "رولات",
        "trademark": "",
    },
    "رول بشكير": {
        "numbers": [51, 59],
        "category": "رولات",
        "trademark": "",
    },
    "رول اسفنج ابيض": {
        "numbers": [52, 60],
        "category": "رولات",
        "trademark": "",
    },
    "رول مبطن": {
        "numbers": [61, 62, 75, 76],
        "category": "رولات",
        "trademark": "",
    },
    "رول تكس": {
        "numbers": [63, 64, 82],
        "category": "رولات",
        "trademark": "",
    },
    "رول مهير": {
        "numbers": [53, 69, 70, 411],
        "category": "رولات",
        "trademark": "",
    },
    "طقم رولات": {
        "numbers": [54, 55, 56, 57, 58, 493],
        "category": "رولات",
        "trademark": "",
    },
    "يد رول": {
        "numbers": [181, 182],
        "category": "رولات",
        "trademark": "",
    },
    "رول تركي DOGRU": {
        "numbers": [260, 262, 334],
        "category": "رولات",
        "trademark": "DOGRU",
    },

    # Spatulas (مجراد)
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
    "مجراد ستانلس": {
        "numbers": [404, 405],
        "category": "مجاريد",
        "trademark": "",
    },

    # Sandpaper (سكتش)
    "سكتش عادي": {
        "numbers": [202, 203, 204, 205, 211, 212, 221, 222, 239, 246, 248],
        "category": "ورق حف",
        "trademark": "",
    },
    "سكتش 4.5\"": {
        "numbers": [247, 366],
        "category": "ورق حف",
        "trademark": "",
    },

    # Sponge paper (ورق اسفنج)
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

    # Crocodile sandpaper rolls
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

    # Tape (تيب)
    "تيب سم": {
        "numbers": [171, 173, 172, 452],
        "category": "تيب",
        "trademark": "",
    },
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

    # Plaster corner / angle
    "زاوية جبص": {
        "numbers": [168, 331],
        "category": "زوايا",
        "trademark": "",
    },
    "زاوية U": {
        "numbers": [303, 420],
        "category": "زوايا",
        "trademark": "",
    },

    # Stencils
    "ستانسل Painto": {
        "numbers": [160, 161, 163, 158],
        "category": "ستانسل",
        "trademark": "Painto",
    },

    # Poles (عصا)
    "عصا": {
        "numbers": [148, 149, 150, 151, 152, 153, 154],
        "category": "عصي",
        "trademark": "",
    },

    # Plaster paper (ورق جبص)
    "ورق جبص": {
        "numbers": [169, 170, 288],
        "category": "ورق جبص",
        "trademark": "يوتا",
    },

    # Access panels (فتحة صيانه)
    "فتحة صيانه": {
        "numbers": [462, 463, 464, 465, 466, 479, 480, 481, 495],
        "category": "فتحات صيانه",
        "trademark": "",
    },

    # Multitina Level5
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

    # Silicone guns
    "فرد سلكون": {
        "numbers": [319, 330, 320, 369, 468],
        "category": "ادوات",
        "trademark": "",
    },

    # Masks
    "كمامة": {
        "numbers": [88, 314, 206, 235, 236, 355, 354, 353, 381],
        "category": "حماية",
        "trademark": "",
    },

    # Cups (كباية)
    "كباية اسود": {
        "numbers": [391, 392, 393],
        "category": "كبايات",
        "trademark": "",
    },
    "كباية ازرق": {
        "numbers": [394, 395],
        "category": "كبايات",
        "trademark": "",
    },

    # Screws
    "براغي جبص": {
        "numbers": [245, 254, 432, 429, 471],
        "category": "براغي",
        "trademark": "",
    },

    # Boots
    "بوت صغير مشمع": {
        "numbers": [419, 422],
        "category": "احذية",
        "trademark": "",
    },

    # Epoxy tools
    "قشاطة ابوكسي": {
        "numbers": [501, 502],
        "category": "ادوات",
        "trademark": "",
    },
    "مالج ابوكسي": {
        "numbers": [503, 504],
        "category": "ادوات",
        "trademark": "",
    },

    # Sponge rolls
    "رول حواف": {
        "numbers": [491, 492],
        "category": "رولات",
        "trademark": "",
    },

    # Paint sprays ATC
    "سبري ATC": {
        "numbers": [309, 447, 450, 451],
        "category": "سبري",
        "trademark": "ATC",
    },

    # Antiquing paint
    "بويه تعتيق": {
        "numbers": [242, 243, 244],
        "category": "دهان",
        "trademark": "",
    },

    # Fiberglass tape
    "ريشت يوتا": {
        "numbers": [167, 460],
        "category": "ريشت",
        "trademark": "يوتا",
    },

    # Thinners
    "تنر ايطالي": {
        "numbers": [402, 413],
        "category": "مواد",
        "trademark": "",
    },

    # Fiber paper
    "ورق فيبر": {
        "numbers": [233, 362],
        "category": "ورق حف",
        "trademark": "",
    },

    # Shaving blades
    "شفرة تنظيف": {
        "numbers": [91, 92, 93],
        "category": "ادوات",
        "trademark": "",
    },

    # Lazor leather
    "جلدة لازور": {
        "numbers": [103, 104, 105, 108, 224],
        "category": "جلود",
        "trademark": "",
    },

    # Trowels (مالج)
    "مالج Enox": {
        "numbers": [140, 141],
        "category": "موالج",
        "trademark": "Enox",
    },

    # Rollers 9" various brands
    "رول 9\" ماركات": {
        "numbers": [65, 66, 67, 68, 80],
        "category": "رولات",
        "trademark": "",
    },

    # Super glue
    "سوبر جلو": {
        "numbers": [289, 290],
        "category": "لواصق",
        "trademark": "",
    },

    # Decoration stamp (مطبة)
    "مطبة كابرس": {
        "numbers": [118, 119, 156, 184],
        "category": "ديكور",
        "trademark": "كابرس",
    },
    "مطبة مدوره": {
        "numbers": [129, 130, 131],
        "category": "ديكور",
        "trademark": "",
    },

    # Scrapers
    "مشرط": {
        "numbers": [95, 94, 323, 321, 356],
        "category": "ادوات",
        "trademark": "",
    },

    # Trowel pans (تكنه)
    "تكنه": {
        "numbers": [96, 145, 216, 281, 297],
        "category": "ادوات",
        "trademark": "",
    },

    # Rubber rollers
    "رول جومي": {
        "numbers": [73, 74, 79],
        "category": "رولات",
        "trademark": "",
    },

    # Paint screed (مالج روبه)
    "مالج ملتينه": {
        "numbers": [188, 189],
        "category": "موالج",
        "trademark": "",
    },

    # Lazor set
    "طقم لازور احمر": {
        "numbers": [106, 107],
        "category": "جلود",
        "trademark": "",
    },

    # Gypsum saws
    "منشار جبص": {
        "numbers": [249, 396],
        "category": "ادوات",
        "trademark": "",
    },
}

def extract_size_from_name(name, group_name):
    """Extract the variant/size label from a product name."""
    # Try inch sizes
    m = re.search(r'(\d+/\d+\s+\d+|\d+/\d+|\d+\.?\d*)\s*"', name)
    if m:
        raw = m.group(1).strip()
        return raw + '"'

    # Try # sizes
    m = re.search(r'(\d+)\s*#', name)
    if m:
        return '#' + m.group(1)

    # Try No. sizes
    m = re.search(r'No\.?\s*(\d+\.?\d*)', name)
    if m:
        return 'No.' + m.group(1)

    # Try dimension sizes like 10*3, 15*5, 3*12
    m = re.search(r'(\d+\*\d+)', name)
    if m:
        return m.group(1)

    # Try cm sizes
    m = re.search(r'(\d+)\s*سم', name)
    if m:
        return m.group(1) + 'سم'

    # Try م sizes (meters)
    m = re.search(r'(\d+\.?\d*)\s*م(?!\w)', name)
    if m:
        return m.group(1) + 'م'

    # Try kg
    m = re.search(r'(\d+\.?\d*)\s*كغم?', name)
    if m:
        return m.group(1) + 'كغم'

    # Try liter
    m = re.search(r'(\d+\.?\d*)\s*لتر', name)
    if m:
        return m.group(1) + 'لتر'

    # Try grit (2-3 digit standalone number)
    m = re.search(r'\b(\d{2,3})\b', name)
    if m:
        return m.group(1)

    # Fallback: use full name
    return name

def main():
    rows = parse_csv("tools.csv")
    by_number = {r["number"]: r for r in rows}

    grouped_numbers = set()
    groups = []

    for group_name, config in MANUAL_GROUPS.items():
        members = []
        for num in config["numbers"]:
            if num in by_number:
                row = by_number[num]
                size = extract_size_from_name(row["name"], group_name)
                members.append({**row, "size_label": size})
                grouped_numbers.add(num)
            else:
                print(f"WARNING: Number {num} not found in CSV (group: {group_name})")

        if members:
            # Sort by price (ascending)
            members.sort(key=lambda x: x["price"])
            base_price = members[0]["price"]
            base_cost = members[0]["cost"]
            total_stock = sum(m["qty"] for m in members)

            groups.append({
                "name": group_name,
                "category": config["category"],
                "trademark": config["trademark"],
                "base_price": base_price,
                "base_cost": base_cost,
                "total_stock": total_stock,
                "variants": members,
            })

    # Standalone products (not in any group)
    standalone = [r for r in rows if r["number"] not in grouped_numbers]

    # Print summary
    print(f"\n{'='*70}")
    print(f"PRODUCT ANALYSIS SUMMARY")
    print(f"{'='*70}")
    print(f"Total CSV rows: {len(rows)}")
    print(f"Grouped into product families: {len(grouped_numbers)} rows → {len(groups)} products")
    print(f"Standalone products: {len(standalone)}")
    print(f"Total products after merge: {len(groups) + len(standalone)}")

    print(f"\n{'='*70}")
    print(f"PRODUCT FAMILIES ({len(groups)} groups)")
    print(f"{'='*70}")

    for g in groups:
        print(f"\n┌─ {g['name']}  [{g['category']}]  {g['trademark']}")
        print(f"│  Base price: {g['base_price']}  |  Stock: {g['total_stock']}")
        print(f"│  Variants ({len(g['variants'])}):")
        for v in g["variants"]:
            modifier = round(v["price"] - g["base_price"], 2)
            mod_str = f"+{modifier}" if modifier > 0 else str(modifier)
            print(f"│    #{v['number']:>3}  {v['size_label']:<12}  price={v['price']:<8}  cost={v['cost']:<10}  qty={v['qty']:<6}  modifier={mod_str}")
        print(f"└─")

    print(f"\n{'='*70}")
    print(f"STANDALONE PRODUCTS ({len(standalone)} items)")
    print(f"{'='*70}")
    for s in standalone:
        print(f"  #{s['number']:>3}  {s['name']:<50}  price={s['price']:<8}  qty={s['qty']}")

if __name__ == "__main__":
    main()
