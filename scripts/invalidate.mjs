#!/usr/bin/env node
/**
 * Invalidación de punta a punta de AdrianLAB (plan AdrianZERO L5, 14-sep-2026).
 *
 *   node scripts/invalidate.mjs token 146
 *   node scripts/invalidate.mjs trait 1182 --category HAT
 *   node scripts/invalidate.mjs trait 1182 --no-opensea
 *
 * Orden: servidor (KV + renders guardados en GitHub, vía /api/admin/invalidate)
 * → re-calentar metadata e imagen con ?refresh=1 → refresh de OpenSea.
 * Antes cada admin-endpoint limpiaba solo su capa (patrón del incidente WakaZERO #815).
 *
 * Clave: ADMIN_API_KEY del entorno, o `--key-from-vercel` para leerla del proyecto
 * de Vercel con la sesión del CLI (nunca se imprime). OPENSEA_API_KEY opcional.
 * La CDN de Vercel no admite purga por URL: si hace falta, `vercel cache purge --type cdn`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.ADRIANLAB_URL || 'https://adrianlab.vercel.app').replace(/\/$/, '');
const ADRIANZERO_CONTRACT = '0x6e369bf0e4e0c106192d606fb6d85836d684da75';
const VERCEL_TEAM = process.env.VERCEL_TEAM_ID || 'team_NJrUwDRUuaTGvKN7I6DNyQKQ';

const argv = process.argv.slice(2);
const [kind, rawId] = argv;
const flag = (n) => argv.includes(n);
const opt = (n) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : undefined);
const id = Number(rawId);

function die(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

if ((kind !== 'token' && kind !== 'trait') || !Number.isInteger(id) || id <= 0) {
  die('uso: node scripts/invalidate.mjs <token|trait> <id> [--category HAT] [--no-opensea] [--key-from-vercel]');
}

async function keyFromVercel() {
  const candidates = [
    path.join(os.homedir(), 'Library/Application Support/com.vercel.cli/auth.json'),
    path.join(os.homedir(), '.local/share/com.vercel.cli/auth.json'),
  ];
  const file = candidates.find((f) => existsSync(f));
  if (!file) die('no encuentro la sesión del CLI de Vercel (vercel login)');
  const token = JSON.parse(readFileSync(file, 'utf8')).token;
  const headers = { Authorization: `Bearer ${token}` };
  const list = await (await fetch(`https://api.vercel.com/v9/projects/adrianlab/env?teamId=${VERCEL_TEAM}`, { headers })).json();
  const entry = (list.envs || []).find((e) => e.key === 'ADMIN_API_KEY' && (e.target || []).includes('production'));
  if (!entry) die('ADMIN_API_KEY no está en el proyecto adrianlab de Vercel');
  const detail = await (await fetch(`https://api.vercel.com/v1/projects/adrianlab/env/${entry.id}?teamId=${VERCEL_TEAM}`, { headers })).json();
  if (!detail.value) die('Vercel no devolvió el valor de ADMIN_API_KEY');
  return detail.value;
}

const adminKey = process.env.ADMIN_API_KEY || (flag('--key-from-vercel') ? await keyFromVercel() : '');
if (!adminKey) die('falta ADMIN_API_KEY (variable de entorno o --key-from-vercel)');

// 1. Servidor
console.log(`# Invalidando ${kind} ${id} en ${BASE}`);
const res = await fetch(`${BASE}/api/admin/invalidate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminKey}` },
  body: JSON.stringify({ kind, id, category: opt('--category') }),
});
const body = await res.json().catch(() => ({}));
if (res.status === 401 || res.status === 503) die(`el servidor rechazó la petición (${res.status}): ${body.error || ''}`);
for (const d of body.done || []) console.log(`✓ ${d.step}`);
for (const e of body.errors || []) console.log(`✖ ${e.step}: ${e.error}`);

// 2. Re-calentar (saltando la caché en memoria de la lambda)
const warm = kind === 'token'
  ? [`/api/metadata/${id}?refresh=1`, `/api/render/${id}.png?refresh=1&nocache=1`]
  : [`/api/metadata/floppy/${id}.json?refresh=1`, `/api/render/floppy/${id}.png?refresh=1&nocache=1`];
for (const p of warm) {
  const r = await fetch(`${BASE}${p}`, { headers: { 'User-Agent': 'adrianlab-invalidate' }, signal: AbortSignal.timeout(90_000) }).catch((e) => ({ status: `error ${e.message}` }));
  console.log(`${r.status === 200 ? '✓' : '✖'} re-calentado ${r.status} ${p}`);
}

// 3. OpenSea
if (flag('--no-opensea')) {
  console.log('· OpenSea omitido (--no-opensea)');
} else if (kind === 'token') {
  const headers = { 'User-Agent': 'adrianlab-invalidate' };
  if (process.env.OPENSEA_API_KEY) headers['x-api-key'] = process.env.OPENSEA_API_KEY;
  const r = await fetch(`https://api.opensea.io/api/v2/chain/base/contract/${ADRIANZERO_CONTRACT}/nfts/${id}/refresh`, { method: 'POST', headers }).catch((e) => ({ status: `error ${e.message}` }));
  console.log(`${r.status === 200 || r.status === 202 ? '✓' : '✖'} refresh OpenSea AdrianZERO #${id}: ${r.status}`);
} else {
  const r = spawnSync(process.execPath, [path.join(HERE, 'refresh-opensea.mjs'), '--ids', String(id), '--no-prewarm'], { stdio: 'inherit' });
  console.log(`${r.status === 0 ? '✓' : '✖'} refresh OpenSea trait ${id}`);
}

console.log('\n· Si la imagen sigue vieja en el borde de Vercel: vercel cache purge --type cdn (purga todo el proyecto).');
process.exit(body.ok === false ? 1 : 0);
