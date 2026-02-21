#!/usr/bin/env node
/**
 * Generates worker/src/valid-slugs.js from site/stores.json.
 * Run whenever the store manifest is refreshed:
 *   node worker/scripts/generate-valid-slugs.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const storesPath = join(__dirname, '..', '..', 'site', 'stores.json');
const outputPath = join(__dirname, '..', 'src', 'valid-slugs.js');

const { stores } = JSON.parse(readFileSync(storesPath, 'utf8'));
const slugs = stores.map(s => s.slug).sort();

const lines = [
  '// Auto-generated from site/stores.json — do not edit manually.',
  '// Regenerate with: node worker/scripts/generate-valid-slugs.js',
  `// ${slugs.length} stores as of ${new Date().toISOString().slice(0, 10)}`,
  'export const VALID_SLUGS = new Set([',
  ...slugs.map(s => `  '${s}',`),
  ']);',
  '',
];

writeFileSync(outputPath, lines.join('\n'));
console.log(`Wrote ${slugs.length} slugs to ${outputPath}`);
