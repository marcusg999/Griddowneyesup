#!/usr/bin/env python3
"""
Subset and self-host the three faces.

Self-hosted because the offline suite asserts that no request escapes the cache
during render — a Google Fonts link would be a network dependency on the render
path, which is exactly the thing this product refuses to have.

Subset because the performance budget targets a five-year-old mid-range Android
over 3G, and a full Latin variable font is most of a second on that connection.

Output is committed to public/fonts/, so CI needs Node only. Re-run this by hand
(needs `pip install fonttools brotli`) when a face changes.
"""
import subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "fonts"
OUT.mkdir(parents=True, exist_ok=True)

# Basic Latin + Latin-1 + the punctuation and symbols the UI actually uses.
BODY_RANGE = (
    "U+0020-007E,U+00A0-00FF,U+2010-2015,U+2018-201A,U+201C-201E,"
    "U+2020-2022,U+2026,U+2030,U+2032-2033,U+2039-203A,U+2044,"
    "U+2190-2193,U+2212,U+2264-2265,U+00D7,U+00B7,U+00B0"
)
# Display and annotation faces set headings, stamps and marginalia only.
DISPLAY_RANGE = "U+0020-007E,U+00A0,U+00B0,U+00B7,U+2013-2014,U+2018-201D,U+2026,U+2192"

JOBS = [
    (
        "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
        "inter-var.woff2",
        BODY_RANGE,
    ),
    # Redaction 35 sets headings: fine enough halftone to stay readable at
    # body-adjacent sizes.
    (
        "@fontsource/redaction-35/files/redaction-35-latin-400-normal.woff2",
        "redaction35-400.woff2",
        DISPLAY_RANGE,
    ),
    # Redaction 70 is reserved for the stamp, where a coarse, broken-up die is
    # exactly right — a rubber stamp should look over-inked.
    (
        "@fontsource/redaction-70/files/redaction-70-latin-700-normal.woff2",
        "redaction70-700.woff2",
        DISPLAY_RANGE,
    ),
    (
        "@fontsource/architects-daughter/files/architects-daughter-latin-400-normal.woff2",
        "hand-400.woff2",
        DISPLAY_RANGE,
    ),
]

total_before = total_after = 0
for src_rel, out_name, unicodes in JOBS:
    src = ROOT / "node_modules" / src_rel
    if not src.exists():
        sys.exit(f"missing {src} — run npm install first")
    dst = OUT / out_name
    subprocess.run(
        [
            sys.executable, "-m", "fontTools.subset", str(src),
            f"--unicodes={unicodes}",
            "--layout-features=kern,liga,calt,tnum,ss01",
            "--flavor=woff2",
            "--desubroutinize",
            f"--output-file={dst}",
        ],
        check=True,
    )
    before, after = src.stat().st_size, dst.stat().st_size
    total_before += before
    total_after += after
    print(f"  {out_name:<24} {before/1024:6.1f} KB -> {after/1024:5.1f} KB")

print(f"  {'TOTAL':<24} {total_before/1024:6.1f} KB -> {total_after/1024:5.1f} KB")
