// ============================================
// V2 CORS — Shared CORS configuration
// ============================================

import { ALLOWED_ORIGINS } from './constants.js';

/**
 * Apply CORS headers to the response
 * @param {Object} req - Next.js request
 * @param {Object} res - Next.js response
 * @returns {boolean} - true if this was a preflight OPTIONS request (caller should return)
 */
export function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-None-Match');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
