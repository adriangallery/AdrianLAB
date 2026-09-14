// POST /api/admin/invalidate — purga de punta a punta del lado servidor (plan AdrianZERO L5).
// Body: { kind: 'token' | 'trait', id: number, category?: string }
// Lo llama scripts/invalidate.mjs, que después re-calienta y refresca OpenSea.
import { requireAdmin } from '../../../lib/admin-auth.js';
import { kvDel } from '../../../lib/v2/cache/kv-client.js';
import { metadataKey, tokenDataKey, traitPngKey } from '../../../lib/v2/cache/cache-keys.js';
import { deleteAllRendersForToken, deleteFileFromGitHub } from '../../../lib/github-storage.js';
import {
  getTraitFilename,
  generateTraitHash,
  getFloppySimpleFilename,
  generateFloppySimpleHash,
} from '../../../lib/render-hash.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!requireAdmin(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { kind, id, category } = req.body || {};
  const n = Number(id);
  if ((kind !== 'token' && kind !== 'trait') || !Number.isInteger(n) || n <= 0) {
    return res.status(400).json({ error: "Body must be { kind: 'token' | 'trait', id: positive integer, category?: string }" });
  }

  const done = [];
  const errors = [];
  const step = async (label, fn) => {
    try {
      const result = await fn();
      done.push({ step: label, result: result === undefined ? true : result });
    } catch (err) {
      errors.push({ step: label, error: String(err?.message ?? err) });
    }
  };

  if (kind === 'token') {
    await step(`KV ${metadataKey(n)}`, () => kvDel(metadataKey(n)));
    await step(`KV ${tokenDataKey(n)}`, () => kvDel(tokenDataKey(n)));
    await step('GitHub: renders guardados del token', () => deleteAllRendersForToken(n));
  } else {
    if (category) {
      const key = traitPngKey(String(category).toUpperCase(), n);
      await step(`KV ${key}`, () => kvDel(key));
    }
    await step('GitHub: render del trait', () =>
      deleteFileFromGitHub(`public/rendered-traits/${getTraitFilename(n, generateTraitHash(n))}`, `Invalidación L5 del trait ${n}`),
    );
    await step('GitHub: floppy simple', () =>
      deleteFileFromGitHub(
        `public/rendered-traits/${getFloppySimpleFilename(n, generateFloppySimpleHash(n))}`,
        `Invalidación L5 del floppy simple ${n}`,
      ),
    );
  }

  return res.status(errors.length ? 207 : 200).json({
    ok: errors.length === 0,
    kind,
    id: n,
    done,
    errors,
    note: 'La caché en memoria de cada lambda caduca sola; scripts/invalidate.mjs re-calienta con ?refresh=1 y refresca OpenSea.',
  });
}
