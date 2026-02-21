#!/usr/bin/env python3
"""
Check what data is actually being rendered in the preview.
"""

import subprocess
import json
import re

def check_rendering():
    """Extract and display what's being rendered."""

    print("="*60)
    print("🔍 Checking what's being rendered...")
    print("="*60)
    print()

    # For now, let's manually check what the format_flavor_for_display
    # function would output for common flavors

    test_flavors = [
        "Raspberry Cheesecake",
        "Dark Chocolate Peanut Butter Crunch",
        "Chocolate Caramel Twist",
        "Mint Oreo",
        "Strawberry Cheesecake",
        "Turtle",
        "Cookie Dough Avalanche",
    ]

    print("📝 Testing flavor name formatting with max_chars=6:")
    print()

    for flavor in test_flavors:
        # Apply abbreviations
        abbr = flavor
        abbr_map = {
            "Chocolate": "Choc",
            "Caramel": "Crml",
            "Raspberry": "Rasp",
            "Strawberry": "Straw",
            "Peanut Butter": "PB",
            "Dark": "Dk",
        }

        for full, short in abbr_map.items():
            abbr = abbr.replace(full, short)

        words = abbr.split()

        # Base nouns
        base_nouns = [
            "Avalanche", "Volcano", "Cheesecake", "Flurry", "Cake",
            "Crunch", "Twist", "Turtle", "Mint", "Dough"
        ]

        # Detect base noun
        if words[-1] in base_nouns:
            base_noun = words[-1]
            desc_words = words[:-1]
        else:
            base_noun = words[-1]
            desc_words = words[:-1]

        line1 = " ".join(desc_words) if desc_words else ""
        line2 = base_noun

        # Trim to 6 chars
        if len(line1) > 6:
            line1 = line1[:6]
        if len(line2) > 6:
            line2 = line2[:6]

        print(f"{flavor:40} →")
        print(f"  Line 1: '{line1}' ({len(line1)} chars)")
        print(f"  Line 2: '{line2}' ({len(line2)} chars)")
        print()

    print("="*60)

if __name__ == "__main__":
    check_rendering()
