import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  updateDoc,
  onSnapshot,
  query,
  where,
  arrayUnion,
  arrayRemove,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase.ts";
import type { AppState, UserProfile, Team, UserRole } from "./types.ts";

// --- User Profile ---

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
};

export const createUserProfile = async (profile: UserProfile): Promise<void> => {
  await setDoc(doc(db, "users", profile.uid), profile);
};

export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>): Promise<void> => {
  await updateDoc(doc(db, "users", uid), updates as Record<string, unknown>);
};

// --- Teams ---

export const getTeamsForUser = async (userId: string, role: UserRole): Promise<Team[]> => {
  if (role === "super_manager") {
    const snap = await getDocs(collection(db, "teams"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Team));
  }
  const snap = await getDocs(
    query(collection(db, "teams"), where("memberIds", "array-contains", userId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Team));
};

export const createTeam = async (name: string, ownerId: string): Promise<string> => {
  const ref = doc(collection(db, "teams"));
  await setDoc(ref, {
    name,
    ownerId,
    memberIds: [ownerId],
    createdAt: new Date().toISOString(),
  });
  return ref.id;
};

export const addMemberToTeam = async (teamId: string, userEmail: string): Promise<void> => {
  const snap = await getDocs(
    query(collection(db, "users"), where("email", "==", userEmail)),
  );
  if (snap.empty) throw new Error(`No user found with email: ${userEmail}`);
  const userId = snap.docs[0].id;
  await updateDoc(doc(db, "teams", teamId), { memberIds: arrayUnion(userId) });
};

export const addMemberToTeamById = async (teamId: string, userId: string): Promise<void> => {
  await updateDoc(doc(db, "teams", teamId), { memberIds: arrayUnion(userId) });
};

export const removeMemberFromTeam = async (teamId: string, userId: string): Promise<void> => {
  await updateDoc(doc(db, "teams", teamId), { memberIds: arrayRemove(userId) });
};

export const deleteTeam = async (teamId: string): Promise<void> => {
  await deleteDoc(doc(db, "teams", teamId));
  // Best-effort cleanup of shared appdata
  try { await deleteDoc(doc(db, "appdata", teamId)); } catch { /* ignore */ }
};

// --- AppState ---

export const loadTeamState = async (teamId: string): Promise<AppState | null> => {
  const snap = await getDoc(doc(db, "appdata", teamId));
  return snap.exists() ? (snap.data() as AppState) : null;
};

export const saveTeamState = async (teamId: string, state: AppState): Promise<void> => {
  // Deep-clone to strip undefined fields before writing to Firestore
  await setDoc(doc(db, "appdata", teamId), JSON.parse(JSON.stringify(state)));
};

export const subscribeToTeamState = (
  teamId: string,
  callback: (state: AppState) => void,
): Unsubscribe => {
  return onSnapshot(doc(db, "appdata", teamId), (snap) => {
    if (snap.exists()) {
      callback(snap.data() as AppState);
    }
  });
};

// --- Admin ---

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => d.data() as UserProfile);
};

export const setUserRole = async (userId: string, role: UserRole): Promise<void> => {
  await updateDoc(doc(db, "users", userId), { role });
};

export const deleteUserProfile = async (userId: string): Promise<void> => {
  // Remove from all teams first
  const teamsSnap = await getDocs(
    query(collection(db, "teams"), where("memberIds", "array-contains", userId)),
  );
  await Promise.all(
    teamsSnap.docs.map((d) => updateDoc(doc(db, "teams", d.id), { memberIds: arrayRemove(userId) })),
  );
  // Delete the user profile document
  await deleteDoc(doc(db, "users", userId));
};
