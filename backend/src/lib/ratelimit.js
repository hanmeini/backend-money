const buckets = new Map();

/**
 * Fixed-window rate limiter sederhana (in-memory, per proses).
 * Mengembalikan true bila request harus ditolak.
 */
export function isRateLimited(key, limit, windowMs) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return true;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return false;
}
