import { useState, useEffect } from 'react';

/**
 * Custom hook for debouncing a value
 * Delays updates to the value until after the specified delay period
 * @param {*} value - The value to debounce
 * @param {number} delay - Delay in milliseconds (default: 300)
 * @returns {*} The debounced value
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Create a timeout that updates the debounced value
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup the timeout if the component unmounts or the value changes
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Search result caching utility
 * Stores search results to avoid redundant API calls
 */
export class SearchCache {
  constructor(maxSize = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get cached results for a search query
   * @param {string} query - The search query
   * @param {string} category - The category filter
   * @returns {Array|null} The cached results or null if not found
   */
  get(query, category = '') {
    const key = this.getKey(query, category);
    return this.cache.get(key);
  }

  /**
   * Set cached results for a search query
   * @param {string} query - The search query
   * @param {Array} results - The search results
   * @param {string} category - The category filter
   */
  set(query, results, category = '') {
    const key = this.getKey(query, category);
    
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      results,
      timestamp: Date.now()
    });
  }

  /**
   * Clear the entire cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Generate a cache key from query and category
   * @private
   */
  getKey(query, category) {
    return `${query.toLowerCase().trim()}|${category}`;
  }

  /**
   * Check if a cache entry is still valid (less than 5 minutes old)
   * @private
   */
  isValid(cacheEntry) {
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - cacheEntry.timestamp < fiveMinutes;
  }

  /**
   * Get cached results if they're still valid
   * @param {string} query - The search query
   * @param {string} category - The category filter
   * @returns {Array|null} The cached results or null if not found or expired
   */
  getIfValid(query, category = '') {
    const key = this.getKey(query, category);
    const cacheEntry = this.cache.get(key);
    
    if (cacheEntry && this.isValid(cacheEntry)) {
      return cacheEntry.results;
    }
    
    // Remove expired entry
    if (cacheEntry) {
      this.cache.delete(key);
    }
    
    return null;
  }
}

export default useDebounce;
