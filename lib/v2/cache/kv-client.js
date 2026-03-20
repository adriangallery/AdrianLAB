// ============================================
// V2 KV Client — Upstash Redis abstraction
// ============================================
// Persistent cache that survives Vercel cold starts.
// Falls back to a no-op Map cache if env vars are missing,
// so the app still works without Upstash configured.

let redis = null;
let initAttempted = false;

async function getRedis() {
  if (redis) return redis;
  if (initAttempted) return null;
  initAttempted = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('[kv-client] Upstash env vars not set — using in-memory fallback');
    return null;
  }

  try {
    const { Redis } = await import('@upstash/redis');
    redis = new Redis({ url, token });
    // Quick health check
    await redis.ping();
    console.log('[kv-client] Connected to Upstash Redis');
    return redis;
  } catch (err) {
    console.error('[kv-client] Failed to connect to Upstash:', err.message);
    redis = null;
    return null;
  }
}

// In-memory fallback (volatile, same behaviour as V1)
const memCache = new Map();
const MEM_MAX = 500;

function memSet(key, value, ttlMs) {
  if (memCache.size >= MEM_MAX) {
    // Evict oldest entry
    const firstKey = memCache.keys().next().value;
    memCache.delete(firstKey);
  }
  memCache.set(key, { value, expiry: Date.now() + ttlMs });
}

function memGet(key) {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (entry.expiry < Date.now()) {
    memCache.delete(key);
    return null;
  }
  return entry.value;
}

// ===== PUBLIC API =====

/**
 * Get a value from KV (Upstash → in-memory fallback)
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export async function kvGet(key) {
  const r = await getRedis();
  if (r) {
    try {
      return await r.get(key);
    } catch (err) {
      console.warn('[kv-client] GET error, falling back to memory:', err.message);
    }
  }
  return memGet(key);
}

/**
 * Set a value in KV with TTL
 * @param {string} key
 * @param {any} value - Must be JSON-serializable (or Buffer as base64 string)
 * @param {number} ttlSeconds
 */
export async function kvSet(key, value, ttlSeconds) {
  const r = await getRedis();
  if (r) {
    try {
      await r.set(key, value, { ex: ttlSeconds });
      return;
    } catch (err) {
      console.warn('[kv-client] SET error, falling back to memory:', err.message);
    }
  }
  memSet(key, value, ttlSeconds * 1000);
}

/**
 * Delete a key from KV
 * @param {string} key
 */
export async function kvDel(key) {
  const r = await getRedis();
  if (r) {
    try {
      await r.del(key);
      return;
    } catch (err) {
      console.warn('[kv-client] DEL error:', err.message);
    }
  }
  memCache.delete(key);
}

/**
 * Get a binary buffer from KV (stored as base64)
 * @param {string} key
 * @returns {Promise<Buffer|null>}
 */
export async function kvGetBuffer(key) {
  const b64 = await kvGet(key);
  if (!b64) return null;
  try {
    return Buffer.from(b64, 'base64');
  } catch {
    return null;
  }
}

/**
 * Set a binary buffer in KV (stored as base64)
 * @param {string} key
 * @param {Buffer} buffer
 * @param {number} ttlSeconds
 */
export async function kvSetBuffer(key, buffer, ttlSeconds) {
  const b64 = buffer.toString('base64');
  await kvSet(key, b64, ttlSeconds);
}

/**
 * Check if a key exists in KV
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function kvExists(key) {
  const r = await getRedis();
  if (r) {
    try {
      return (await r.exists(key)) === 1;
    } catch (err) {
      console.warn('[kv-client] EXISTS error:', err.message);
    }
  }
  const entry = memCache.get(key);
  return entry ? entry.expiry > Date.now() : false;
}
