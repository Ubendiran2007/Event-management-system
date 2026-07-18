import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { app } from "../firebase";

const storage = getStorage(app);

// Validation Limits
export const LIMITS = {
  POSTER: 5 * 1024 * 1024,      // 5 MB
  GALLERY: 10 * 1024 * 1024,    // 10 MB
  DOCUMENT: 20 * 1024 * 1024,   // 20 MB
};

export const ALLOWED_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/jpg'],
  DOCUMENT: ['application/pdf'],
};

/**
 * Validates a file before upload
 * @param {File} file 
 * @param {string} type 'IMAGE' | 'DOCUMENT'
 * @param {number} maxSizeInBytes 
 * @returns {string|null} Error message or null if valid
 */
export const validateFile = (file, type, maxSizeInBytes) => {
  if (!file) return "No file provided.";
  
  if (type === 'IMAGE' && !ALLOWED_TYPES.IMAGE.includes(file.type)) {
    return "Invalid file type. Only JPG/PNG allowed.";
  }
  
  if (type === 'DOCUMENT' && !ALLOWED_TYPES.DOCUMENT.includes(file.type)) {
    return "Invalid file type. Only PDF allowed.";
  }

  if (file.size > maxSizeInBytes) {
    return `File size exceeds the maximum limit of ${maxSizeInBytes / (1024 * 1024)}MB.`;
  }

  return null; // Valid
};

/**
 * Uploads a file to Firebase Storage
 * @param {File} file 
 * @param {string} path e.g., 'events/123/poster.jpg'
 * @param {Function} onProgress Callback for upload progress
 * @returns {Promise<Object>} Metadata object
 */
export const uploadFileToStorage = (file, path, onProgress = null) => {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress) {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        }
      },
      (error) => {
        console.error("Storage upload error:", error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            storagePath: path,
            downloadURL,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            uploadedAt: new Date().toISOString()
          });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
};

/**
 * Deletes a file from Firebase Storage
 * @param {string} path 
 */
export const deleteFileFromStorage = async (path) => {
  if (!path) return;
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    // Ignore object not found errors (e.g. if it was already deleted)
    if (error.code !== 'storage/object-not-found') {
      console.error("Storage deletion error:", error);
    }
  }
};
