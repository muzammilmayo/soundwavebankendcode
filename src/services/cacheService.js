// backend/src/services/cacheService.js

/**
 * High-performance in-memory TTL caching service.
 * Supports automated TTL expiration, manual invalidation, and tag-based clearing.
 */
class CacheService {
  constructor() {
    this.cache = new Map();
    // Periodically sweep expired keys every 60 seconds
    this.cleanupInterval = setInterval(() => this.sweep(), 60000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref(); // Prevent timer from keeping Node process alive during tests
    }
  }

  /**
   * Set key-value pair with TTL in seconds (default 60s)
   */
  set(key, value, ttlSeconds = 60, tags = []) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, {
      value,
      expiresAt,
      tags: Array.isArray(tags) ? tags : [tags]
    });
  }

  /**
   * Get value by key; returns null if not found or expired
   */
  get(key) {
    const record = this.cache.get(key);
    if (!record) return null;

    if (Date.now() > record.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return record.value;
  }

  /**
   * Check if active key exists
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Delete specific key
   */
  del(key) {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a tag or pattern
   */
  invalidateTag(tag) {
    let count = 0;
    for (const [key, record] of this.cache.entries()) {
      if (record.tags && record.tags.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Invalidate keys starting with a prefix
   */
  invalidatePrefix(prefix) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Helper: Retrieve from cache or compute and cache
   */
  async getOrSet(key, fetchFn, ttlSeconds = 60, tags = []) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }
    const freshData = await fetchFn();
    this.set(key, freshData, ttlSeconds, tags);
    return freshData;
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Internal sweep of expired items
   */
  sweep() {
    const now = Date.now();
    for (const [key, record] of this.cache.entries()) {
      if (now > record.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
module.exports = new CacheService();
