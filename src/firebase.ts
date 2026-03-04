import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Replace with your Firebase project configuration.
// Firebase Console → Project Settings → Your Apps → SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyAZpppRwFu_6Btal0JPyqMdQd91U8PUZ2U",
  authDomain: "burndown-studio.firebaseapp.com",
  projectId: "burndown-studio",
  storageBucket: "burndown-studio.firebasestorage.app",
  messagingSenderId: "805909518243",
  appId: "1:805909518243:web:44449e9adb9002538cec16",
  measurementId: "G-F650JSH9YX"
};

export const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null!;
export const auth = isFirebaseConfigured ? getAuth(app) : null!;
export const db = isFirebaseConfigured ? getFirestore(app) : null!;
