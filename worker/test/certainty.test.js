import { describe, it, expect } from 'vitest';
import {
  TIERS,
  determineCertaintyTier,
  certaintyCap,
  tierLabel,
} from '../src/certainty.js';

describe('TIERS constants', () => {
  it('has four tiers', () => {
    expect(Object.keys(TIERS)).toHaveLength(4);
    expect(TIERS.CONFIRMED).toBe('confirmed');
    expect(TIERS.WATCH).toBe('watch');
    expect(TIERS.ESTIMATED).toBe('estimated');
    expect(TIERS.NONE).toBe('none');
  });
});

describe('determineCertaintyTier', () => {
  it('returns CONFIRMED for confirmed data with good reliability', () => {
    expect(
      determineCertaintyTier({ hasConfirmed: true, reliabilityTier: 'confirmed' })
    ).toBe('confirmed');
  });

  it('returns CONFIRMED for confirmed data with no reliability info', () => {
    expect(
      determineCertaintyTier({ hasConfirmed: true })
    ).toBe('confirmed');
  });

  it('returns WATCH for confirmed data with watch reliability', () => {
    expect(
      determineCertaintyTier({ hasConfirmed: true, reliabilityTier: 'watch' })
    ).toBe('watch');
  });

  it('returns WATCH for confirmed data with unreliable reliability', () => {
    expect(
      determineCertaintyTier({ hasConfirmed: true, reliabilityTier: 'unreliable' })
    ).toBe('watch');
  });

  it('returns ESTIMATED for forecast with high probability and depth', () => {
    expect(
      determineCertaintyTier({
        hasConfirmed: false,
        hasForecast: true,
        probability: 0.3,
        historyDepth: 50,
      })
    ).toBe('estimated');
  });

  it('returns ESTIMATED for forecast with low probability', () => {
    expect(
      determineCertaintyTier({
        hasConfirmed: false,
        hasForecast: true,
        probability: 0.02,
        historyDepth: 10,
      })
    ).toBe('estimated');
  });

  it('returns ESTIMATED for forecast with shallow history', () => {
    expect(
      determineCertaintyTier({
        hasConfirmed: false,
        hasForecast: true,
        probability: 0.5,
        historyDepth: 5,
      })
    ).toBe('estimated');
  });

  it('returns NONE when no data at all', () => {
    expect(determineCertaintyTier({})).toBe('none');
  });

  it('returns NONE with defaults', () => {
    expect(determineCertaintyTier()).toBe('none');
  });

  it('confirmed overrides forecast', () => {
    expect(
      determineCertaintyTier({
        hasConfirmed: true,
        hasForecast: true,
        probability: 0.9,
      })
    ).toBe('confirmed');
  });
});

describe('certaintyCap', () => {
  it('returns 1.0 for CONFIRMED', () => {
    expect(certaintyCap('confirmed')).toBe(1.0);
  });

  it('returns 0.7 for WATCH', () => {
    expect(certaintyCap('watch')).toBe(0.7);
  });

  it('returns probability*5 capped at 0.5 for ESTIMATED', () => {
    expect(certaintyCap('estimated', 0.05)).toBeCloseTo(0.25, 5);
    expect(certaintyCap('estimated', 0.2)).toBeCloseTo(0.5, 5);
    expect(certaintyCap('estimated', 0.5)).toBe(0.5); // capped
  });

  it('returns 0 for NONE', () => {
    expect(certaintyCap('none')).toBe(0);
  });

  it('returns 0 for unknown tier', () => {
    expect(certaintyCap('unknown')).toBe(0);
  });

  it('returns 0 for ESTIMATED with 0 probability', () => {
    expect(certaintyCap('estimated', 0)).toBe(0);
  });

  it('Confirmed > Watch > Estimated > None ordering', () => {
    const c = certaintyCap('confirmed');
    const w = certaintyCap('watch');
    const e = certaintyCap('estimated', 1.0); // max possible
    const n = certaintyCap('none');
    expect(c).toBeGreaterThan(w);
    expect(w).toBeGreaterThan(e);
    expect(e).toBeGreaterThan(n);
  });
});

describe('tierLabel', () => {
  it('returns human labels', () => {
    expect(tierLabel('confirmed')).toBe('Confirmed');
    expect(tierLabel('watch')).toBe('Watch');
    expect(tierLabel('estimated')).toBe('Estimated');
  });

  it('returns empty string for none', () => {
    expect(tierLabel('none')).toBe('');
  });

  it('returns empty string for unknown', () => {
    expect(tierLabel('bogus')).toBe('');
  });
});
