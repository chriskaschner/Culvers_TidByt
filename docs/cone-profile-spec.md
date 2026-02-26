# Cone Profile Authoring Spec

Design language, geometry, color palettes, and authoring rules for the custard cone rendering system. Covers all surfaces: Tidbyt pixel art (9x11), mini SVG cones (web), HD SVG cones (Radar/social cards).

Canonical source of truth: `worker/src/flavor-colors.js`
Tidbyt renderer: `custard-tidbyt/apps/culversfotd/culvers_fotd.star`
Shared web renderer: `docs/cone-renderer.js`

---

## Grid Geometry

### Mini cone (9x11 pixels)

Used on: Tidbyt display, web widget inline, map markers, Radar cards (scaled up via CSS)

```
Col:  0 1 2 3 4 5 6 7 8
Row 0:    . . S S S . .      S = scoop (5px centered)
Row 1:  . . S S S S S . .    S = scoop (7px), T1(2) T2(6) ribbon R1(3)
Row 2:  . . S S S S S . .    T4(5) if no ribbon, ribbon R2(4)
Row 3:  . . S S S S S . .    T3(3), ribbon R3(5)
Row 4:  . . S S S S S . .
Row 5:  . . S S S S S . .
Row 6:    . C W C W C . .    cone row 1: CWCWC at x=2
Row 7:    . W C W C W . .    cone row 2: WCWCW at x=2
Row 8:      . C W C . .      cone row 3: CWC at x=3
Row 9:      . W C W . .      cone row 4: WCW at x=3
Row 10:       . . T . .      tip at x=4
```

**Topping slots** (fixed pixel positions):
| Slot | Col | Row | Notes |
|------|-----|-----|-------|
| T1   | 2   | 1   | Top-left of scoop |
| T2   | 6   | 1   | Top-right of scoop |
| T3   | 3   | 3   | Mid-left |
| T4   | 5   | 2   | Mid-right — skipped when ribbon present (R3 collision) |

**Ribbon slots** (rendered after toppings — ribbon wins at overlap):
| Slot | Col | Row |
|------|-----|-----|
| R1   | 3   | 0   |
| R2   | 4   | 1   |
| R3   | 5   | 2   |

Rendering order: `base fill → toppings (T1–T4) → ribbon (R1–R3) → cone → tip`

### HD cone (18x22 pixels)

Used on: Radar flavor cards, hero sections, social/OG cards

Same layout principles as mini — scoop rows, checkerboard waffle cone, single tip — but with 8 topping slots (T1–T8) spanning the full scoop height. Scale multipliers used in practice:

| Usage | Scale | Output size |
|-------|-------|-------------|
| Radar cards | ×5 | 90×105px |
| Hero / index page | ×8 | 144×176px |
| OG social cards | ×10 | 180×220px |

---

## Color Palettes

### Base scoop colors

| Key | Hex | Use for |
|-----|-----|---------|
| `vanilla` | `#F5DEB3` | Default cream; any vanilla-forward flavor |
| `chocolate` | `#6F4E37` | Standard chocolate; lighter milk-chocolate flavors |
| `chocolate_custard` | `#5A3825` | Deep chocolate; richer flavors like Caramel Chocolate Pecan |
| `dark_chocolate` | `#3B1F0B` | Near-black; dark/bitter chocolate flavors |
| `mint` | `#2ECC71` | Bright mint; Mint Explosion |
| `mint_andes` | `#1A8A4A` | Darker mint; Andes Mint Avalanche |
| `strawberry` | `#FF6B9D` | Pink; strawberry-forward flavors |
| `cheesecake` | `#FFF5E1` | Off-white cream; cheesecake bases |
| `caramel` | `#C68E17` | Gold; caramel-base flavors (Caramel Turtle, Caramel Pecan) |
| `butter_pecan` | `#F2E7D1` | Light tan; Butter Pecan |
| `peach` | `#FFE5B4` | Warm peach; Georgia Peach |
| `lemon` | `#FFF176` | Bright yellow; lemon flavors |
| `blackberry` | `#6B3FA0` | Purple; Blackberry Cobbler |

**Choosing base color:**
- Use `chocolate_custard` instead of `chocolate` when the flavor is custard-rich and topping-heavy (Caramel Chocolate Pecan). `chocolate` is the lighter milk-chocolate fallback.
- Use `dark_chocolate` only for explicitly dark/bitter flavors (Dark Chocolate Decadence, Devil's Food Cake).
- `cheesecake` and `vanilla` look similar at small sizes — prefer `cheesecake` only when the flavor name includes cheesecake.

### Ribbon colors

Ribbons read as thin diagonal streaks across the scoop. At 1px slots on 9×11, they produce 3 diagonal pixels — enough to suggest a swirl or drizzle, not a stripe.

| Key | Hex | Visual intent |
|-----|-----|---------------|
| `caramel` | `#D38B2C` | Warm gold streak; highlight edge at `#F2B45A` |
| `peanut_butter` | `#D4A017` | Amber-tan streak |
| `marshmallow` | `#FFFFFF` | White flash; reads as fluffy swirl |
| `chocolate_syrup` | `#1A0A00` | Near-black streak; heavy contrast against light base |
| `fudge` | `#3B1F0B` | Dark brown; softer than chocolate_syrup |

**Ribbon design intent:**
The 3 ribbon pixels (R1, R2, R3) trace a diagonal from upper-left to lower-right across the scoop. They should feel like a flowing drizzle, not a dot pattern. When deciding between `caramel` and `fudge`: caramel for golden/buttery flavors, fudge for deep chocolate flavors.

Use `ribbon: null` if the flavor has no sauce/swirl component. Do not add a ribbon just to add visual interest — it takes slot T4 away from toppings.

### Topping colors

Toppings are 1px accents placed at fixed slots. Color + context (which other toppings are present) determines what the pixel reads as.

| Key | Hex | Reads as | Shape intent |
|-----|-----|----------|--------------|
| `oreo` | `#1A1A1A` | Cookie crumble | Dark fragment; near-black |
| `andes` | `#1FAE7A` | Andes mint chip | Bright green accent |
| `dove` | `#2B1A12` | Dark chocolate piece | Very dark brown, smaller than pecan |
| `pecan` | `#8B5A2B` | Toasted pecan chunk | Mid-brown; irregular implied |
| `cashew` | `#D4C4A8` | Cashew piece | Pale tan |
| `heath` | `#DAA520` | Heath toffee bit | Gold-amber |
| `butterfinger` | `#E6A817` | Butterfinger crunch | Bright gold |
| `cookie_dough` | `#C4A882` | Cookie dough chunk | Muted tan |
| `strawberry_bits` | `#FF1744` | Strawberry piece | Vivid red |
| `raspberry` | `#E91E63` | Raspberry seed/bit | Deep pink |
| `peach_bits` | `#FF9800` | Peach piece | Orange |
| `salt` | `#FFFFFF` | Salt crystal | White; reads as sparkle against dark base |
| `snickers` | `#C4A060` | Snickers chunk | Tan-gold |
| `cake` | `#4A2800` | Cake piece | Very dark brown |
| `cheesecake_bits` | `#FFF8DC` | Cheesecake chunk | Near-white; visible on cheesecake base only at HD |
| `m_and_m` | `#FF4444` | M&M candy | Red accent |
| `reeses` | `#D4A017` | Reese's piece | Amber |
| `brownie` | `#2D1700` | Brownie chunk | Near-black brown |
| `blueberry` | `#3B1F6B` | Blueberry | Deep purple |
| `pie_crust` | `#C4966A` | Pie crust piece | Warm tan |

**Topping shape intent (for HD cones with visible pixel geometry):**
- `pecan` — 2×2 cluster or L-shape. Avoid perfect squares; that reads as chocolate chips. Irregular blob implies a nut.
- `dove` — 1×2 or 2×1 pixels only. Sparse placement. Slightly angular. Fewer than pecans when both present.
- `oreo` — single pixel or 1×2. Near-black against any base; most versatile dark topping.
- `brownie` / `cake` — 2×2 solid. Dense, matte. Distinguishable from oreo by slightly warmer brown.
- `cheesecake_bits` — near-white; only place against non-vanilla, non-cheesecake bases or they disappear.

### Cone colors (fixed — do not change)

| Key | Hex | Role |
|-----|-----|------|
| `waffle` | `#D2691E` | Waffle pattern primary |
| `waffle_dark` | `#B8860B` | Waffle pattern secondary (checkerboard) |
| Tip | `#8B5A2B` | Single-pixel cone tip |

---

## Density Encoding

`density` controls how topping slots are filled. It is not a topping count — it is a rendering instruction.

| Value | Behavior | Visual intent | When to use |
|-------|----------|---------------|-------------|
| `pure` | No toppings, no ribbon | Clean single-color scoop | Vanilla, Dark Chocolate Decadence |
| `standard` | Fill slots in order, up to 4 | 1–3 toppings, balanced | Most flavors |
| `double` | Duplicate first topping in T1+T2, add second at T3 | Emphasis on one dominant topping | Mint Cookie, Double Strawberry |
| `explosion` | Use all 4 topping slots | Heavy, layered look | Mint Explosion, Caramel Chocolate Pecan, Chocolate Volcano |
| `overload` | Duplicate first topping across all slots | Single topping everywhere | OREO Cookie Overload |

**When ribbon + explosion combine:** T4 is skipped (ribbon occupies R3). Explosion with ribbon effectively gives 3 visible topping slots. Author toppings list accordingly.

**Visual density balance target:**
- `pure`: 100% base
- `standard`: ~75% base, ~25% toppings/ribbon
- `double`: ~70% base, ~30% toppings
- `explosion`: ~60% base, ~25% toppings, ~15% ribbon (if present)
- `overload`: ~60% base, ~40% single dominant topping

---

## Design Language by Element Type

### Ribbons

Ribbons read as a drizzle or swirl traced diagonally across the scoop (upper-left to lower-right at mini scale). The 3 ribbon pixels are fixed — you cannot change their path. Design intent:

- **Caramel ribbon** — warm gold; feels buttery. Use for caramel swirl, caramel sauce flavors.
- **Fudge ribbon** — dark brown; heavier. Use for hot fudge, brownie-sauce flavors.
- **Marshmallow ribbon** — white flash. Reads as a white swirl; use for s'mores, avalanche, thunder flavors.
- **Peanut butter ribbon** — amber. Reads as PB drizzle.
- **Chocolate syrup ribbon** — near-black. Maximum contrast; use sparingly for very dark flavors.

At 9×11, a ribbon reads primarily as "there is something diagonal here." The color determines what that something is. At HD scale (×5 and up), the diagonal becomes more visible and the color distinction matters more.

### Toppings

At 9×11, each topping is 1 pixel. The color is the entire signal. At HD, toppings expand but remain 1 unit in the slot grid. Consider:

- **Contrast first**: a `dove` pixel on `chocolate` base is nearly invisible. On `vanilla` or `cheesecake` it reads clearly.
- **Topping order matters**: T1 and T2 are top-of-scoop; T3 and T4 are mid-scoop. Put your primary/identifying topping at T1 or T2 so it appears at the top of the cone where it reads most clearly.
- **Mixed toppings** (e.g. `pecan` + `dove`): put the lighter/more identifiable at T1, darker accent at T2 or T3. Dove is an accent — 1–2 pixels max. Pecan is a feature — can appear 2–3 times.

### Worked example: Caramel Chocolate Pecan

Profile: `{ base: 'chocolate_custard', ribbon: 'caramel', toppings: ['pecan', 'pecan', 'dove', 'pecan'], density: 'explosion' }`

- **Base** (`chocolate_custard` #5A3825): Deep chocolate brown, not the lighter `chocolate`. The flavor is custard-rich. Shadow implied at #3E2416, highlight at #7A4B33.
- **Ribbon** (`caramel` #D38B2C): Flows diagonally upper-left to lower-right. Highlight edge implied at #F2B45A. Reads as a golden caramel streak, not a dot.
- **Toppings**: Three `pecan` entries + one `dove`. Pecans dominate (irregular mid-brown chunks at T1, T2, T3); dove is sparse dark accent (angular 1-pixel fragment). At HD, pecans should read as chunky, asymmetric — not square.
- **Density** `explosion`: All 4 slots active. T4 is blocked by ribbon (R3 collision) so effectively 3 topping slots show. The explosion density here signals: this is a layered, ingredient-heavy flavor.
- **Visual balance**: ~60% chocolate base, ~20% caramel ribbon, ~15% pecan chunks, ~5% dark chocolate dove.

---

## Authoring a New Profile

1. **Identify the base**: What is the custard base flavor? Pick the closest `BASE_COLORS` key. When in doubt between `vanilla` and `cheesecake`, prefer `vanilla`.

2. **Identify the ribbon**: Is there a sauce, swirl, or ribbon in the name or description? If yes, pick the closest `RIBBON_COLORS` key. If the sauce is integral (e.g. "caramel turtle"), use ribbon. If it's an ingredient without a sauce role (e.g. caramel pieces), use a topping.

3. **List toppings in visual priority order**: Most distinctive or most prominent ingredient first (T1 = top-left, most visible). Accent pieces last.

4. **Choose density**: Start with `standard`. Upgrade to `explosion` if the flavor has 3+ distinct mix-in types or if the name implies excess (Overload, Explosion, Avalanche). Use `double` to emphasize a single dominant mix-in. Use `pure` only for plain/unfilled flavors.

5. **Check contrast**: Would topping colors disappear on the chosen base? If `dove` (#2B1A12) on `dark_chocolate` (#3B1F0B) — invisible. Pick a lighter base or remove dove.

6. **Check ribbon-T4 conflict**: If ribbon is set, T4 is silently dropped. If you have 4 toppings listed, the 4th will not render. This is expected behavior — document by only listing 3 toppings when ribbon is present, or acknowledge the 4th is decorative at non-ribbon scales.

7. **Validate in flavor-audit.html**: Load the page, find the new flavor row. Check: Tidbyt pixel column (is it readable at 1px scale?), mini ×5 (does it look right?), HD ×8 (are topping shapes distinguishable?). Check the quality flags — sparse toppings or unknown topping colors are flagged automatically.

---

## Tidbyt Display Constraints

Display: **64×32 pixels**, 3-day layout, tom-thumb font.

```
[ Header: brand name + location, 6px tall                    ]
[ Day 1 col  ][ Day 2 col  ][ Day 3 col  ]    ~21px each
[ mini cone  ][ mini cone  ][ mini cone  ]    9px wide, 11px tall
[ name L1    ][ name L1    ][ name L1    ]    5px tall
[ name L2    ][ name L2    ][ name L2    ]    5px tall
```

Flavor name constraints:
- Max **5 characters per line**, 2 lines per column
- `format_flavor_for_display()` handles abbreviation automatically
- Long names (>24 chars) are flagged in flavor-audit.html

Common abbreviations (from `culvers_fotd.star`):

| Word | Abbrev |
|------|--------|
| Chocolate | Choc |
| Caramel | Crml |
| Peanut Butter | PB |
| Avalanche | Avlnc |
| Explosion | Expl |
| Cheesecake | Chees |
| Overload | O/L |
| Strawberry | Straw |

Full abbreviation table and display examples: see `custard-tidbyt/README.md`.

---

## Adding a New Base or Topping Color

If a new flavor requires a color that doesn't exist:

1. Add to `BASE_COLORS` / `TOPPING_COLORS` / `RIBBON_COLORS` in `worker/src/flavor-colors.js`
2. Mirror the addition in `docs/cone-renderer.js` (client-side fallback palettes)
3. Mirror in `custard-tidbyt/apps/culversfotd/culvers_fotd.star` (Tidbyt pixel renderer)
4. Mirror in `docs/flavor-audit.html` SEED_TOPPING / SEED_BASE / SEED_RIBBON constants (seed fallback for when API is offline)

All four files must stay in sync. The flavor-audit.html page will flag "unknown topping color" if a profile references a key not in the live API or seed.
