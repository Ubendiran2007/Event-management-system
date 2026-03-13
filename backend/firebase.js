const { initializeApp, getApps } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');

// Same config as frontend/src/firebase.js — no service account key needed
const firebaseConfig = {
  apiKey: 'AIzaSyAIhoO4Xf-pGPR5pWwFpuaq03p5R8e1cqI',
  authDomain: 'eventmanagement-58831.firebaseapp.com',
  projectId: 'eventmanagement-58831',
  storageBucket: 'eventmanagement-58831.firebasestorage.app',
  messagingSenderId: '39022760443',
  appId: '1:39022760443:web:61af07a7e264075163fb5e',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

module.exports = { db };
