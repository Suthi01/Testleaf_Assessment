/**
 * Simple In-Memory Cache for Phase 8 Production Readiness
 */

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class Cache<T> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private defaultTTL: number = 3600000; // 1 hour in milliseconds

  /**
   * Set cache entry
   */
  set(key: string, data: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs || this.defaultTTL);
    this.store.set(key, { data, expiresAt });
  }

  /**
   * Get cache entry
   */
  get(key: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.store.get(key);

    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Clean expired entries
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * Caches for different purposes
 */
export const modelCache = new Cache();
export const chainCache = new Cache();
export const documentCache = new Cache();

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  modelCache.clear();
  chainCache.clear();
  documentCache.clear();
}

/**
 * Cleanup expired entries from all caches
 */
export function cleanupAllCaches(): number {
  const modelCleaned = modelCache.cleanup();
  const chainCleaned = chainCache.cleanup();
  const docCleaned = documentCache.cleanup();

  return modelCleaned + chainCleaned + docCleaned;
}
