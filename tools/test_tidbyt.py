#!/usr/bin/env python3
"""
Tidbyt App Testing Script
Renders the app locally using cached flavor data and displays it for quick iteration.
"""

import subprocess
import sys
import os
import json
from datetime import datetime


def load_test_flavors():
    """Load flavors from cache for testing."""
    try:
        with open('flavor_cache.json', 'r') as f:
            cache = json.load(f)

        # Get primary location
        for slug, loc in cache.get('locations', {}).items():
            if loc.get('role') == 'primary':
                return loc.get('name', 'Unknown'), loc.get('flavors', [])

        # Fallback to first location
        for slug, loc in cache.get('locations', {}).items():
            return loc.get('name', 'Unknown'), loc.get('flavors', [])

    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        pass

    # Fallback test data when cache doesn't exist
    return "Test Location", [
        {"name": "Chocolate Caramel Twist", "date": "2026-01-01"},
        {"name": "Mint Explosion", "date": "2026-01-02"},
        {"name": "Caramel Cashew", "date": "2026-01-03"},
    ]


def render_app(view_mode="single"):
    """Render the Tidbyt app with flavor data from cache."""

    star_file = "tidbyt/culvers_fotd.star"
    location_name, flavors = load_test_flavors()
    output_file = f"preview_{view_mode}_{location_name.lower().replace('.', '').replace(' ', '-')}.webp"

    # Filter to today and future, fall back to whatever we have
    today = datetime.now().strftime('%Y-%m-%d')
    future = [f for f in flavors if f['date'] >= today]
    if not future:
        future = flavors[:3]

    print(f"Rendering Tidbyt app...")
    print(f"   View Mode: {view_mode}")
    print(f"   Location: {location_name}")
    print(f"   Flavors: {len(future)} available")
    print(f"   Output: {output_file}")

    cmd = [
        "pixlet", "render", star_file,
        f"view_mode={view_mode}",
        f"location_name={location_name}",
    ]

    num = 3 if view_mode == "three_day" else 1
    for i, flavor in enumerate(future[:num]):
        cmd.append(f"flavor_{i}={flavor['name']}")
        cmd.append(f"flavor_date_{i}={flavor['date']}")

    cmd.extend(["-o", output_file])

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(f"Rendered successfully: {output_file}")
        return output_file
    except subprocess.CalledProcessError as e:
        print(f"Render failed: {e.stderr}")
        sys.exit(1)


def open_image(image_path):
    """Open the image with the default viewer."""
    print(f"\nOpening {image_path}...")
    subprocess.run(["open", image_path])


def create_html_viewer(images):
    """Create an HTML file to view all renders at proper scale."""

    html = """<!DOCTYPE html>
<html>
<head>
    <title>Tidbyt Preview</title>
    <style>
        body {
            background: #1a1a1a;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            padding: 20px;
            margin: 0;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            font-size: 24px;
            margin-bottom: 30px;
        }
        .preview-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
        }
        .preview-item {
            background: #2a2a2a;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
        }
        .preview-title {
            font-size: 14px;
            color: #999;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .preview-image {
            background: #000;
            padding: 20px;
            border-radius: 8px;
            display: inline-block;
        }
        .preview-image img {
            image-rendering: pixelated;
            width: 640px;
            height: 320px;
            border: 2px solid #333;
            border-radius: 4px;
        }
        .info {
            margin-top: 15px;
            font-size: 12px;
            color: #666;
        }
        .refresh-btn {
            background: #4a9eff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            margin-bottom: 20px;
        }
        .refresh-btn:hover {
            background: #3a8eef;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Culver's Tidbyt Preview</h1>
        <button class="refresh-btn" onclick="location.reload()">Refresh</button>
        <div class="preview-grid">
"""

    for img_info in images:
        html += f"""
            <div class="preview-item">
                <div class="preview-title">{img_info['title']}</div>
                <div class="preview-image">
                    <img src="{img_info['path']}" alt="{img_info['title']}">
                </div>
                <div class="info">64x32 pixels (scaled 5x)</div>
            </div>
"""

    html += """
        </div>
    </div>
</body>
</html>
"""

    html_file = "tidbyt_preview.html"
    with open(html_file, 'w') as f:
        f.write(html)

    print(f"\nCreated HTML viewer: {html_file}")
    return html_file


def main():
    """Main testing function."""

    print("=" * 60)
    print("Culver's Tidbyt App - Testing Tool")
    print("=" * 60)
    print()

    # Check if we're in the right directory
    if not os.path.exists("tidbyt/culvers_fotd.star"):
        print("Error: Could not find tidbyt/culvers_fotd.star")
        print("   Make sure you're running this from the project root")
        sys.exit(1)

    # Parse command line args
    if len(sys.argv) > 1:
        mode = sys.argv[1]
    else:
        # Render both views for comparison
        print("Rendering both views for comparison...\n")

        images = []

        # Render single day view
        single_output = render_app(view_mode="single")
        images.append({
            'title': 'Single Day View',
            'path': single_output
        })

        print()

        # Render 3-day view
        three_day_output = render_app(view_mode="three_day")
        images.append({
            'title': '3-Day Forecast',
            'path': three_day_output
        })

        # Create HTML viewer
        print()
        html_file = create_html_viewer(images)

        # Open HTML viewer
        print("\nOpening browser preview...")
        subprocess.run(["open", html_file])

        print("\n" + "=" * 60)
        print("Preview ready!")
        print("   Tip: Keep the browser tab open and refresh after changes")
        print("=" * 60)

        return

    # Single render mode
    if mode in ["single", "three_day"]:
        output = render_app(view_mode=mode)
        open_image(output)
    else:
        print(f"Unknown mode: {mode}")
        print("\nUsage:")
        print("  python test_tidbyt.py            # Render both views in HTML viewer")
        print("  python test_tidbyt.py single     # Render single day view")
        print("  python test_tidbyt.py three_day  # Render 3-day view")
        sys.exit(1)


if __name__ == "__main__":
    main()
