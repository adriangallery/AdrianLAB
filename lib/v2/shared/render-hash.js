// ============================================
// V2 Render Hash — Deterministic hash (V1 compatible)
// ============================================
// Re-exports V1 render-hash to maintain GitHub filename compatibility.

export {
  generateRenderHash,
  getRenderFilename,
  extractHashFromFilename,
  generateTraitHash,
  generateFloppySimpleHash,
  generateFloppyGifHash,
  generateCustomRenderHash,
} from '../../render-hash.js';
