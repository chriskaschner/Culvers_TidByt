#!/usr/bin/env python3
"""
Create a visual annotation of detected structures in the preview.
"""

from PIL import Image, ImageDraw
import sys

def visualize_detection(input_path, output_path):
    """Annotate the preview image with detected structure boundaries."""

    img = Image.open(input_path)
    width, height = img.size

    # Create a copy to draw on
    annotated = img.copy()
    annotated = annotated.resize((width * 10, height * 10), Image.NEAREST)  # Scale up 10x
    draw = ImageDraw.Draw(annotated)

    # Detect structures (same logic as verify_render.py)
    pixels = img.load()
    sample_y = int(height * 0.6)  # Sample at 60% down (lower portion)
    bg_color = pixels[0, 0]

    structures = []
    in_structure = False
    structure_start = 0

    for x in range(width):
        color = pixels[x, sample_y]
        is_colored = color != bg_color and color != (0, 0, 0)

        if is_colored and not in_structure:
            structure_start = x
            in_structure = True
        elif not is_colored and in_structure:
            structures.append((structure_start, x))
            in_structure = False

    if in_structure:
        structures.append((structure_start, width))

    # Draw boxes around detected structures (scaled coordinates)
    scale = 10
    for i, (start, end) in enumerate(structures, 1):
        x1 = start * scale
        x2 = end * scale
        y1 = 0
        y2 = height * scale

        # Draw red box around each structure
        draw.rectangle([x1, y1, x2, y2], outline="red", width=3)

        # Draw label
        draw.text((x1 + 5, y1 + 5), f"#{i}", fill="red")

    annotated.save(output_path)
    print(f"✅ Saved annotated preview: {output_path}")
    print(f"📊 Detected {len(structures)} structures")
    for i, (start, end) in enumerate(structures, 1):
        print(f"   Structure {i}: x={start} to x={end} (width: {end-start}px)")

if __name__ == "__main__":
    input_path = sys.argv[1] if len(sys.argv) > 1 else "preview_three_day_mt-horeb.webp"
    output_path = "annotated_" + input_path.replace(".webp", ".png")

    visualize_detection(input_path, output_path)
