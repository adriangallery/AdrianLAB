#!/usr/bin/env node
// ============================================
// Pre-render all trait SVGs to PNGs → KV + disk
// ============================================
// Run once: node scripts/prerender-traits.js
// Re-run after adding new traits.
//
// Scans /public/labimages/*.svg, /public/traits/**/*.svg,
// /public/labimages/samuraizero/*.svg, /public/labimages/ogpunks/*.svg
// Converts each SVG to 1000x1000 PNG using Resvg.
// Stores in Upstash KV and optionally writes to disk.

import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import { storeTraitPng, traitPngExists } from '../lib/v2/cache/trait-png-store.js';

const PUBLIC = path.join(process.cwd(), 'public');

// Directories to scan
const SCAN_DIRS = [
  { dir: 'labimages', category: 'LABIMG', pattern: /^(\d+)\.svg$/ },
  { dir: 'labimages/samuraizero', category: 'SAMURAI', pattern: /^(\d+)\.svg$/ },
  { dir: 'labimages/ogpunks', category: 'OGPUNK', pattern: /^(\d+)\.svg$/ },
];

// Category-organized traits
const TRAIT_CATEGORIES = [
  'ADRIAN', 'ADRIANGF', 'BACKGROUND', 'BEARD', 'EAR', 'EYES',
  'GEAR', 'HAIR', 'HAT', 'HEAD', 'MOUTH', 'NECK', 'NOSE',
  'RANDOMSHIT', 'SKIN', 'SKINTRAIT', 'SWAG', 'TOP',
  'FLOPPY', 'PAGERS',
];

function svgToPng(svgContent) {
  const resvg = new Resvg(svgContent, {
    fitTo: { mode: 'width', value: 1000 },
  });
  return resvg.render().asPng();
}

async function scanAndConvert(dirPath, category, pattern) {
  const fullDir = path.join(PUBLIC, dirPath);
  if (!fs.existsSync(fullDir)) {
    console.log(`  Skipping ${dirPath} (not found)`);
    return { total: 0, converted: 0, skipped: 0 };
  }

  const files = fs.readdirSync(fullDir).filter(f => pattern.test(f));
  let converted = 0;
  let skipped = 0;

  for (const file of files) {
    const match = file.match(pattern);
    if (!match) continue;
    const traitId = match[1];

    // Check if already in KV
    const exists = await traitPngExists(category, traitId);
    if (exists) {
      skipped++;
      continue;
    }

    try {
      const svgPath = path.join(fullDir, file);
      const svgContent = fs.readFileSync(svgPath, 'utf8');
      const pngBuffer = svgToPng(svgContent);
      await storeTraitPng(category, traitId, pngBuffer);
      converted++;

      if (converted % 50 === 0) {
        console.log(`  ${category}: ${converted} converted...`);
      }
    } catch (err) {
      console.error(`  Error converting ${category}/${traitId}: ${err.message}`);
    }
  }

  return { total: files.length, converted, skipped };
}

async function scanCategoryTraits() {
  let totalConverted = 0;
  let totalSkipped = 0;

  for (const cat of TRAIT_CATEGORIES) {
    const dirPath = `traits/${cat}`;
    const fullDir = path.join(PUBLIC, dirPath);
    if (!fs.existsSync(fullDir)) continue;

    const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.svg'));

    for (const file of files) {
      const traitId = path.basename(file, '.svg');

      const exists = await traitPngExists(cat, traitId);
      if (exists) {
        totalSkipped++;
        continue;
      }

      try {
        const svgPath = path.join(fullDir, file);
        const svgContent = fs.readFileSync(svgPath, 'utf8');
        const pngBuffer = svgToPng(svgContent);
        await storeTraitPng(cat, traitId, pngBuffer);
        totalConverted++;
      } catch (err) {
        console.error(`  Error converting ${cat}/${traitId}: ${err.message}`);
      }
    }

    if (files.length > 0) {
      console.log(`  ${cat}: ${files.length} files scanned`);
    }
  }

  return { converted: totalConverted, skipped: totalSkipped };
}

async function main() {
  console.log('=== Pre-rendering trait SVGs to PNGs ===\n');

  let grandTotal = { converted: 0, skipped: 0 };

  // Flat directories
  for (const { dir, category, pattern } of SCAN_DIRS) {
    console.log(`Scanning ${dir}...`);
    const result = await scanAndConvert(dir, category, pattern);
    console.log(`  ${result.total} files: ${result.converted} converted, ${result.skipped} skipped\n`);
    grandTotal.converted += result.converted;
    grandTotal.skipped += result.skipped;
  }

  // Category-organized traits
  console.log('Scanning traits/ categories...');
  const catResult = await scanCategoryTraits();
  console.log(`  ${catResult.converted} converted, ${catResult.skipped} skipped\n`);
  grandTotal.converted += catResult.converted;
  grandTotal.skipped += catResult.skipped;

  console.log('=== DONE ===');
  console.log(`Total: ${grandTotal.converted} converted, ${grandTotal.skipped} already cached`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
