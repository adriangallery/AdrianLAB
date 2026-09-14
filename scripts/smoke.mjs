#!/usr/bin/env node
/**
 * Smoke tests de AdrianLAB (plan AdrianZERO L6, 14-sep-2026).
 *
 * Los curls de RECON_ADRIANLAB_2026-09-12 §5, actualizados con lo que ya está en
 * producción: rutas de metadata duplicadas → 308 (L2), token inexistente → 404
 * (H3), serums/floppies por su JSON (L4).
 *
 * Uso:
 *   node scripts/smoke.mjs                              # contra producción
 *   BASE_URL=https://adrianlab-git-rama-adrianlab.vercel.app node scripts/smoke.mjs
 *
 * Sin dependencias (Node ≥ 18). Un reintento por check para absorber cold starts
 * (~11 s en v2/render y trait). Pocas llamadas de render a propósito (fair-use de Vercel).
 */

const BASE = (process.env.BASE_URL || process.argv[2] || 'https://adrianlab.vercel.app').replace(/\/$/, '');

const CHECKS = [
  { path: '/api/metadata/1', status: 200, type: 'application/json', json: (d) => typeof d.name === 'string' && typeof d.image === 'string' },
  { path: '/api/render/1.png', status: 200, type: 'image/png', minBytes: 2000 },
  { path: '/api/v2/metadata/1', status: 200, type: 'application/json', json: (d) => typeof d.name === 'string' },
  { path: '/api/v2/render/1', status: 200, type: 'image/png', minBytes: 2000 },
  { path: '/api/metadata/floppy/10003.json', status: 200, json: (d) => d.name === 'GLITCH Floppy' },
  { path: '/api/metadata/floppy/262144.json', status: 200, json: (d) => d.name === 'AdrianGF' },
  { path: '/api/metadata/floppy/15013.json', status: 200, json: (d) => d.name === 'Wizz-Potion' },
  { path: '/api/floppy/metadata/10003', status: 308, location: '/api/metadata/floppy/10003.json' },
  { path: '/api/trait/943', status: 200, type: 'image/png', minBytes: 500 },
  { path: '/api/render/custom-external/1?trait=943', status: 200, type: 'image/png', minBytes: 2000 },
  { path: '/api/metadata/999999', status: 404 },
];

async function once(check) {
  const started = Date.now();
  const res = await fetch(BASE + check.path, {
    redirect: 'manual',
    headers: { 'User-Agent': 'adrianlab-smoke' },
    signal: AbortSignal.timeout(90_000),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const ms = Date.now() - started;
  const problems = [];
  if (res.status !== check.status) problems.push(`HTTP ${res.status} (esperado ${check.status})`);
  const type = res.headers.get('content-type') || '';
  if (check.type && !type.startsWith(check.type)) problems.push(`content-type ${type || '—'}`);
  if (check.minBytes && buf.length < check.minBytes) problems.push(`${buf.length} B < ${check.minBytes}`);
  if (check.location) {
    const loc = res.headers.get('location') || '';
    if (!loc.includes(check.location)) problems.push(`location ${loc || '—'}`);
  }
  if (check.json && res.status === check.status) {
    try {
      if (!check.json(JSON.parse(buf.toString('utf8')))) problems.push('JSON sin el contenido esperado');
    } catch {
      problems.push('respuesta no es JSON');
    }
  }
  return { ok: problems.length === 0, status: res.status, bytes: buf.length, ms, problems, retryable: res.status >= 500 };
}

let failures = 0;
console.log(`Smoke AdrianLAB → ${BASE}\n`);
for (const check of CHECKS) {
  let result;
  try {
    result = await once(check);
    if (!result.ok && result.retryable) result = await once(check);
  } catch (err) {
    try {
      result = await once(check);
    } catch (err2) {
      result = { ok: false, status: 0, bytes: 0, ms: 0, problems: [String(err2?.message ?? err2 ?? err)] };
    }
  }
  if (!result.ok) failures++;
  console.log(`${result.ok ? '✓' : '✖'} ${String(result.status).padEnd(3)} ${String(result.ms).padStart(6)} ms ${String(result.bytes).padStart(7)} B  ${check.path}${result.ok ? '' : `  → ${result.problems.join('; ')}`}`);
}

console.log(`\n${CHECKS.length - failures}/${CHECKS.length} OK`);
process.exit(failures ? 1 : 0);
