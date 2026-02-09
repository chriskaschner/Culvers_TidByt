#!/usr/bin/env python3
"""
Generate a visual reference of all flavor colors
"""

# Color mappings for different flavor types
FLAVOR_COLORS = {
    "mint": {"color": "#2ECC71", "topping": "#3B3B3B", "name": "Mint (Green with dark chips)"},
    "chocolate": {"color": "#6F4E37", "topping": "#FFE4B5", "name": "Chocolate (Brown with caramel)"},
    "vanilla": {"color": "#F5DEB3", "topping": "#6F4E37", "name": "Vanilla (Cream with choc chips)"},
    "strawberry": {"color": "#FF6B9D", "topping": "#FF1493", "name": "Strawberry (Pink with chunks)"},
    "caramel": {"color": "#C68E17", "topping": "#FFFFFF", "name": "Caramel (Gold with white)"},
    "peanut": {"color": "#D4A574", "topping": "#FFFFFF", "name": "Peanut (Tan with white)"},
    "butter": {"color": "#FFFACD", "topping": "#6F4E37", "name": "Butter Pecan (Light yellow)"},
    "peach": {"color": "#FFE5B4", "topping": "#FF6B9D", "name": "Peach (Peach with pink)"},
    "raspberry": {"color": "#E30B5C", "topping": "#FFFFFF", "name": "Raspberry (Red-pink)"},
    "cookie": {"color": "#8B7355", "topping": "#FFE4B5", "name": "Cookie (Medium brown)"},
    "oreo": {"color": "#3B3B3B", "topping": "#FFFFFF", "name": "Oreo (Dark gray with white)"},
    "coffee": {"color": "#6F4E37", "topping": "#FFE4B5", "name": "Coffee (Brown with caramel)"},
    "default": {"color": "#FFE4B5", "topping": "#FFFFFF", "name": "Default/Other (Moccasin)"},
}

print("=" * 80)
print("CULVER'S FLAVOR COLOR REFERENCE")
print("=" * 80)
print()

for flavor_key, flavor_data in FLAVOR_COLORS.items():
    print(f"{flavor_key.upper():12} | Ice Cream: {flavor_data['color']:7} | Toppings: {flavor_data['topping']:7}")
    print(f"             {flavor_data['name']}")
    print("-" * 80)

print()
print("EXAMPLE FLAVOR NAMES AND THEIR DETECTED COLORS:")
print("=" * 80)

test_flavors = [
    ("Andes Mint Avalanche", "mint"),
    ("Dark Chocolate Caramel", "chocolate"),
    ("Vanilla", "vanilla"),
    ("Strawberry Cheesecake", "strawberry"),
    ("Caramel Sea Salt", "caramel"),
    ("Peanut Butter Cup", "peanut"),
    ("Butter Pecan", "butter"),
    ("Peach Cobbler", "peach"),
    ("Raspberry Fudge", "raspberry"),
    ("Cookie Dough", "cookie"),
    ("Oreo Overload", "oreo"),
    ("Coffee Toffee", "coffee"),
    ("Lemon Berry", "default"),
]

for flavor_name, detected_type in test_flavors:
    color_data = FLAVOR_COLORS[detected_type]
    print(f"'{flavor_name}'")
    print(f"  → Detected as: {detected_type}")
    print(f"  → Ice cream color: {color_data['color']} ({color_data['name'].split('(')[0].strip()})")
    print()
