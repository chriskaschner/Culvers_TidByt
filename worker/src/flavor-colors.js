/**
 * Canonical flavor color system for custard visualization.
 *
 * Ported from tidbyt/culvers_fotd.star -- single source of truth for flavor
 * profiles, color palettes, and cone rendering. Used by social cards, Radar
 * mini-cones, and the /api/v1/flavor-colors endpoint.
 */

export const BASE_COLORS = {
  vanilla: '#F5DEB3',
  chocolate: '#6F4E37',
  dark_chocolate: '#3B1F0B',
  mint: '#2ECC71',
  strawberry: '#FF6B9D',
  cheesecake: '#FFF5E1',
  caramel: '#C68E17',
  butter_pecan: '#D4A574',
  peach: '#FFE5B4',
};

export const RIBBON_COLORS = {
  caramel: '#DAA520',
  peanut_butter: '#D4A017',
  marshmallow: '#FFFFFF',
  chocolate_syrup: '#1A0A00',
  fudge: '#3B1F0B',
};

export const TOPPING_COLORS = {
  oreo: '#1A1A1A',
  andes: '#00897B',
  dove: '#3B1F0B',
  pecan: '#8B6914',
  cashew: '#D4C4A8',
  heath: '#DAA520',
  butterfinger: '#E6A817',
  cookie_dough: '#C4A882',
  strawberry_bits: '#FF1744',
  raspberry: '#E91E63',
  peach_bits: '#FF9800',
  salt: '#FFFFFF',
  snickers: '#C4A060',
  cake: '#4A2800',
  cheesecake_bits: '#FFF8DC',
  m_and_m: '#FF4444',
  reeses: '#D4A017',
};

export const CONE_COLORS = {
  waffle: '#D4A574',
  waffle_dark: '#A0784C',
};

/**
 * Flavor profiles: lowercase name -> { base, ribbon, toppings, density }
 */
export const FLAVOR_PROFILES = {
  'dark chocolate pb crunch': { base: 'dark_chocolate', ribbon: 'peanut_butter', toppings: ['butterfinger'], density: 'standard' },
  'chocolate caramel twist': { base: 'chocolate', ribbon: 'caramel', toppings: ['dove'], density: 'standard' },
  'mint explosion': { base: 'mint', ribbon: null, toppings: ['oreo', 'andes', 'dove'], density: 'explosion' },
  'turtle dove': { base: 'vanilla', ribbon: 'marshmallow', toppings: ['pecan', 'dove'], density: 'standard' },
  'double strawberry': { base: 'strawberry', ribbon: null, toppings: ['strawberry_bits'], density: 'double' },
  'turtle cheesecake': { base: 'cheesecake', ribbon: 'caramel', toppings: ['dove', 'pecan', 'cheesecake_bits'], density: 'explosion' },
  'caramel turtle': { base: 'caramel', ribbon: null, toppings: ['pecan', 'dove'], density: 'standard' },
  'andes mint avalanche': { base: 'mint', ribbon: null, toppings: ['andes', 'dove'], density: 'standard' },
  'oreo cookie cheesecake': { base: 'cheesecake', ribbon: null, toppings: ['oreo', 'cheesecake_bits'], density: 'standard' },
  "devil's food cake": { base: 'dark_chocolate', ribbon: null, toppings: ['cake', 'dove'], density: 'standard' },
  'caramel cashew': { base: 'vanilla', ribbon: 'caramel', toppings: ['cashew'], density: 'standard' },
  'butter pecan': { base: 'butter_pecan', ribbon: null, toppings: ['pecan'], density: 'standard' },
  'caramel chocolate pecan': { base: 'chocolate', ribbon: 'caramel', toppings: ['pecan', 'dove'], density: 'standard' },
  'dark chocolate decadence': { base: 'dark_chocolate', ribbon: null, toppings: [], density: 'pure' },
  'caramel fudge cookie dough': { base: 'vanilla', ribbon: 'fudge', toppings: ['cookie_dough'], density: 'standard' },
  'mint cookie': { base: 'mint', ribbon: null, toppings: ['oreo'], density: 'standard' },
  'caramel pecan': { base: 'vanilla', ribbon: 'caramel', toppings: ['pecan'], density: 'standard' },
  "really reese's": { base: 'chocolate', ribbon: 'peanut_butter', toppings: ['reeses'], density: 'standard' },
  'raspberry cheesecake': { base: 'cheesecake', ribbon: null, toppings: ['raspberry', 'cheesecake_bits'], density: 'standard' },
  'chocolate covered strawberry': { base: 'vanilla', ribbon: null, toppings: ['strawberry_bits', 'dove'], density: 'standard' },
  'caramel peanut buttercup': { base: 'vanilla', ribbon: 'peanut_butter', toppings: ['dove'], density: 'standard' },
  'turtle': { base: 'vanilla', ribbon: 'caramel', toppings: ['dove', 'pecan'], density: 'standard' },
  'georgia peach': { base: 'peach', ribbon: null, toppings: ['peach_bits'], density: 'standard' },
  'snickers swirl': { base: 'chocolate', ribbon: 'caramel', toppings: ['snickers'], density: 'standard' },
  'chocolate volcano': { base: 'chocolate', ribbon: 'chocolate_syrup', toppings: ['oreo', 'dove', 'm_and_m'], density: 'explosion' },
  'oreo cookie overload': { base: 'chocolate', ribbon: 'chocolate_syrup', toppings: ['oreo'], density: 'overload' },
  'salted double caramel pecan': { base: 'caramel', ribbon: 'caramel', toppings: ['pecan', 'salt'], density: 'double' },
  'crazy for cookie dough': { base: 'vanilla', ribbon: 'fudge', toppings: ['cookie_dough'], density: 'standard' },
  'chocolate heath crunch': { base: 'chocolate', ribbon: null, toppings: ['heath'], density: 'standard' },
};

const DEFAULT_PROFILE = { base: 'vanilla', ribbon: null, toppings: [], density: 'standard' };

/**
 * Look up flavor profile by name with fuzzy matching.
 * Tries: exact match -> unicode normalized -> keyword fallback -> default.
 */
export function getFlavorProfile(name) {
  if (!name) return DEFAULT_PROFILE;
  const key = name.toLowerCase();

  if (FLAVOR_PROFILES[key]) return FLAVOR_PROFILES[key];

  // Normalize unicode curly quotes
  const normalized = key.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
  if (FLAVOR_PROFILES[normalized]) return FLAVOR_PROFILES[normalized];

  // Keyword fallback
  if (key.includes('mint')) return { base: 'mint', ribbon: null, toppings: [], density: 'standard' };
  if (key.includes('dark choc')) return { base: 'dark_chocolate', ribbon: null, toppings: [], density: 'standard' };
  if (key.includes('chocolate') || key.includes('cocoa')) return { base: 'chocolate', ribbon: null, toppings: [], density: 'standard' };
  if (key.includes('strawberry')) return { base: 'strawberry', ribbon: null, toppings: [], density: 'standard' };
  if (key.includes('cheesecake')) return { base: 'cheesecake', ribbon: null, toppings: [], density: 'standard' };
  if (key.includes('caramel')) return { base: 'caramel', ribbon: 'caramel', toppings: [], density: 'standard' };
  if (key.includes('peach')) return { base: 'peach', ribbon: null, toppings: [], density: 'standard' };
  if (key.includes('butter pecan')) return { base: 'butter_pecan', ribbon: null, toppings: ['pecan'], density: 'standard' };
  if (key.includes('vanilla')) return { base: 'vanilla', ribbon: null, toppings: [], density: 'standard' };

  return DEFAULT_PROFILE;
}

/**
 * Render an SVG cone for a flavor at the given scale.
 *
 * The base grid is 9x11 pixels (matching Tidbyt pixel art). Scale multiplies
 * the grid to produce larger output (e.g., scale=10 -> 90x110 SVG).
 *
 * @param {string} flavorName
 * @param {number} [scale=1]
 * @returns {string} SVG markup
 */
export function renderConeSVG(flavorName, scale = 1) {
  const profile = getFlavorProfile(flavorName);
  const baseColor = BASE_COLORS[profile.base] || BASE_COLORS.vanilla;
  const ribbonColor = profile.ribbon ? (RIBBON_COLORS[profile.ribbon] || null) : null;
  const toppingColor = profile.toppings.length > 0
    ? (TOPPING_COLORS[profile.toppings[0]] || null)
    : null;

  const w = 9 * scale;
  const h = 11 * scale;
  const s = scale;
  const rects = [];

  // Scoop (rows 0-5, columns 1-7 with rounded shape)
  const scoopRows = [
    [2, 6],   // row 0: cols 2-6
    [1, 7],   // row 1: cols 1-7
    [1, 7],   // row 2: cols 1-7
    [1, 7],   // row 3: cols 1-7
    [1, 7],   // row 4: cols 1-7
    [2, 6],   // row 5: cols 2-6
  ];

  for (let row = 0; row < scoopRows.length; row++) {
    const [startCol, endCol] = scoopRows[row];
    for (let col = startCol; col <= endCol; col++) {
      let color = baseColor;
      // Ribbon diagonal (row 2-3, offset columns)
      if (ribbonColor && (row === 2 || row === 3) && col >= 2 && col <= 5 && ((row + col) % 3 === 0)) {
        color = ribbonColor;
      }
      // Topping accents (row 0-1, scattered)
      if (toppingColor && row <= 1 && col >= startCol + 1 && col <= endCol - 1 && (col % 2 === 0)) {
        color = toppingColor;
      }
      rects.push(`<rect x="${col * s}" y="${row * s}" width="${s}" height="${s}" fill="${color}"/>`);
    }
  }

  // Cone (rows 6-10, narrowing V-shape)
  const coneRows = [
    [2, 6],  // row 6
    [3, 5],  // row 7
    [3, 5],  // row 8
    [4, 4],  // row 9
    [4, 4],  // row 10
  ];

  for (let row = 0; row < coneRows.length; row++) {
    const [startCol, endCol] = coneRows[row];
    for (let col = startCol; col <= endCol; col++) {
      const color = ((row + col) % 2 === 0) ? CONE_COLORS.waffle : CONE_COLORS.waffle_dark;
      rects.push(`<rect x="${col * s}" y="${(row + 6) * s}" width="${s}" height="${s}" fill="${color}"/>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${rects.join('')}</svg>`;
}
