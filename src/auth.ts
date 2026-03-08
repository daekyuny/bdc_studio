import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase.ts";
import { getUserProfile, createUserProfile } from "./db.ts";
import type { UserProfile } from "./types.ts";

export type { User };

const DEV_PASSWORD = "dev-local-123";

export const initAuth = (
  onLogin: (user: User) => void,
  onLogout: () => void,
): void => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      onLogin(user);
    } else {
      onLogout();
    }
  });
};

export const signInWithGoogle = async (): Promise<void> => {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
};

export const signInWithFakeEmail = async (email: string): Promise<void> => {
  if (window.location.hostname !== "localhost") return;
  try {
    // Try creating the account first; if it already exists, sign in instead
    await createUserWithEmailAndPassword(auth, email, DEV_PASSWORD);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "auth/email-already-in-use") {
      await signInWithEmailAndPassword(auth, email, DEV_PASSWORD);
    } else {
      throw err;
    }
  }
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

// Returns the existing profile, or null if the user has never registered.
export const ensureUserProfile = async (
  user: User,
): Promise<UserProfile | null> => {
  return await getUserProfile(user.uid);
};

// Called only after the user explicitly confirms registration.
export const createNewUserProfile = async (user: User): Promise<UserProfile> => {
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? user.email ?? "Unknown",
    // Always 'member' — Firestore rules enforce this.
    // To bootstrap the first super_manager, update the role field
    // directly in the Firebase Console after the user registers.
    role: "member",
    createdAt: new Date().toISOString(),
  };
  await createUserProfile(profile);
  return profile;
};
