#!/usr/bin/env node
/**
 * Generate hero cone PNG assets for all flavors in FLAVOR_PROFILES.
 *
 * Uses the Worker's renderConeHeroSVG (36x42 grid) at scale 4 (= 144x168px),
 * then rasterizes each SVG to PNG at native 144x168px resolution via sharp at 300 DPI.
 *
 * Output: docs/assets/cones/{slug}.png for each flavor.
 *
 * Usage: node scripts/generate-hero-cones.mjs
 */

import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Import the flavor-colors module from the Worker source
const {
  FLAVOR_PROFILES,
  renderConeHeroSVG,
  getFlavorProfile,
  BASE_COLORS,
  RIBBON_COLORS,
  TOPPING_COLORS,
  CONE_COLORS,
  CONE_TIP_COLOR,
} = await import(join(ROOT, 'worker', 'src', 'flavor-colors.js'));

// Import sharp -- required dependency, fail fast if unavailable.
// Resolve from worker/node_modules since sharp is installed there.
let sharp;
try {
  const sharpMod = await import('sharp');
  sharp = sharpMod.default || sharpMod;
} catch {
  try {
    const require = createRequire(join(ROOT, 'worker', 'package.json'));
    sharp = require('sharp');
  } catch {
    console.error('sharp is required. Install with: cd worker && npm install');
    process.exit(1);
  }
}

const CONES_DIR = join(ROOT, 'docs', 'assets', 'cones');
mkdirSync(CONES_DIR, { recursive: true });

/**
 * Convert a flavor name to a slug for the PNG filename.
 */
function flavorSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Generate SVG string for a flavor using the hero renderer.
 * Scale 4 = 144x168px SVG, rasterized 1:1 at 300 DPI.
 */
function generateSVG(flavorName) {
  return renderConeHeroSVG(flavorName, 4);
}

/**
 * Convert SVG string to PNG buffer via sharp at 300 DPI.
 * Rasterizes at 300 DPI for crisp sub-pixel edges, then resizes to native
 * 144x168 with nearest-neighbor to preserve pixel-art grid alignment.
 * Embeds 300 DPI metadata in the output PNG.
 */
async function svgToPng(svgString) {
  const svgBuffer = Buffer.from(svgString);
  return sharp(svgBuffer, { density: 300 })
    .resize({ width: 144, height: 168, kernel: 'nearest' })
    .png()
    .withMetadata({ density: 300 })
    .toBuffer();
}

// Get all flavor names from FLAVOR_PROFILES
const flavorNames = Object.keys(FLAVOR_PROFILES);
console.log(`Generating hero cone PNGs for ${flavorNames.length} flavors...`);

let generated = 0;
let errors = 0;

for (const flavorName of flavorNames) {
  const slug = flavorSlug(flavorName);
  const outputPath = join(CONES_DIR, slug + '.png');
  const svg = generateSVG(flavorName);

  try {
    const pngBuffer = await svgToPng(svg);
    writeFileSync(outputPath, pngBuffer);
    generated++;
    process.stdout.write(`  [${generated}/${flavorNames.length}] ${slug}.png\n`);
  } catch (err) {
    errors++;
    console.error(`  FAILED: ${slug}.png -- ${err.message}`);
  }
}

// Verify output dimensions and DPI on first generated PNG
if (generated > 0) {
  const firstPng = join(CONES_DIR, flavorSlug(flavorNames[0]) + '.png');
  const meta = await sharp(firstPng).metadata();
  console.log('Verification: ' + meta.width + 'x' + meta.height + 'px, ' + meta.density + ' DPI');
  if (meta.width !== 144 || meta.height !== 168) {
    console.error('WARNING: unexpected dimensions ' + meta.width + 'x' + meta.height + ', expected 144x168');
  }
}

console.log(`\nDone: ${generated} generated, ${errors} errors, ${flavorNames.length} total flavors.`);

// Verify output
const { readdirSync } = await import('fs');
const pngFiles = readdirSync(CONES_DIR).filter(f => f.endsWith('.png'));
console.log(`Files in docs/assets/cones/: ${pngFiles.length} PNGs`);
