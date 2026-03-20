// Temporary debug endpoint — DELETE after fixing samurai issue
import { fetchAllTokenData } from '../../../../lib/v2/rpc/token-data-fetcher.js';
import { getSamuraiIndex } from '../../../../lib/v2/tags/tag-resolver.js';
import { normalizeTraits, getLayerSequence, getTraitLoadPath } from '../../../../lib/v2/render/layer-order.js';
import { loadTraitImage } from '../../../../lib/v2/render/trait-loader.js';
import { TAG_CONFIGS } from '../../../../lib/v2/shared/constants.js';

export default async function handler(req, res) {
  const tokenId = parseInt(req.query.tokenId);
  const log = [];

  try {
    log.push(`Fetching data for token ${tokenId}...`);
    const data = await fetchAllTokenData(tokenId);
    log.push(`tagInfo: ${JSON.stringify(data.tagInfo)}`);
    log.push(`skinId: ${data.skinId}, skinName: ${data.skinName}`);
    log.push(`categories: [${data.categories}], traitIds: [${data.traitIds}]`);

    let samuraiIndex = null;
    if (data.tagInfo?.tag === 'SamuraiZERO') {
      samuraiIndex = await getSamuraiIndex(tokenId);
      log.push(`getSamuraiIndex(${tokenId}) = ${samuraiIndex}`);
      data._samuraiIndex = samuraiIndex;
    }

    let equippedTraits = normalizeTraits(data.categories, data.traitIds);
    log.push(`normalizeTraits: ${JSON.stringify(equippedTraits)}`);

    if (data.tagInfo?.tag === 'SamuraiZERO' && samuraiIndex !== null && samuraiIndex >= 0 && samuraiIndex < 600) {
      const imageIndex = TAG_CONFIGS.SamuraiZERO.imageBaseIndex + samuraiIndex;
      equippedTraits['TOP'] = String(imageIndex);
      log.push(`SamuraiZERO TOP set to: ${imageIndex}`);
    }

    const layers = getLayerSequence(equippedTraits, new Set());
    log.push(`layers: ${JSON.stringify(layers)}`);

    for (const layer of layers) {
      const { subdir, customPath } = getTraitLoadPath(layer.category, layer.traitId, data.tagInfo);
      log.push(`loadTraitImage(${layer.category}, ${layer.traitId}, subdir=${subdir}, customPath=${customPath})`);

      const img = await loadTraitImage(layer.category, layer.traitId, { subdir, customPath });
      log.push(`  result: ${img ? `OK (${img.width}x${img.height})` : 'NULL'}`);
    }

  } catch (err) {
    log.push(`ERROR: ${err.message}\n${err.stack}`);
  }

  res.status(200).json({ tokenId, log });
}
