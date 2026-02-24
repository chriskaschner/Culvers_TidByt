/**
 * Certainty tier determination for the custard planner.
 *
 * Three explicit tiers:
 *   Confirmed -- schedule data from the store, good reliability
 *   Watch     -- schedule data present but store has reliability issues
 *   Estimated -- probabilistic fill when no schedule data
 *   None      -- no data available
 */

export const TIERS = {
  CONFIRMED: 'confirmed',
  WATCH: 'watch',
  ESTIMATED: 'estimated',
  NONE: 'none',
};

/**
 * Determine certainty tier from available data signals.
 *
 * @param {Object} opts
 * @param {boolean} opts.hasConfirmed - Whether confirmed schedule data exists
 * @param {boolean} opts.hasForecast - Whether forecast data exists
 * @param {number}  opts.probability - Forecast probability (0-1)
 * @param {number}  opts.historyDepth - Number of historical observations
 * @param {string}  opts.reliabilityTier - Store reliability tier ('confirmed', 'watch', 'unreliable')
 * @returns {string} One of TIERS values
 */
export function determineCertaintyTier(opts = {}) {
  const {
    hasConfirmed = false,
    hasForecast = false,
    probability = 0,
    historyDepth = 0,
    reliabilityTier,
  } = opts;

  if (hasConfirmed) {
    if (reliabilityTier === 'watch' || reliabilityTier === 'unreliable') {
      return TIERS.WATCH;
    }
    return TIERS.CONFIRMED;
  }

  if (hasForecast && probability > 0.04 && historyDepth >= 30) {
    return TIERS.ESTIMATED;
  }

  if (hasForecast) {
    return TIERS.ESTIMATED;
  }

  return TIERS.NONE;
}

/**
 * Cap the effective certainty score based on tier.
 * Used in the planner scoring formula to ensure Confirmed always outscores Estimated.
 *
 * @param {string} tier - Certainty tier
 * @param {number} probability - Raw probability (0-1), relevant for Estimated tier
 * @returns {number} Capped certainty score (0-1)
 */
export function certaintyCap(tier, probability = 0) {
  switch (tier) {
    case TIERS.CONFIRMED:
      return 1.0;
    case TIERS.WATCH:
      return 0.7;
    case TIERS.ESTIMATED:
      // Scale by probability but cap at 0.5 so Estimated never beats Watch
      return Math.min(0.5, probability * 5);
    case TIERS.NONE:
    default:
      return 0;
  }
}

/**
 * Human-readable label for a certainty tier.
 * @param {string} tier
 * @returns {string}
 */
export function tierLabel(tier) {
  switch (tier) {
    case TIERS.CONFIRMED: return 'Confirmed';
    case TIERS.WATCH: return 'Watch';
    case TIERS.ESTIMATED: return 'Estimated';
    default: return '';
  }
}
