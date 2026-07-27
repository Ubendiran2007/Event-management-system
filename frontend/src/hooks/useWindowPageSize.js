import { useState, useEffect, useCallback, useRef } from 'react';

const ROW_HEIGHT = 73; // px — approximate height of one table row (py-4 + content)
const HEADER_HEIGHT = 45; // thead
const TOOLBAR_HEIGHT = 61; // search/filter bar (when present)
const PAGINATION_HEIGHT = 57; // pagination footer
const MIN_ROWS = 3;

/**
 * Measures the height of a container ref and returns how many rows fit.
 * Falls back to `fallback` until the ref is mounted.
 */
export function useWindowPageSize(containerRef, { hasToolbar = false, fallback = 10 } = {}) {
  const [pageSize, setPageSize] = useState(fallback);

  const calculate = useCallback(() => {
    const el = containerRef?.current;
    if (!el) return;
    const available =
      el.clientHeight -
      HEADER_HEIGHT -
      PAGINATION_HEIGHT -
      (hasToolbar ? TOOLBAR_HEIGHT : 0);
    const rows = Math.max(MIN_ROWS, Math.floor(available / ROW_HEIGHT));
    setPageSize(rows);
  }, [containerRef, hasToolbar]);

  useEffect(() => {
    calculate();
    const observer = new ResizeObserver(calculate);
    if (containerRef?.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [calculate]);

  return pageSize;
}
