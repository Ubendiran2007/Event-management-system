const { db } = require('../firebaseClientWrapper');

/**
 * Encodes a cursor from document fields based on orderBy fields.
 * @param {Object} docSnap Firestore document snapshot (or wrapped snapshot)
 * @param {Array<string>} sortFields Array of field names used in orderBy. e.g. ['createdAt', '__name__']
 * @returns {string|null} Base64 encoded cursor
 */
const encodeCursor = (docSnap, sortFields) => {
  if (!docSnap) return null;
  const values = sortFields.map(field => {
    if (field === '__name__') return docSnap.id;
    return typeof docSnap.get === 'function' ? docSnap.get(field) : docSnap[field];
  });
  return Buffer.from(JSON.stringify(values)).toString('base64');
};

/**
 * Decodes a cursor string back into field values.
 * @param {string} cursor Base64 encoded cursor
 * @returns {Array<any>|null} Array of values for startAfter
 */
const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch (err) {
    console.error('Failed to decode cursor:', err);
    return null;
  }
};

/**
 * Standardizes API pagination response.
 * @param {Array} allDocs Fetch result of (limit + 1) docs
 * @param {number} limit Number of items requested
 * @param {Array<string>} sortFields Fields used for orderBy
 * @param {Function} dataMapper Optional mapper function to convert docSnap to data object. 
 * @returns {Object} { success: true, data, pagination: { limit, hasMore, nextCursor, count } }
 */
const formatPaginatedResponse = (allDocs, limit, sortFields, dataMapper = null) => {
  const hasMore = allDocs.length > limit;
  const dataDocs = hasMore ? allDocs.slice(0, limit) : allDocs;
  
  const lastDoc = dataDocs.length > 0 ? dataDocs[dataDocs.length - 1] : null;
  const nextCursor = lastDoc ? encodeCursor(lastDoc, sortFields) : null;

  const data = dataDocs.map(d => {
    if (dataMapper) return dataMapper(d);
    return typeof d.data === 'function' ? { id: d.id, ...d.data() } : d;
  });

  return {
    success: true,
    data,
    pagination: {
      limit,
      hasMore,
      nextCursor,
      count: data.length
    }
  };
};

/**
 * Validates and parses common pagination query params.
 * @param {Object} query req.query
 * @param {number} defaultLimit Default limit if none provided
 * @param {number} maxLimit Max allowed limit
 * @returns {Object} { limit, cursor, sortOrder, sortBy }
 */
const parsePaginationParams = (query, defaultLimit = 20, maxLimit = 100) => {
  let parsedLimit = parseInt(query.limit, 10);
  if (isNaN(parsedLimit) || parsedLimit <= 0) parsedLimit = defaultLimit;
  if (parsedLimit > maxLimit) parsedLimit = maxLimit;

  return {
    limit: parsedLimit,
    cursor: query.cursor || null,
    sortBy: query.sortBy || 'createdAt',
    sortOrder: query.sortOrder === 'asc' ? 'asc' : 'desc'
  };
};

module.exports = {
  encodeCursor,
  decodeCursor,
  formatPaginatedResponse,
  parsePaginationParams
};
