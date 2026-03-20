// ============================================
// V2 Constants — Addresses, categories, origins
// ============================================

// ===== CONTRACT ADDRESSES (Base Mainnet, chainId 8453) =====
export const CONTRACTS = {
  CORE: '0x6E369BF0E4e0c106192D606FB6d85836d684DA75',
  TRAITS_EXTENSION: '0x0995c0da1ca071b792e852b6ec531b7cd7d1f8d6',
  TRAITS_CORE: '0x90546848474FB3c9fda3fdAd887969bB244E7e58',
  PATIENT_ZERO: '0x41bd1d621f9a8de8f175dd9814d9c27fabb9172f',
  SERUM_MODULE: '0xEb84a51F8d59d1C55cACFd15074AeB104D82B2ec',
  NAME_REGISTRY: '0xaeC5ED33c88c1943BB7452aC4B571ad0b4c4068C',
  ZOOMIN_ZEROS: '0x568933634be4027339c80F126C91742d41A515A0',
  SUBZERO_DEPLOYER: '0x20700BE61f2b94E08B16ebD82eE0BA46189B7305',
  BATCH_DEPLOYER: '0xA988F323023F12812c0BaD74d6C55CE07325d218',
  DUPLICATOR_MODULE: '0x70006742EC526d627a21fb3A8c458Eb5b46c3f54',
  MULTICALL3: '0xcA11bde05977b3631167028862bE2a173976CA11',
};

// ===== RPC CONFIGURATION =====
export function getRpcUrls() {
  const primary = process.env.ALCHEMY_API_KEY_PRIMARY;
  const main = process.env.ALCHEMY_API_KEY || '5qIXA1UZxOAzi8b9l0nrYmsQBO9-W7Ot';
  const fallback = process.env.ALCHEMY_API_KEY_FALLBACK || 'fgoABFGfYfI7yIPOSW7_bHPiXLQuHPjU';
  const infura = process.env.INFURA_PROJECT_ID || 'cc0c8013b1e044dcba79d4f7ec3b2ba1';

  return [
    primary ? `https://base-mainnet.g.alchemy.com/v2/${primary}` : null,
    `https://base-mainnet.g.alchemy.com/v2/${main}`,
    `https://base-mainnet.g.alchemy.com/v2/${fallback}`,
    `https://base-mainnet.infura.io/v3/${infura}`,
    'https://mainnet.base.org',
  ].filter(Boolean);
}

export const BASE_CHAIN = { name: 'Base Mainnet', chainId: 8453 };

// ===== CORS ALLOWED ORIGINS =====
export const ALLOWED_ORIGINS = [
  'https://adrianzero.com',
  'https://adrianpunks.com',
  'https://adriangallery.com',
  'https://opensea.io',
  'https://testnets.opensea.io',
  'https://rarible.com',
  'https://looksrare.org',
  'https://x2y2.io',
  'https://blur.io',
  'https://magiceden.io',
  'https://sudoswap.xyz',
  'https://reservoir.tools',
  'https://nftx.io',
  'https://element.market',
  'https://tensor.trade',
  'https://okx.com',
  'https://binance.com',
  'https://coinbase.com',
];

// ===== TRAIT LAYER ORDER =====
// Main traits rendered bottom-to-top in this order
export const TRAIT_ORDER = [
  'BEARD', 'EAR', 'RANDOMSHIT', 'SWAG', 'GEAR', 'HAIR',
  'HAT', 'HEAD', 'SKIN', 'SERUMS', 'EYES', 'MOUTH',
  'NECK', 'NOSE', 'FLOPPY DISCS', 'PAGERS',
];

// ===== CATEGORY CORRECTIONS =====
// Tokens mis-categorized in the contract
export const CATEGORY_CORRECTIONS = {
  7: 'EYES',   // 3D Glasses
  8: 'EYES',   // 3D Laser Eyes
  9: 'EYES',   // Also mis-categorized
};

// Contract returns PACKS but we render as SWAG
export const CATEGORY_MAP = { 'PACKS': 'SWAG' };

// ===== HEAD_TO_HAIR TOKENS =====
// These HEAD tokens render as HAIR
export const HEAD_TO_HAIR_TOKENS = new Set([
  14, 17, 18, 19, 21, 162, 163, 164, 165, 166, 167, 168, 169,
  170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181,
  182, 183, 184, 185, 186, 188, 190, 198, 199, 203, 204, 207,
  218, 219, 226, 236,
]);

// ===== SKIN MAPPING =====
export const SKIN_MAP = {
  '0': { type: 'mannequin' },
  '1': { type: 'Medium', name: 'Zero' },
  '2': { type: 'Dark', name: 'Dark' },
  '3': { type: 'Alien', name: 'Alien' },
  '4': { type: 'Albino', name: 'Albino' },
};

// ===== SPECIAL GEAR EXCEPTIONS =====
export const GEAR_BEFORE_SWAG = new Set([721, 726]);
export const GEAR_TOP_LAYER = new Set([48]);

// ===== SPECIAL TOKENS (metadata) =====
export const SPECIAL_TOKENS = {
  302: { image: '/labimages/specials/302.gif', name: null },
  441: { image: '/labimages/specials/441.gif', name: 'DRACULA' },
  442: { image: '/labimages/specials/442.gif', name: 'NEO-ZERO' },
  445: { image: '/labimages/specials/445.gif', name: 'THE MANAGER' },
  454: { image: '/labimages/specials/454.gif', name: 'Adrian McOrder Dash' },
  459: { image: '/labimages/specials/459.gif', name: 'AdrianSensai' },
};

// ===== TAG CONFIGS =====
export const TAG_CONFIGS = {
  SubZERO: {
    allowedEyesTraits: [1124],
    forcedSkinTrait: 1125,
    metadataGenOverride: 'SubZERO',
  },
  SamuraiZERO: {
    metadataGenOverride: 'SamuraiZERO',
    imageBaseIndex: 500,
    metadataJsonPath: '/labmetadata/samuraimetadata.json',
  },
};

// ===== TOGGLE MAPPING =====
// Toggle ID -> active effects
export const TOGGLE_MAP = {
  '1':  { closeup: true },
  '2':  { shadow: true },
  '3':  { glow: true },
  '4':  { bn: true },
  '5':  { bn: true, shadow: true },
  '6':  { bn: true, shadow: true, closeup: true },
  '7':  { shadow: true, closeup: true },
  '8':  { glow: true, closeup: true },
  '9':  { glow: true, bn: true },
  '10': { glow: true, bn: true, closeup: true },
  '11': { uv: true },
  '12': { blackout: true },
  '13': { banana: true },
};

// ===== METADATA FILE ROUTING =====
export function getMetadataFile(tokenId) {
  const n = parseInt(tokenId);
  if (n >= 10000 && n <= 10002) return { file: 'floppy.json', key: 'floppys' };
  if (n >= 15000 && n <= 15006) return { file: 'pagers.json', key: 'pagers' };
  if (n >= 15008 && n <= 15010) return { file: 'ActionPacks.json', key: 'packs' };
  if (n === 262144) return { file: 'serums.json', key: 'serums' };
  if (n >= 30000 && n <= 35000) return { file: 'studio.json', key: null };
  if (n >= 100001 && n <= 101003) return { file: 'ogpunks.json', key: 'traits' };
  return { file: 'traits.json', key: 'traits' };
}

// ===== BASE URLs =====
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
export const RAILWAY_RENDER_V2_URL = process.env.RAILWAY_RENDER_V2_URL || null;
