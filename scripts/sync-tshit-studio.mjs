#!/usr/bin/env node
/**
 * Sync TShitMintFacet → public/labmetadata/studio.json
 *
 * The renderer already synthesises metadata at request time when a V2 token
 * id is missing from studio.json, so this sync is not required for rendering
 * to work. It exists so:
 *   1) OpenSea / Etherscan metadata lookups against the static JSON file
 *      see every minted T-Shit immediately.
 *   2) The repo holds a permanent off-chain mirror of the mint history.
 *
 * Run after each mint batch (or as a cron once a day):
 *   node scripts/sync-tshit-studio.mjs
 *
 * No-op when nothing new has minted. Safe to run repeatedly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_JSON = path.join(__dirname, '..', 'public', 'labmetadata', 'studio.json');

const DIAMOND = '0x542b2B96E9c944260722a86C2ee76166A8e3D0A0';
const RPC = process.env.BASE_RPC_URL
  || `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || '5qIXA1UZxOAzi8b9l0nrYmsQBO9-W7Ot'}`;

const ABI = [
  'function tshitGetAllMintedTokens() view returns (uint256[])',
  'function tshitGetCreator(uint256) view returns (address)',
  'function tshitGetMintedAt(uint256) view returns (uint256)',
];

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const facet = new ethers.Contract(DIAMOND, ABI, provider);

  console.log('[sync-tshit] Reading on-chain mint list…');
  const ids = (await facet.tshitGetAllMintedTokens()).map((b) => b.toNumber());
  console.log(`[sync-tshit] On-chain V2 mints: ${ids.length}`);

  const raw = fs.readFileSync(STUDIO_JSON, 'utf8');
  const studio = JSON.parse(raw);
  let added = 0;

  for (const id of ids) {
    const key = String(id);
    if (studio[key]) continue;
    if (id < 30301 || id > 35000) continue;
    const ordinal = id - 30000 + 1;
    studio[key] = {
      name: `Studio T-Shit #${ordinal}`,
      category: 'SWAG',
      rarity: 'n/a',
      maxSupply: 1,
      description: 'BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger',
      external_url: 'https://adrianzero.com',
      masterminds: ['Community'],
    };
    added++;
  }

  if (added === 0) {
    console.log('[sync-tshit] studio.json already up-to-date.');
    return;
  }

  // Sort keys numerically for stable diffs
  const sorted = Object.fromEntries(
    Object.keys(studio)
      .map((k) => parseInt(k, 10))
      .sort((a, b) => a - b)
      .map((k) => [String(k), studio[String(k)]])
  );

  fs.writeFileSync(STUDIO_JSON, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`[sync-tshit] Appended ${added} entries to studio.json`);
}

main().catch((err) => {
  console.error('[sync-tshit] Error:', err);
  process.exit(1);
});
