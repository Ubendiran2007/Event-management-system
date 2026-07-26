import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for cursor-based pagination across the app.
 * @param {string} endpoint The base API endpoint (e.g. '/api/events')
 * @param {Object} filters Object containing all query params (e.g. { status: 'PENDING', department: 'CSE' })
 * @param {Object} options Options like { limit: 20, sortBy: 'createdAt', sortOrder: 'desc' }
 */
export function usePaginatedApi(endpoint, filters = {}, options = {}) {
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

  const fetchPage = useCallback(async (cursorToFetch, historyToSet) => {
    fetchIdRef.current += 1;
    const currentFetchId = fetchIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('sessionToken') || localStorage.getItem('token') || '';
      const baseUrl = import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com';
      
      const queryParams = new URLSearchParams();
      
      // Apply filters
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          queryParams.append(key, val);
        }
      });

      // Apply pagination/sorting options
      queryParams.append('limit', options.limit || 20);
      if (options.sortBy) queryParams.append('sortBy', options.sortBy);
      if (options.sortOrder) queryParams.append('sortOrder', options.sortOrder);
      if (cursorToFetch) queryParams.append('cursor', cursorToFetch);

      const response = await fetch(`${baseUrl}${endpoint}?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const result = await response.json();

      // Only update state if this is the most recent fetch
      if (currentFetchId === fetchIdRef.current) {
        setData(result.data || []);
        setHasMore(result.pagination?.hasMore || false);
        setTotalCount(result.pagination?.count || result.data?.length || 0);
        setCurrentCursor(cursorToFetch);
        setCursorHistory(historyToSet);
        
        // Save the next cursor provided by the API for the "Next" button
        if (result.pagination?.nextCursor) {
          fetchIdRef.currentNextCursor = result.pagination.nextCursor;
        } else {
          fetchIdRef.currentNextCursor = null;
        }
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
  }, [endpoint, JSON.stringify(filters), JSON.stringify(options)]);

  // Initial load or when filters change
  useEffect(() => {
    fetchPage(null, []);
  }, [fetchPage]);

  const handleNextPage = useCallback(() => {
    if (hasMore && fetchIdRef.currentNextCursor) {
      const nextCursor = fetchIdRef.currentNextCursor;
      const newHistory = [...cursorHistory, currentCursor]; // push current cursor to history
      fetchPage(nextCursor, newHistory);
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
    // Keep current page if possible, otherwise reset to start
    fetchPage(currentCursor, cursorHistory);
  }, [currentCursor, cursorHistory, fetchPage]);

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
