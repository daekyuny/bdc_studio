import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase.ts";
import { getUserProfile, createUserProfile } from "./db.ts";
import type { UserProfile } from "./types.ts";

export type { User };

export const initAuth = (
  onLogin: (user: User) => void,
  onLogout: () => void,
): void => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Await the ID token before proceeding so the Firestore SDK has time to
      // propagate the new auth state. Without this, the very first Firestore
      // call after a Google popup sign-in can fail with "Missing or insufficient
      // permissions" because onAuthStateChanged fires before Firestore's internal
      // auth listener has finished processing the new token.
      await user.getIdToken();
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

export const signInWithEmail = async (email: string, password: string): Promise<void> => {
  await signInWithEmailAndPassword(auth, email, password);
};

export const createAccountWithEmail = async (email: string, password: string): Promise<void> => {
  await createUserWithEmailAndPassword(auth, email, password);
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

export const changePassword = async (
  user: User,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  const credential = EmailAuthProvider.credential(user.email!, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
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
