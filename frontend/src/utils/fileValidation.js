/**
 * Centralized File Upload Security Utility
 * 
 * Validates file uploads before they are read/processed.
 * Enforces:
 *   - Allowed MIME types (whitelist approach)
 *   - Max file size per upload category
 *   - Blocks dangerous file types by extension AND MIME
 * 
 * Usage:
 *   const error = validateUpload(file, 'poster');
 *   if (error) { showError(error); return; }
 */

// ── Allowed MIME types per category ──────────────────────────────────────────
export const UPLOAD_RULES = {
  poster: {
    label: 'Event Poster',
    maxBytes: 10 * 1024 * 1024,      // 10 MB (post-compression limit)
    maxBytesRaw: 25 * 1024 * 1024,   // 25 MB raw input
    allowedMime: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    allowedExt: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  },
  document: {
    label: 'Document',
    maxBytes: 10 * 1024 * 1024,      // 10 MB
    allowedMime: ['application/pdf', 'image/jpeg', 'image/png'],
    allowedExt: ['.pdf', '.jpg', '.jpeg', '.png'],
  },
  report: {
    label: 'Event Report',
    maxBytes: 20 * 1024 * 1024,      // 20 MB
    allowedMime: [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ],
    allowedExt: ['.pdf', '.xls', '.xlsx', '.csv'],
  },
  attendance: {
    label: 'Attendance Sheet',
    maxBytes: 10 * 1024 * 1024,
    allowedMime: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ],
    allowedExt: ['.xls', '.xlsx', '.csv'],
  },
  photo: {
    label: 'Photo',
    maxBytes: 15 * 1024 * 1024,
    allowedMime: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExt: ['.jpg', '.jpeg', '.png', '.webp'],
  },
};

// ── Dangerous extensions — always blocked regardless of MIME ──────────────────
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.zsh',
  '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx',
  '.php', '.py', '.rb', '.pl', '.lua',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.dll', '.so', '.dylib',
  '.html', '.htm', '.svg',
  '.vbs', '.ps1', '.psm1', '.reg',
]);

// ── Dangerous MIME types — always blocked ─────────────────────────────────────
const BLOCKED_MIME = new Set([
  'application/javascript',
  'text/javascript',
  'application/x-executable',
  'application/x-sh',
  'application/x-php',
  'application/zip',
  'application/x-rar-compressed',
  'application/x-msdownload',
  'text/html',
  'image/svg+xml', // SVGs can contain embedded scripts
]);

/**
 * Validate a File object against upload rules.
 * 
 * @param {File} file - The file to validate
 * @param {'poster'|'document'|'report'|'attendance'|'photo'} category - Upload category
 * @returns {string|null} Error message or null if valid
 */
export function validateUpload(file, category = 'document') {
  if (!file) return 'No file selected.';

  const rules = UPLOAD_RULES[category];
  if (!rules) return `Unknown upload category: ${category}`;

  const fileName = String(file.name || '').toLowerCase();
  const mimeType = String(file.type || '').toLowerCase();
  const ext = '.' + fileName.split('.').pop();

  // 1. Block dangerous extensions
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return `❌ File type "${ext}" is not allowed. Only ${rules.allowedExt.join(', ')} files are accepted.`;
  }

  // 2. Block dangerous MIME types
  if (BLOCKED_MIME.has(mimeType)) {
    return `❌ File MIME type "${mimeType}" is not permitted for security reasons.`;
  }

  // 3. Check extension is in whitelist
  if (!rules.allowedExt.includes(ext)) {
    return `❌ Invalid file type. ${rules.label} must be one of: ${rules.allowedExt.join(', ')}`;
  }

  // 4. Check MIME type is in whitelist (double validation — extension can be spoofed)
  if (mimeType && !rules.allowedMime.includes(mimeType)) {
    return `❌ Invalid file format. Expected ${rules.allowedMime.join(' or ')} but received "${mimeType}".`;
  }

  // 5. Check file size
  const maxBytes = rules.maxBytesRaw || rules.maxBytes;
  if (file.size > maxBytes) {
    const maxMB = (maxBytes / 1024 / 1024).toFixed(0);
    const fileMB = (file.size / 1024 / 1024).toFixed(1);
    return `❌ File too large (${fileMB} MB). Maximum allowed size is ${maxMB} MB.`;
  }

  // 6. Block empty files
  if (file.size === 0) {
    return '❌ File appears to be empty. Please select a valid file.';
  }

  return null; // valid
}

/**
 * Quick validation helper for image-only uploads (poster, photo).
 * Returns null on success, error string on failure.
 */
export function validateImageUpload(file) {
  return validateUpload(file, 'poster');
}

/**
 * Quick validation helper for document uploads (PDF, images).
 */
export function validateDocumentUpload(file) {
  return validateUpload(file, 'document');
}
