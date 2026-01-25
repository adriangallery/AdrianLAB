#!/usr/bin/env python3
"""
Pixel-SVG "voxel extrude" generator.

Input:
  - SVG made of many <rect> pixels (common in pixel-to-SVG pipelines)
  - fill typically "rgba(r,g,b,a)"

Output (combined mode):
  - Same SVG wrapped with:
      <g id="extrude_back"> ... shifted darkened layers ... </g>
      <g id="extrude_front"> ... original content ... </g>

Optional split mode:
  - *_body.svg  (only the extruded volume)
  - *_front.svg (original pixels only)
  - *_extruded.svg (combined)
"""

import re
import argparse
import xml.etree.ElementTree as ET
from pathlib import Path

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)

def q(tag: str) -> str:
    return f"{{{SVG_NS}}}{tag}"

RGBA_RE = re.compile(r"rgba\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)", re.I)
HEX_RE  = re.compile(r"^#([0-9a-f]{6})$", re.I)

def parse_alpha(fill: str) -> float:
    if not fill:
        return 1.0
    m = RGBA_RE.match(fill.strip())
    if m:
        return float(m.group(4))
    return 1.0

def darken_fill(fill: str, factor: float) -> str:
    """Darken a fill while preserving alpha. Supports rgba() and #RRGGBB."""
    if fill is None:
        return fill
    fill = fill.strip()
    if fill.lower() == "none":
        return fill

    m = RGBA_RE.match(fill)
    if m:
        r, g, b, a = map(float, m.groups())
        r = max(0, min(255, int(round(r * factor))))
        g = max(0, min(255, int(round(g * factor))))
        b = max(0, min(255, int(round(b * factor))))
        return f"rgba({r},{g},{b},{a:.3f})"

    m2 = HEX_RE.match(fill)
    if m2:
        hx = m2.group(1)
        r = int(hx[0:2], 16)
        g = int(hx[2:4], 16)
        b = int(hx[4:6], 16)
        r = max(0, min(255, int(round(r * factor))))
        g = max(0, min(255, int(round(g * factor))))
        b = max(0, min(255, int(round(b * factor))))
        return f"#{r:02x}{g:02x}{b:02x}"

    return fill  # unknown format

def ensure_pixel_crisp(svg_root: ET.Element):
    svg_root.set("shape-rendering", "crispEdges")
    style = svg_root.get("style") or ""
    if "image-rendering" not in style:
        if style and not style.strip().endswith(";"):
            style += ";"
        style += "image-rendering:pixelated"
        svg_root.set("style", style)

def build_back_group(src_root: ET.Element, depth: int, dx: float, dy: float,
                     far_factor: float, near_factor: float, skip_alpha_le: float) -> ET.Element:
    rects = []
    for el in src_root.iter():
        if el.tag.endswith("rect"):
            fill = el.get("fill")
            a = parse_alpha(fill)
            if a <= skip_alpha_le:
                continue
            rects.append(el)

    g_back = ET.Element(q("g"), {"id": "extrude_back"})
    for i in range(depth, 0, -1):
        t = (depth - i) / max(1, depth - 1)
        factor = far_factor * (1 - t) + near_factor * t
        for r in rects:
            rr = ET.Element(r.tag, r.attrib)  # pixel rects are leaf nodes
            x = float(r.get("x") or 0.0)
            y = float(r.get("y") or 0.0)
            rr.set("x", f"{x + i * dx:g}")
            rr.set("y", f"{y + i * dy:g}")
            rr.set("fill", darken_fill(r.get("fill"), factor))
            g_back.append(rr)

    return g_back

def wrap_combined(svg_in: Path, svg_out: Path, *,
                  depth=10, dx=1.0, dy=1.0, far_factor=0.55, near_factor=0.80, skip_alpha_le=0.0):
    tree = ET.parse(svg_in)
    root = tree.getroot()

    g_back = build_back_group(root, depth, dx, dy, far_factor, near_factor, skip_alpha_le)

    # Front group (original content)
    g_front = ET.Element(q("g"), {"id": "extrude_front"})
    children = list(root)
    for ch in children:
        root.remove(ch)
        g_front.append(ch)

    root.append(g_back)
    root.append(g_front)
    ensure_pixel_crisp(root)
    tree.write(svg_out, encoding="utf-8", xml_declaration=False)

def export_split(svg_in: Path, outdir: Path, *,
                 depth=10, dx=1.0, dy=1.0, far_factor=0.55, near_factor=0.80, skip_alpha_le=0.0):
    outdir.mkdir(parents=True, exist_ok=True)

    # front-only
    tree_front = ET.parse(svg_in)
    root_front = tree_front.getroot()
    ensure_pixel_crisp(root_front)

    # body-only: same svg attrs but only the back group
    tree_body = ET.parse(svg_in)
    root_body = tree_body.getroot()
    ensure_pixel_crisp(root_body)
    for ch in list(root_body):
        root_body.remove(ch)

    src_root_for_body = ET.parse(svg_in).getroot()
    g_back = build_back_group(src_root_for_body, depth, dx, dy, far_factor, near_factor, skip_alpha_le)
    root_body.append(g_back)

    front_path = outdir / f"{svg_in.stem}_front.svg"
    body_path  = outdir / f"{svg_in.stem}_body.svg"
    combined_path = outdir / f"{svg_in.stem}_extruded.svg"

    tree_front.write(front_path, encoding="utf-8", xml_declaration=False)
    tree_body.write(body_path, encoding="utf-8", xml_declaration=False)
    wrap_combined(svg_in, combined_path, depth=depth, dx=dx, dy=dy,
                  far_factor=far_factor, near_factor=near_factor, skip_alpha_le=skip_alpha_le)

    return front_path, body_path, combined_path

def main():
    ap = argparse.ArgumentParser(description="Voxel-extrude pixel-rect SVG(s).")
    ap.add_argument("inputs", nargs="+", help="Input SVG file(s)")
    ap.add_argument("--outdir", default="out_extruded", help="Output directory")
    ap.add_argument("--depth", type=int, default=10, help="Extrude thickness (steps)")
    ap.add_argument("--dx", type=float, default=1.0, help="X shift per step (usually 1)")
    ap.add_argument("--dy", type=float, default=1.0, help="Y shift per step (usually 1)")
    ap.add_argument("--far", type=float, default=0.55, help="Darken factor at farthest layer")
    ap.add_argument("--near", type=float, default=0.80, help="Darken factor at nearest layer")
    ap.add_argument("--skip-alpha-le", type=float, default=0.0, help="Skip pixels with alpha <= this value")
    ap.add_argument("--split", action="store_true", help="Also output *_front.svg and *_body.svg")
    args = ap.parse_args()

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    for inp in args.inputs:
        p = Path(inp)
        if args.split:
            front, body, combined = export_split(
                p, outdir,
                depth=args.depth, dx=args.dx, dy=args.dy,
                far_factor=args.far, near_factor=args.near,
                skip_alpha_le=args.skip_alpha_le
            )
            print("wrote", front)
            print("wrote", body)
            print("wrote", combined)
        else:
            out = outdir / f"{p.stem}_extruded.svg"
            wrap_combined(
                p, out,
                depth=args.depth, dx=args.dx, dy=args.dy,
                far_factor=args.far, near_factor=args.near,
                skip_alpha_le=args.skip_alpha_le
            )
            print("wrote", out)

if __name__ == "__main__":
    main()
