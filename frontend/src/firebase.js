// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAIhoO4Xf-pGPR5pWwFpuaq03p5R8e1cqI",
  authDomain: "eventmanagement-58831.firebaseapp.com",
  projectId: "eventmanagement-58831",
  storageBucket: "eventmanagement-58831.firebasestorage.app",
  messagingSenderId: "39022760443",
  appId: "1:39022760443:web:61af07a7e264075163fb5e",
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, db, storage };