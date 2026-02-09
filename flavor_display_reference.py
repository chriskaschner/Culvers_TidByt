#!/usr/bin/env python3
"""
Flavor Name Display Reference
Shows how flavor names are abbreviated and displayed on the Tidbyt
"""

def format_flavor_for_display(name):
    """Format flavor name into 2 lines for mini cone display."""
    # Light abbreviations
    name = name.replace("Chocolate", "Choc")
    name = name.replace("Peanut Butter", "PB")

    words = name.split()

    # Aim for 2 balanced lines, ~10 chars each max
    if len(name) <= 10:
        # Short enough for 1 line
        return [name]

    # Split into 2 lines
    line1 = ""
    line2 = ""

    # Try to split roughly in half
    for word in words:
        if not line2 and len(line1) < 10:
            line1 = (line1 + " " + word).strip()
        else:
            line2 = (line2 + " " + word).strip()

    # If line2 is too long, truncate
    if len(line2) > 10:
        line2 = line2[:10]

    if line1 and line2:
        return [line1, line2]
    elif line1:
        return [line1]
    else:
        return [name[:10]]

print("=" * 80)
print("TIDBYT 3-DAY VIEW - FLAVOR NAME DISPLAY REFERENCE")
print("=" * 80)
print()

print("SCREEN CONSTRAINTS:")
print("-" * 80)
print("• Display size: 64 x 32 pixels")
print("• 3-day view layout:")
print("  - Title bar: 6 pixels (location name)")
print("  - 3 columns (one per day): ~21 pixels wide each")
print("  - Each column:")
print("    - Mini cone: 10 pixels wide x 12 pixels tall")
print("    - Text area: 2 lines max")
print("• Font: tom-thumb (5 pixels tall per line)")
print("• Characters per line: ~10 characters max (depends on width)")
print("• Total text height: 2 lines = ~12 pixels")
print()

print("ABBREVIATION RULES:")
print("-" * 80)
print("• 'Chocolate' → 'Choc'")
print("• 'Peanut Butter' → 'PB'")
print("• All other words stay full length")
print("• Text wraps to 2 lines automatically")
print("• Line 1: First ~10 characters")
print("• Line 2: Remaining ~10 characters")
print()

# Real Culver's flavors to test
test_flavors = [
    "Andes Mint Avalanche",
    "Chocolate Oreo Volcano",
    "Turtle",
    "Butter Pecan",
    "Caramel Cashew",
    "Mint Explosion",
    "Cookie Dough",
    "Raspberry Fudge Flurry",
    "Peanut Butter Cup",
    "Vanilla",
    "Strawberry Cheesecake",
    "Dark Chocolate Caramel",
    "Salted Caramel Pecan",
    "Lemon Berry Layer Cake",
    "Cappuccino Cookie Crumble",
    "Crazy for Cookie Dough",
    "Death by Chocolate",
    "Midnight Toffee Fudge",
    "Reese's Overload",
    "Brownie Batter Bliss",
]

print("FLAVOR NAME DISPLAY EXAMPLES:")
print("=" * 80)
print(f"{'Original Name':<30} | {'Display (Line 1)':<15} | {'Display (Line 2)':<15}")
print("-" * 80)

for flavor in test_flavors:
    lines = format_flavor_for_display(flavor)
    line1 = lines[0] if len(lines) > 0 else ""
    line2 = lines[1] if len(lines) > 1 else ""

    # Show if it fits
    status = "✓" if len(line1) <= 10 and len(line2) <= 10 else "⚠"

    print(f"{flavor:<30} | {line1:<15} | {line2:<15} {status}")

print()
print("LEGEND:")
print("-" * 80)
print("✓ = Fits well within constraints")
print("⚠ = May be truncated or tight fit")
print()
print("RECOMMENDATIONS:")
print("-" * 80)
print("1. Consider adding more abbreviations for common words:")
print("   • 'Caramel' → 'Crml' or keep full")
print("   • 'Explosion' → 'Expl'")
print("   • 'Overload' → 'O/L'")
print("2. Some names might benefit from shorter alternatives")
print("3. Two-line display works well for most 15-20 character names")
print()
