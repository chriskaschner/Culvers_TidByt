import { getFlavorProfile } from './flavor-colors.js';

const NUTS_PATTERN = /\b(pecan|cashew|almond|walnut|hazelnut|pistachio|peanut|reeses?)\b/i;
const CHEESECAKE_PATTERN = /\bcheesecake\b/i;
const CHOCOLATE_PATTERN = /\b(chocolate|cocoa|fudge|mocha|brownie|oreo)\b/i;
const FRUIT_PATTERN = /\b(strawberry|raspberry|cherry|peach|lemon|blueberry|blackberry|mango|banana|berry)\b/i;
const CARAMEL_PATTERN = /\b(caramel|butterscotch|dulce)\b/i;
const MINT_PATTERN = /\b(mint|peppermint|andes)\b/i;
const COFFEE_PATTERN = /\b(coffee|mocha|espresso|latte)\b/i;
const SEASONAL_PATTERN = /\b(pumpkin|peppermint|eggnog|holiday|gingerbread|apple\s*cider)\b/i;
const KIDS_PATTERN = /\b(cookie|oreo|brownie|candy|sprinkle|marshmallow|m&m|snickers|reeses?)\b/i;
const PIE_CRUST_PATTERN = /\bpie\s*crust|cobbler|layer\s*cake\b/i;
const CRUNCH_PATTERN = /\bcrunch|cookie|pecan|cashew|oreo|heath|butterfinger|snickers\b/i;
const RICH_PATTERN = /\b(decadent|fudge|rich|dark\s*chocolate|volcano)\b/i;
const BRIGHT_PATTERN = /\b(lemon|berry|fruit|mint|peach|strawberry|raspberry|blackberry)\b/i;
const COOKIE_PATTERN = /\b(cookie|oreo|dough|brownie|graham)\b/i;

const TOPPING_TO_TAGS = {
  pecan: ['nuts', 'crunchy'],
  cashew: ['nuts', 'crunchy'],
  heath: ['crunchy', 'kids'],
  butterfinger: ['crunchy', 'kids'],
  cookie_dough: ['cookie', 'kids'],
  oreo: ['cookie', 'kids'],
  brownie: ['cookie', 'chocolate', 'kids'],
  pie_crust: ['pie_crust'],
  strawberry_bits: ['fruit', 'bright'],
  raspberry: ['fruit', 'bright'],
  peach_bits: ['fruit', 'bright'],
  andes: ['mint', 'bright'],
  reeses: ['nuts', 'kids'],
  snickers: ['kids', 'crunchy'],
  m_and_m: ['kids'],
  cheesecake_bits: ['cheesecake'],
  blueberry: ['fruit', 'bright'],
};

const BASE_TO_TAGS = {
  chocolate: ['chocolate', 'rich'],
  chocolate_custard: ['chocolate', 'rich'],
  dark_chocolate: ['chocolate', 'rich'],
  mint: ['mint', 'bright'],
  mint_andes: ['mint', 'bright'],
  strawberry: ['fruit', 'bright'],
  caramel: ['caramel', 'rich'],
  peach: ['fruit', 'bright'],
  lemon: ['fruit', 'bright'],
  blackberry: ['fruit', 'bright'],
  cheesecake: ['cheesecake', 'rich'],
};

const RIBBON_TO_TAGS = {
  caramel: ['caramel'],
  peanut_butter: ['nuts', 'rich', 'kids'],
  marshmallow: ['kids'],
  chocolate_syrup: ['chocolate', 'rich'],
  fudge: ['chocolate', 'rich'],
};

const VIBE_RULES = [
  { label: 'Fruity', tag: 'fruit' },
  { label: 'Pie-crust', tag: 'pie_crust' },
  { label: 'Bright', tag: 'bright' },
  { label: 'Chocolatey', tag: 'chocolate' },
  { label: 'Rich', tag: 'rich' },
  { label: 'Caramel', tag: 'caramel' },
  { label: 'Minty', tag: 'mint' },
  { label: 'Coffee', tag: 'coffee' },
  { label: 'Crunchy', tag: 'crunchy' },
  { label: 'Cookie', tag: 'cookie' },
];

function addTag(tags, tag) {
  if (tag) tags.add(tag);
}

function addTags(tags, values = []) {
  for (const value of values) {
    addTag(tags, value);
  }
}

/**
 * Extract deterministic flavor tags from profile metadata + title/description.
 */
export function extractFlavorTags(flavorName = '', description = '') {
  const tags = new Set();
  const text = `${flavorName || ''} ${description || ''}`.toLowerCase();
  const profile = getFlavorProfile(flavorName || '');

  addTags(tags, BASE_TO_TAGS[profile.base] || []);
  addTags(tags, RIBBON_TO_TAGS[profile.ribbon] || []);
  for (const topping of profile.toppings || []) {
    addTags(tags, TOPPING_TO_TAGS[topping] || []);
  }

  if (NUTS_PATTERN.test(text)) addTag(tags, 'nuts');
  if (CHEESECAKE_PATTERN.test(text)) addTag(tags, 'cheesecake');
  if (CHOCOLATE_PATTERN.test(text)) addTag(tags, 'chocolate');
  if (FRUIT_PATTERN.test(text)) addTag(tags, 'fruit');
  if (CARAMEL_PATTERN.test(text)) addTag(tags, 'caramel');
  if (MINT_PATTERN.test(text)) addTag(tags, 'mint');
  if (COFFEE_PATTERN.test(text)) addTag(tags, 'coffee');
  if (SEASONAL_PATTERN.test(text)) addTag(tags, 'seasonal');
  if (KIDS_PATTERN.test(text)) addTag(tags, 'kids');
  if (PIE_CRUST_PATTERN.test(text)) addTag(tags, 'pie_crust');
  if (CRUNCH_PATTERN.test(text)) addTag(tags, 'crunchy');
  if (RICH_PATTERN.test(text)) addTag(tags, 'rich');
  if (BRIGHT_PATTERN.test(text)) addTag(tags, 'bright');
  if (COOKIE_PATTERN.test(text)) addTag(tags, 'cookie');

  return [...tags];
}

/**
 * Select up to 3 user-facing vibe tags from a tag set.
 */
export function buildVibeTags(tags = []) {
  const set = new Set(tags);
  const vibes = [];
  for (const rule of VIBE_RULES) {
    if (set.has(rule.tag)) {
      vibes.push(rule.label);
    }
    if (vibes.length >= 3) break;
  }
  return vibes;
}

/**
 * Build dealbreaker labels from matched excluded tags.
 */
export function buildDealbreakers(excludedTags = []) {
  const set = new Set(excludedTags);
  const dealbreakers = [];
  if (set.has('nuts')) dealbreakers.push('Contains nuts');
  if (set.has('cheesecake')) dealbreakers.push('Contains cheesecake');
  return dealbreakers;
}

