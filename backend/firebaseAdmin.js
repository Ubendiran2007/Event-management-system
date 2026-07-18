const admin = require('firebase-admin');

// Initialize Firebase Admin SDK using environment variables.
// The user has restarted the backend with these injected.
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_PRIVATE_KEY) {
      // Platform-agnostic env-var based initialization (no checked-in JSON)
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Replace escaped newlines if passed via certain shells/platforms
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'eventmanagement-58831.firebasestorage.app'
      });
      console.log('[Firebase Admin] Initialized successfully via environment credentials.');
    } else {
      // Fallback for Application Default Credentials (e.g. deployed to GCP, or GOOGLE_APPLICATION_CREDENTIALS)
      admin.initializeApp({
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'eventmanagement-58831.firebasestorage.app'
      });
      console.log('[Firebase Admin] Initialized successfully via default credentials.');
    }
  } catch (error) {
    console.error('[Firebase Admin] Initialization Error:', error);
  }
}

const dbAdmin = admin.firestore();
const storageAdmin = admin.storage();
const authAdmin = admin.auth();

module.exports = {
  admin,
  dbAdmin,
  storageAdmin,
  authAdmin
};
