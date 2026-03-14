import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { firebaseConfig } from "./firebase-config.ts";

export const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null!;
export const auth = isFirebaseConfigured ? getAuth(app) : null!;
export const db = isFirebaseConfigured ? getFirestore(app) : null!;
export const functions = isFirebaseConfigured ? getFunctions(app, "asia-northeast3") : null!;

// Public HTTPS endpoint (onRequest) for unauthenticated decline flow
export const DECLINE_INVITATION_URL =
  "https://asia-northeast3-burndown-studio.cloudfunctions.net/declineInvitation";
