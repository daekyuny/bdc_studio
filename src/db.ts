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
  deleteField,
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

export const updateUserProfile = async (
  uid: string,
  updates: Partial<UserProfile> & { phoneNumber?: string | null },
): Promise<void> => {
  const firestoreUpdates: Record<string, unknown> = { ...updates };
  if ("phoneNumber" in updates && updates.phoneNumber === null) {
    firestoreUpdates.phoneNumber = deleteField();
  }
  await updateDoc(doc(db, "users", uid), firestoreUpdates);
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

// Adds a member to the team AND adds their displayName to preferences.members in AppState
export const addMemberToTeamWithPrefs = async (
  teamId: string,
  userId: string,
  displayName: string,
): Promise<void> => {
  await updateDoc(doc(db, "teams", teamId), { memberIds: arrayUnion(userId) });
  const appState = await loadTeamState(teamId);
  if (appState) {
    const name = displayName.trim();
    if (name && !appState.preferences.members.includes(name)) {
      appState.preferences.members.push(name);
      appState.preferences.members.sort((a, b) => a.localeCompare(b));
      await saveTeamState(teamId, appState);
    }
  }
};

// Removes a member from the team AND removes their displayName from preferences.members
export const removeMemberFromTeamWithPrefs = async (
  teamId: string,
  userId: string,
  displayName: string,
): Promise<void> => {
  await updateDoc(doc(db, "teams", teamId), { memberIds: arrayRemove(userId) });
  const appState = await loadTeamState(teamId);
  if (appState) {
    appState.preferences.members = appState.preferences.members.filter(
      (m) => m !== displayName.trim(),
    );
    await saveTeamState(teamId, appState);
  }
};

export const getTeamById = async (teamId: string): Promise<Team | null> => {
  const snap = await getDoc(doc(db, "teams", teamId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Team) : null;
};

export const getUsersByIds = async (uids: string[]): Promise<UserProfile[]> => {
  if (uids.length === 0) return [];
  const profiles = await Promise.all(uids.map((uid) => getUserProfile(uid)));
  return profiles.filter((p): p is UserProfile => p !== null);
};

export const deleteTeam = async (teamId: string): Promise<void> => {
  // Fetch member list before deleting the team doc
  const teamSnap = await getDoc(doc(db, "teams", teamId));
  const memberIds: string[] = teamSnap.exists() ? (teamSnap.data().memberIds ?? []) : [];

  await deleteDoc(doc(db, "teams", teamId));

  // Best-effort cleanup of shared appdata
  try { await deleteDoc(doc(db, "appdata", teamId)); } catch { /* ignore */ }

  // Clean up each member's memo for this team
  await Promise.allSettled(
    memberIds.map((uid) =>
      updateDoc(doc(db, "users", uid), { [`memos.${teamId}`]: deleteField() })
    )
  );
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

// --- Private Memos (per-user, per-team, not shared) ---

export const getUserMemo = async (uid: string, teamId: string): Promise<string> => {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return "";
  const data = snap.data() as Record<string, unknown>;
  const memos = data.memos as Record<string, string> | undefined;
  return memos?.[teamId] ?? "";
};

export const saveUserMemo = async (uid: string, teamId: string, text: string): Promise<void> => {
  await updateDoc(doc(db, "users", uid), { [`memos.${teamId}`]: text });
};
