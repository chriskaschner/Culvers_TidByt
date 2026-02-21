#!/usr/bin/env python3
"""
Automated verification of Tidbyt render output.
Analyzes the preview image to count distinct visual elements.
"""

from PIL import Image
import sys

def analyze_preview(image_path):
    """Analyze preview image and count distinct features."""

    print(f"🔍 Analyzing: {image_path}")
    print("="*60)

    try:
        img = Image.open(image_path)
        width, height = img.size

        print(f"📐 Image dimensions: {width}×{height}")

        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')

        pixels = img.load()

        # Analyze horizontal bands to detect cones
        # Cones should appear in the lower portion of the image
        # Look for vertical structures (cone shapes)

        # Sample middle row to detect distinct colored regions
        mid_y = height // 2

        colors_in_row = []
        prev_color = None
        color_changes = 0

        for x in range(width):
            color = pixels[x, mid_y]
            if prev_color and color != prev_color:
                color_changes += 1
            if color not in colors_in_row:
                colors_in_row.append(color)
            prev_color = color

        print(f"🎨 Unique colors in middle row: {len(colors_in_row)}")
        print(f"🔄 Color transitions in middle row: {color_changes}")

        # Detect vertical structures by scanning columns
        # Look for non-black, non-background colored regions

        structures = []
        in_structure = False
        structure_start = 0

        # Sample a row where ice cream scoops should be (lower portion, 2/3 down)
        sample_y = int(height * 0.6)

        bg_color = pixels[0, 0]  # Assume top-left is background

        for x in range(width):
            color = pixels[x, sample_y]

            # Detect if this is a colored region (not background)
            is_colored = color != bg_color and color != (0, 0, 0)

            if is_colored and not in_structure:
                structure_start = x
                in_structure = True
            elif not is_colored and in_structure:
                structures.append((structure_start, x))
                in_structure = False

        if in_structure:
            structures.append((structure_start, width))

        print(f"\n📊 Detected vertical structures: {len(structures)}")
        for i, (start, end) in enumerate(structures, 1):
            print(f"   Structure {i}: x={start} to x={end} (width: {end-start}px)")

        # Heuristic: each cone should be roughly 11-20px wide
        likely_cones = [s for s in structures if 8 <= (s[1] - s[0]) <= 25]

        print(f"\n✅ Likely cone count: {len(likely_cones)}")
        print("="*60)

        return len(likely_cones)

    except Exception as e:
        print(f"❌ Error analyzing image: {e}")
        return None

if __name__ == "__main__":
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
    else:
        image_path = "preview_three_day_mt-horeb.webp"

    cone_count = analyze_preview(image_path)

    if cone_count is not None:
        print(f"\n🎯 RESULT: {cone_count} cones detected")
        sys.exit(0 if cone_count == 3 else 1)
    else:
        sys.exit(2)
