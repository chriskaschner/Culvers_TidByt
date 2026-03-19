#!/usr/bin/env node
/**
 * Map non-Culver's flavors to Culver's cone assets where profiles match.
 * Outputs: which can reuse a Culver's PNG, which need unique generation.
 */

import fs from 'node:fs';

const fills = JSON.parse(fs.readFileSync('docs/assets/masterlock-flavor-fills.json', 'utf-8'));
const culversKeys = new Set(JSON.parse(fs.readFileSync('tools/culvers_flavors.json', 'utf-8')));

// Build profile signature -> Culver's flavor map
const profileSig = (p) => JSON.stringify({ base: p.base, ribbon: p.ribbon, toppings: [...(p.toppings || [])].sort(), density: p.density });

const culversProfiles = {};
const nonCulvers = [];

for (const f of fills.flavors) {
  const profile = f.profile;
  if (!profile) continue;
  const sig = profileSig(profile);

  if (culversKeys.has(f.flavor_key)) {
    if (!culversProfiles[sig]) culversProfiles[sig] = [];
    culversProfiles[sig].push(f.flavor_key);
  } else {
    nonCulvers.push({ key: f.flavor_key, sig, profile });
  }
}

const canReuse = [];
const needsGeneration = [];

for (const nc of nonCulvers) {
  const match = culversProfiles[nc.sig];
  if (match) {
    canReuse.push({ flavor: nc.key, reuse: match[0], profile: nc.profile });
  } else {
    needsGeneration.push({ flavor: nc.key, profile: nc.profile });
  }
}

console.log('=== Can Reuse Culver\'s Cone (' + canReuse.length + ') ===');
for (const r of canReuse) {
  console.log(' ', r.flavor, '->', r.reuse);
}

console.log('');
console.log('=== Needs Unique Generation (' + needsGeneration.length + ') ===');
for (const n of needsGeneration) {
  const p = n.profile;
  console.log(' ', n.flavor, '| base:', p.base, '| ribbon:', p.ribbon, '| toppings:', (p.toppings || []).join(', '), '| density:', p.density);
}
