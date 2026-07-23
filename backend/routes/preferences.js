const express = require('express');
const router = express.Router();
const { dbAdmin } = require('../firebaseAdmin');

// Middleware to mock auth in this environment
// In production, this would use a real verifyToken middleware
const getUserId = (req) => {
  const userId = req.query.userId || req.body.userId;
  if (!userId) throw new Error('userId is required');
  return userId;
};

/**
 * GET /api/preferences
 * Returns the user's notification preferences.
 */
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    const db = dbAdmin;
    const prefDoc = await db.collection('notification_preferences').doc(userId).get();

    if (!prefDoc.exists) {
      // Return default preferences
      return res.status(200).json({
        success: true,
        data: {
          global: { IN_APP: true, EMAIL: true },
          categories: {}
        }
      });
    }

    res.status(200).json({ success: true, data: prefDoc.data() });
  } catch (error) {
    console.error(`[PreferencesAPI] GET Error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/preferences
 * Updates the user's notification preferences.
 */
router.put('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { global, categories } = req.body;
    
    if (!global && !categories) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    const db = dbAdmin;
    await db.collection('notification_preferences').doc(userId).set({
      global: global || { IN_APP: true, EMAIL: true },
      categories: categories || {},
      updatedAt: new Date().toISOString()
    }, { merge: true });

    res.status(200).json({ success: true, message: 'Preferences updated successfully' });
  } catch (error) {
    console.error(`[PreferencesAPI] PUT Error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
