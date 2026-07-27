import React, { useEffect, useRef } from 'react';
import { Loader2, Search, AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * A highly reusable, purely presentational DataTable component supporting cursor pagination.
 * 
 * Props:
 * - columns: Array of { key, label, render(item) }
 * - data: Array of data items
 * - pagination: Object { hasMore, count } from API
 * - loading: Boolean indicating initial or page load
 * - emptyState: ReactNode to display when data is empty
 * - onNextPage: Function to call for next page
 * - onPrevPage: Function to call for previous page
 * - hasPrevPage: Boolean indicating if a previous page is available in history
 * - searchPlaceholder: String for search input
 * - onSearch: Function(searchTerm)
 * - filters: ReactNode for custom filter dropdowns/controls
 */
export default function DataTable({
  columns = [],
  data = [],
  pagination = null,
  loading = false,
  error = null,
  onRetry,
  emptyState,
  onNextPage,
  searchPlaceholder = "Search...",
  onSearch,
  filters = null,
  containerRef = null
}) {
  const tableViewportRef = useRef(null);
  const isEmpty = !loading && !error && data.length === 0;
  const isLoading = loading && data.length === 0;

  useEffect(() => {
    const viewport = tableViewportRef.current;
    const needsMoreRows = viewport && viewport.scrollHeight <= viewport.clientHeight + 96;

    if (needsMoreRows && pagination?.hasMore && !loading) {
      onNextPage?.();
    }
  }, [data.length, loading, onNextPage, pagination?.hasMore]);

  const handleTableScroll = (event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 96 && pagination?.hasMore && !loading) {
      onNextPage?.();
    }
  };

  return (
    <div ref={containerRef} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-0 h-full">
      {/* Toolbar: Search and Filters */}
      {(onSearch || filters) && (
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-center justify-between shrink-0">
          {onSearch && (
            <div className="relative max-w-md w-full sm:w-auto flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                onChange={(e) => onSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
          {filters && <div className="flex items-center gap-3">{filters}</div>}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-0 p-8">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <p className="font-bold text-slate-700 text-base mb-1">Failed to load data</p>
          <p className="text-sm text-slate-400 text-center max-w-xs mb-4">
            {error.includes('quota') || error.includes('429') || error.includes('resource-exhausted')
              ? 'Database quota exceeded. Please try again later or contact the administrator.'
              : 'An error occurred while fetching data. Please try again.'}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          )}
        </div>
      )}

      {/* Loading state — fills full remaining space */}
      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-0">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-500">Loading data...</p>
        </div>
      )}

      {/* Empty state — fills full remaining space */}
      {isEmpty && (
        <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-0">
          {emptyState ?? (
            <div className="text-center space-y-2 px-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="font-bold text-slate-700 text-base">No data found</p>
              <p className="text-sm text-slate-400">There are no records matching your current filters.</p>
            </div>
          )}
        </div>
      )}

      {/* Table — only shown when data exists */}
      {!isLoading && !isEmpty && !error && (
        <div ref={tableViewportRef} onScroll={handleTableScroll} className="overflow-auto no-scrollbar flex-1 min-h-0">
          <table className="w-full text-left text-sm h-full">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                {columns.map((col, idx) => (
                  <th key={col.key || idx} className="px-6 py-3 font-medium whitespace-nowrap text-xs uppercase tracking-wider">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {data.map((item, rowIndex) => (
                <tr key={item.id || rowIndex} className="hover:bg-slate-50/50 transition-colors">
                  {columns.map((col, colIndex) => (
                    <td key={col.key || colIndex} className="px-6 py-4 whitespace-nowrap">
                      {col.render ? col.render(item) : item[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {loading && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm font-medium text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Loading more...
            </div>
          )}
        </div>
      )}

      {/* Pagination Controls — always pinned to bottom */}
    </div>
  );
}
