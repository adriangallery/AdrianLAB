// Decide qué rama de /api/metadata/floppy/[id] sirve un token (L4, plan AdrianZERO 2026-09).
//
// Antes cada rama tenía rangos fijos (serums 262144–262147, action packs 15008–15010, pagers
// 15000–15013), así que un serum, action pack o pager nuevo caía en la rama genérica y salía como
// «FLOPPY #<id>». Ahora esas tres ramas también aceptan cualquier id que esté en su JSON.
// El orden es exactamente el del if/else original: los ids que ya funcionaban no cambian de rama.
import fs from 'fs';
import path from 'path';

const FILES = {
  serums: { file: 'serums.json', key: 'serums', id: 'tokenId' },
  actionPacks: { file: 'ActionPacks.json', key: 'packs', id: 'packId' },
  pagers: { file: 'pagers.json', key: 'pagers', id: 'tokenId' },
};

const memo = new Map();

/** Ids presentes en un fichero de public/labmetadata (se lee una vez por lambda). */
export function labMetadataIds(kind, root = process.cwd()) {
  const spec = FILES[kind];
  if (!spec) throw new Error(`labMetadataIds: tipo desconocido ${kind}`);
  const cacheKey = `${root}:${kind}`;
  if (memo.has(cacheKey)) return memo.get(cacheKey);
  let ids = new Set();
  try {
    const data = JSON.parse(fs.readFileSync(path.join(root, 'public', 'labmetadata', spec.file), 'utf8'));
    ids = new Set((data[spec.key] || []).map((e) => parseInt(e[spec.id], 10)).filter(Number.isInteger));
  } catch (err) {
    console.error(`[floppy-metadata-routing] No se pudo leer ${spec.file}:`, err.message);
  }
  memo.set(cacheKey, ids);
  return ids;
}

const defaultHas = (kind, id) => labMetadataIds(kind).has(id);

/**
 * @param {number} id
 * @param {{ has?: (kind: 'serums'|'actionPacks'|'pagers', id: number) => boolean }} [opts]
 * @returns {'mcorder'|'trait'|'serum'|'actionPack'|'pager'|'ogpunk'|'achievement'|'studio'|'floppy'|'none'}
 */
export function classifyFloppyMetadataToken(id, { has = defaultHas } = {}) {
  if (!Number.isInteger(id) || id <= 0) return 'none';
  if (id === 15014) return 'mcorder';
  if (id >= 1 && id <= 9999 && id !== 1123) return 'trait';
  if ((id >= 262144 && id <= 262147) || (id >= 10000 && has('serums', id))) return 'serum';
  if ((id >= 15008 && id <= 15010) || (id >= 10000 && has('actionPacks', id))) return 'actionPack';
  if ((id >= 15000 && id <= 15013) || (id >= 10000 && has('pagers', id))) return 'pager';
  if (id >= 100001 && id <= 101003) return 'ogpunk';
  if (id >= 20000 && id <= 20099) return 'achievement';
  if (id >= 30000 && id <= 35000) return 'studio';
  if (id === 1123 || id >= 10000) return 'floppy';
  return 'none';
}
