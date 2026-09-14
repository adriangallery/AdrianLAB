// Autenticación de /api/admin/* (plan AdrianZERO L5, 14-sep-2026).
//
// Antes 4 de los 5 endpoints de admin no pedían nada (cualquiera podía vaciar cachés
// o forzar re-renders) y el quinto solo comprobaba la clave si estaba configurada.
// Ahora es «fail closed»: sin ADMIN_API_KEY en el entorno responden 503.
import { timingSafeEqual } from 'crypto';

/** Clave enviada: `Authorization: Bearer …`, cabecera `x-admin-key` o `apiKey` en el body (legado de invalidate-render). */
export function readAdminKey(req) {
  const auth = req?.headers?.authorization || '';
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const header = req?.headers?.['x-admin-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const bodyKey = req?.body && typeof req.body === 'object' ? req.body.apiKey : undefined;
  if (typeof bodyKey === 'string' && bodyKey.trim()) return bodyKey.trim();
  return '';
}

/** Comparación en tiempo constante; false si falta cualquiera de las dos. */
export function isAdminKeyValid(given, expected) {
  if (!given || !expected) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * true si la petición trae la clave correcta. Si no, ya ha respondido (401/503) y
 * el handler debe hacer `return`.
 */
export function requireAdmin(req, res, expected = process.env.ADMIN_API_KEY) {
  if (!expected) {
    res.status(503).json({ error: 'Admin endpoints are disabled: ADMIN_API_KEY is not configured' });
    return false;
  }
  if (!isAdminKeyValid(readAdminKey(req), expected)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
