import { describe, it, expect } from 'vitest';
import {
  getFlavorProfile,
  renderConeSVG,
  BASE_COLORS,
  FLAVOR_PROFILES,
} from '../src/flavor-colors.js';

describe('getFlavorProfile', () => {
  it('returns exact match for known flavor', () => {
    const profile = getFlavorProfile('Mint Explosion');
    expect(profile.base).toBe('mint');
    expect(profile.toppings).toContain('oreo');
    expect(profile.density).toBe('explosion');
  });

  it('normalizes unicode curly quotes', () => {
    // \u2019 = right single curly quote
    const profile = getFlavorProfile('really reese\u2019s');
    expect(profile.base).toBe('chocolate');
    expect(profile.ribbon).toBe('peanut_butter');
  });

  it('falls back to keyword match for unknown flavor', () => {
    const profile = getFlavorProfile('Triple Mint Surprise');
    expect(profile.base).toBe('mint');
  });

  it('returns default vanilla profile for completely unknown flavor', () => {
    const profile = getFlavorProfile('Unicorn Rainbow');
    expect(profile.base).toBe('vanilla');
    expect(profile.ribbon).toBeNull();
    expect(profile.toppings).toEqual([]);
    expect(profile.density).toBe('standard');
  });
});

describe('renderConeSVG', () => {
  it('returns valid SVG markup', () => {
    const svg = renderConeSVG('Mint Explosion');
    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('<rect');
    expect(svg).toContain('</svg>');
  });

  it('uses correct base color for flavor', () => {
    const svg = renderConeSVG('Mint Explosion');
    // Mint base color
    expect(svg).toContain(BASE_COLORS.mint);

    const chocolateSvg = renderConeSVG('Dark Chocolate Decadence');
    expect(chocolateSvg).toContain(BASE_COLORS.dark_chocolate);
  });
});
