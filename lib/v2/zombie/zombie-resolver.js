// ============================================
// AZombie — on-chain detection (ZombieMintFacet on the Diamond)
// ============================================
// Cache policy:
//   - POSITIVE (token is a zombie): kept in memory; art data is immutable once minted.
//   - NEGATIVE: never cached per token. Callers either ride an RPC they already
//     make (probeMintFacets bundles the gumball check that v1 already did per
//     request) or use the global minted-list (one eth_call per minute for the whole
//     process, stale-while-revalidate) — so a freshly minted AZombie is picked up
//     within <=60 s even on paths that would otherwise serve a cached normal render.
//   - While the facet is not cut, every zombie* selector reverts (FunctionNotFound):
//     multicall allowFailure maps that to "not a zombie".

import { multicall } from '../rpc/multicall.js';
import {
  encodeGumballWasMintedHere,
  encodeZombieWasMintedHere,
  encodeZombieGetData,
  encodeZombieGetAllMintedTokens,
} from '../rpc/contracts.js';
import { parseZombieResults } from './zombie-core.js';

export { parseZombieResults };

const _known = new Map(); // tokenId -> parsed zombie data
const KNOWN_MAX = 5000;
const LIST_TTL_MS = 60 * 1000;
const LIST_TIMEOUT_MS = 1500;

let _list = null;          // Set<number>
let _listAt = 0;
let _listPromise = null;

function remember(id, z) {
  if (_known.size >= KNOWN_MAX) _known.delete(_known.keys().next().value);
  _known.set(id, z);
  if (_list) _list.add(id);
}

/**
 * One multicall for the Diamond mint facets that the v1 endpoints check per token:
 * gumballWasMintedHere + zombieWasMintedHere + zombieGetData.
 * @returns {Promise<{ok:boolean, gumballMinted:boolean|null, zombie:object|null, zombieMintedNoData:boolean}>}
 */
export async function probeMintFacets(tokenId) {
  const id = Number(tokenId);
  const known = _known.get(id);
  if (known) return { ok: true, gumballMinted: false, zombie: known, zombieMintedNoData: false };
  try {
    const r = await multicall([
      encodeGumballWasMintedHere(id),
      encodeZombieWasMintedHere(id),
      encodeZombieGetData(id),
    ]);
    const gumballMinted = r?.[0]?.success ? Boolean(r[0].data[0]) : false;
    const z = parseZombieResults(r?.[1], r?.[2]);
    if (z.zombie) remember(id, z.zombie);
    return { ok: true, gumballMinted, zombie: z.zombie, zombieMintedNoData: z.minted && !z.zombie };
  } catch (err) {
    console.error('[azombie] probeMintFacets failed:', err.message);
    return { ok: false, gumballMinted: null, zombie: null, zombieMintedNoData: false };
  }
}

async function refreshList() {
  try {
    const r = await Promise.race([
      multicall([encodeZombieGetAllMintedTokens()]),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), LIST_TIMEOUT_MS)),
    ]);
    const ids = r?.[0]?.success ? (r[0].data[0] || []).map(x => Number(x.toString())) : [];
    _list = new Set(ids);
    for (const id of _known.keys()) _list.add(id);
    _listAt = Date.now();
  } catch (err) {
    // RPC trouble: keep the previous list, retry in ~10 s instead of 60 s
    if (!_list) _list = new Set(_known.keys());
    _listAt = Date.now() - LIST_TTL_MS + 10 * 1000;
  } finally {
    _listPromise = null;
  }
  return _list;
}

/** Set of AZombie tokenIds (empty while the facet is not deployed) */
export async function getZombieList() {
  if (!_list) {
    if (!_listPromise) _listPromise = refreshList();
    return _listPromise;
  }
  if (Date.now() - _listAt > LIST_TTL_MS && !_listPromise) {
    _listPromise = refreshList(); // stale-while-revalidate, do not await
  }
  return _list;
}

/** Cheap check for paths that sit in front of a cache (no per-token RPC) */
export async function isListedZombie(tokenId) {
  const id = Number(tokenId);
  if (_known.has(id)) return true;
  const list = await getZombieList();
  return list.has(id);
}

/**
 * Early resolution for cache-fronted paths: memory hit, or listed -> fetch data.
 * @returns {Promise<object|null>} parsed zombie data or null
 */
export async function resolveZombieEarly(tokenId) {
  const id = Number(tokenId);
  if (_known.has(id)) return _known.get(id);
  if (!(await isListedZombie(id))) return null;
  const p = await probeMintFacets(id);
  return p.zombie;
}

/** Test hook */
export function _resetZombieResolver() {
  _known.clear(); _list = null; _listAt = 0; _listPromise = null;
}
