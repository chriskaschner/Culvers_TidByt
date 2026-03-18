#!/usr/bin/env node
/**
 * Post-processing pipeline for AI-generated cone PNGs.
 *
 * Trims transparent borders, resizes to 288x336 (2x retina of 144x168) with
 * nearest-neighbor kernel to preserve pixel art crispness, and optimizes PNG
 * output at max compression.
 *
 * Usage:
 *   node scripts/postprocess_ai_cones.mjs                     # Process all candidates
 *   node scripts/postprocess_ai_cones.mjs --slug vanilla      # Process one flavor
 *   node scripts/postprocess_ai_cones.mjs --output-dir ./out  # Override output dir
 *   node scripts/postprocess_ai_cones.mjs --help
 */

import { createRequire } from 'module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CANDIDATES_DIR = path.join(ROOT, 'docs', 'assets', 'ai-candidates');

// Import sharp -- resolve from worker/node_modules if not globally available.
let sharp;
try {
  const sharpMod = await import('sharp');
  sharp = sharpMod.default || sharpMod;
} catch {
  try {
    const require = createRequire(path.join(ROOT, 'worker', 'package.json'));
    sharp = require('sharp');
  } catch {
    console.error('sharp is required. Install with: cd worker && npm install');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Processing pipeline
// ---------------------------------------------------------------------------

/**
 * Process a single AI-generated PNG: trim, resize to 288x336, optimize.
 *
 * @param {string} inputPath - Path to raw AI-generated PNG
 * @param {string} outputPath - Path for processed output
 * @returns {object} { originalSize, processedSize }
 */
async function processImage(inputPath, outputPath) {
  const inputStat = await fs.stat(inputPath);

  await sharp(inputPath)
    .trim({ threshold: 5 })           // Conservative trim
    .resize({
      width: 288,                      // 2x retina (144x2)
      height: 336,                     // 2x retina (168x2)
      fit: 'contain',
      kernel: 'nearest',               // Preserve pixel art crispness
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({
      compressionLevel: 9,
      palette: false,                  // Keep full RGBA
    })
    .withMetadata({ density: 300 })
    .toFile(outputPath);

  const outputStat = await fs.stat(outputPath);
  return {
    originalSize: inputStat.size,
    processedSize: outputStat.size,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage() {
  console.log(`Usage:
  node scripts/postprocess_ai_cones.mjs
    Process all PNG files in docs/assets/ai-candidates/*/

  node scripts/postprocess_ai_cones.mjs --slug <slug>
    Process only files for one flavor slug

  node scripts/postprocess_ai_cones.mjs --output-dir <path>
    Override output directory (default: in-place with -processed suffix)

  node scripts/postprocess_ai_cones.mjs --help
    Show this help`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const slugFilter = args.includes('--slug')
    ? args[args.indexOf('--slug') + 1]
    : null;
  const outputDirOverride = args.includes('--output-dir')
    ? args[args.indexOf('--output-dir') + 1]
    : null;

  // Discover all candidate PNGs
  let slugDirs;
  try {
    const entries = await fs.readdir(CANDIDATES_DIR, { withFileTypes: true });
    slugDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    console.error(`Error: Candidates directory not found: ${CANDIDATES_DIR}`);
    console.error('Run tools/generate_cone_art.mjs first to generate candidates.');
    process.exit(1);
  }

  if (slugFilter) {
    if (!slugDirs.includes(slugFilter)) {
      console.error(`Error: No candidate directory for slug "${slugFilter}".`);
      process.exit(1);
    }
    slugDirs = [slugFilter];
  }

  // Collect all PNG files (excluding already-processed ones)
  const filesToProcess = [];
  for (const slug of slugDirs) {
    const dirPath = path.join(CANDIDATES_DIR, slug);
    const files = await fs.readdir(dirPath);
    const pngs = files.filter(
      (f) => f.endsWith('.png') && !f.includes('-processed'),
    );
    for (const png of pngs) {
      filesToProcess.push({ slug, filename: png });
    }
  }

  if (filesToProcess.length === 0) {
    console.log('No candidate PNGs found to process.');
    return;
  }

  console.log(`Processing ${filesToProcess.length} images...\n`);

  let processed = 0;
  let errors = 0;

  for (const { slug, filename } of filesToProcess) {
    const inputPath = path.join(CANDIDATES_DIR, slug, filename);
    const outputFilename = filename.replace('.png', '-processed.png');

    let outputPath;
    if (outputDirOverride) {
      const outSlugDir = path.join(outputDirOverride, slug);
      await fs.mkdir(outSlugDir, { recursive: true });
      outputPath = path.join(outSlugDir, outputFilename);
    } else {
      outputPath = path.join(CANDIDATES_DIR, slug, outputFilename);
    }

    try {
      const { originalSize, processedSize } = await processImage(inputPath, outputPath);
      processed++;
      console.log(
        `[${processed}/${filesToProcess.length}] ${filename} -> ${outputFilename} (${originalSize} -> ${processedSize} bytes)`,
      );
    } catch (err) {
      errors++;
      console.error(`FAILED: ${slug}/${filename} -- ${err.message}`);
    }
  }

  console.log(
    `\nDone: ${processed} processed, ${errors} errors, ${filesToProcess.length} total.`,
  );

  // Verify metadata of the first processed file
  if (processed > 0) {
    const first = filesToProcess[0];
    const firstOutputName = first.filename.replace('.png', '-processed.png');
    const firstOutputPath = outputDirOverride
      ? path.join(outputDirOverride, first.slug, firstOutputName)
      : path.join(CANDIDATES_DIR, first.slug, firstOutputName);

    try {
      const meta = await sharp(firstOutputPath).metadata();
      console.log(
        `\nVerification: ${meta.width}x${meta.height}px, ${meta.density || 'unknown'} DPI, ${meta.format}`,
      );
      if (meta.width !== 288 || meta.height !== 336) {
        console.error(
          `WARNING: unexpected dimensions ${meta.width}x${meta.height}, expected 288x336`,
        );
      }
    } catch (err) {
      console.error(`Verification failed: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
