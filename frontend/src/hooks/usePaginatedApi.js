import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuthToken } from '../utils/api';

// Keeps loaded cursor pages available while users move between tabs or views.
const pageCache = new Map();

/**
 * Custom hook for cursor-based pagination across the app.
 * @param {string} endpoint The base API endpoint (e.g. '/api/events')
 * @param {Object} filters Object containing all query params (e.g. { status: 'PENDING', department: 'CSE' })
 * @param {Object} options Options like { limit: 20, sortBy: 'createdAt', sortOrder: 'desc' }
 */
export function usePaginatedApi(endpoint, filters = {}, options = {}) {
  const filtersKey = JSON.stringify(filters);
  const optionsKey = JSON.stringify(options);
  const cacheKey = `${endpoint}:${filtersKey}:${optionsKey}`;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination state
  const [currentCursor, setCurrentCursor] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([]);

  // Ref to prevent race conditions
  const fetchIdRef = useRef(0);

  const fetchPage = useCallback(async (cursorToFetch, historyToSet, append = false) => {
    fetchIdRef.current += 1;
    const currentFetchId = fetchIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
      
      const queryParams = new URLSearchParams();
      
      // Apply filters
      Object.entries(JSON.parse(filtersKey)).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          queryParams.append(key, val);
        }
      });

      // Apply pagination/sorting options
      const parsedOptions = JSON.parse(optionsKey);
      queryParams.append('limit', parsedOptions.limit || 20);
      if (parsedOptions.sortBy) queryParams.append('sortBy', parsedOptions.sortBy);
      if (parsedOptions.sortOrder) queryParams.append('sortOrder', parsedOptions.sortOrder);
      if (cursorToFetch) queryParams.append('cursor', cursorToFetch);

      const response = await fetch(`${baseUrl}${endpoint}?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const msg = errBody.message || `API returned ${response.status}`;
        throw new Error(response.status === 429 || response.status === 503 ? `quota: ${msg}` : msg);
      }

      const result = await response.json();

      // Only update state if this is the most recent fetch
      if (currentFetchId === fetchIdRef.current) {
        const pageData = result.data || [];
        const cachedData = pageCache.get(cacheKey)?.data || [];
        const nextData = append ? [...cachedData, ...pageData] : pageData;
        const hasNextPage = result.pagination?.hasMore || false;
        const nextCursor = result.pagination?.nextCursor || null;

        pageCache.set(cacheKey, {
          data: nextData,
          hasMore: hasNextPage,
          currentCursor: cursorToFetch,
          cursorHistory: historyToSet,
          nextCursor
        });

        setData(nextData);
        setHasMore(hasNextPage);
        setTotalCount(nextData.length);
        setCurrentCursor(cursorToFetch);
        setCursorHistory(historyToSet);
        
        // Save the next cursor provided by the API for the "Next" button
        fetchIdRef.currentNextCursor = nextCursor;
      }
    } catch (err) {
      if (currentFetchId === fetchIdRef.current) {
        console.error('Error in usePaginatedApi:', err);
        setError(err.message);
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [cacheKey, endpoint, filtersKey, optionsKey]);

  // Reset to page 1 when filters OR limit changes
  useEffect(() => {
    const cachedPage = pageCache.get(cacheKey);
    if (cachedPage) {
      setData(cachedPage.data);
      setHasMore(cachedPage.hasMore);
      setTotalCount(cachedPage.data.length);
      setCurrentCursor(cachedPage.currentCursor);
      setCursorHistory(cachedPage.cursorHistory);
      fetchIdRef.currentNextCursor = cachedPage.nextCursor;
      setLoading(false);
      return;
    }

    fetchPage(null, []);
  }, [cacheKey, fetchPage]);

  const handleNextPage = useCallback(() => {
    if (hasMore && fetchIdRef.currentNextCursor) {
      const nextCursor = fetchIdRef.currentNextCursor;
      const newHistory = [...cursorHistory, currentCursor]; // push current cursor to history
      fetchPage(nextCursor, newHistory, true);
    }
  }, [hasMore, cursorHistory, currentCursor, fetchPage]);

  const handlePrevPage = useCallback(() => {
    if (cursorHistory.length > 0) {
      const newHistory = [...cursorHistory];
      const prevCursor = newHistory.pop(); // pop the last cursor
      fetchPage(prevCursor, newHistory);
    }
  }, [cursorHistory, fetchPage]);

  const reload = useCallback(() => {
    pageCache.delete(cacheKey);
    fetchPage(null, []);
  }, [cacheKey, fetchPage]);

  return {
    data,
    loading,
    error,
    pagination: {
      hasMore,
      count: totalCount,
      hasPrevPage: cursorHistory.length > 0
    },
    actions: {
      nextPage: handleNextPage,
      prevPage: handlePrevPage,
      reload
    }
  };
}
