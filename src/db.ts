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
import type { AppState, UserProfile, Team, UserRole, Group, Invitation, PmRequest, PreRegistration } from "./types.ts";

// --- User Profile ---

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
};

export const getUserProfileByEmail = async (email: string): Promise<UserProfile | null> => {
  const snap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
  return snap.empty ? null : (snap.docs[0].data() as UserProfile);
};

export const createUserProfile = async (profile: UserProfile): Promise<void> => {
  await setDoc(doc(db, "users", profile.uid), profile);
};

export const updateUserProfile = async (
  uid: string,
  updates: Partial<UserProfile> & { phoneNumber?: string | null; groupId?: string | null },
): Promise<void> => {
  const firestoreUpdates: Record<string, unknown> = { ...updates };
  if ("phoneNumber" in updates && updates.phoneNumber === null) {
    firestoreUpdates.phoneNumber = deleteField();
  }
  if ("groupId" in updates && updates.groupId === null) {
    firestoreUpdates.groupId = deleteField();
  }
  if ("photoThumb" in updates && updates.photoThumb === null) {
    firestoreUpdates.photoThumb = deleteField();
  }
  if ("photoFull" in updates && updates.photoFull === null) {
    firestoreUpdates.photoFull = deleteField();
  }
  await updateDoc(doc(db, "users", uid), firestoreUpdates);
};

// --- Teams ---

export const getTeamsManagedBy = async (userId: string): Promise<Team[]> => {
  const snap = await getDocs(
    query(collection(db, "teams"), where("ownerId", "==", userId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Team));
};

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

export const createTeam = async (name: string, ownerId: string, groupId = ""): Promise<string> => {
  const ref = doc(collection(db, "teams"));
  await setDoc(ref, {
    name,
    ownerId,
    memberIds: [ownerId],
    groupId,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
};

export const getAllTeams = async (): Promise<Team[]> => {
  const snap = await getDocs(collection(db, "teams"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Team));
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

  // Clean up each member's private memo for this team
  await Promise.allSettled(
    memberIds.map((uid) =>
      deleteDoc(doc(db, "users", uid, "memos", teamId))
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

// --- Private Memos (per-user, per-team; stored in /users/{uid}/memos/{teamId}) ---
// Only readable/writable by the owning user or a super_manager (Firestore rules enforce this).

export const getUserMemo = async (uid: string, teamId: string): Promise<string> => {
  const snap = await getDoc(doc(db, "users", uid, "memos", teamId));
  if (!snap.exists()) return "";
  return (snap.data() as { text?: string }).text ?? "";
};

export const saveUserMemo = async (uid: string, teamId: string, text: string): Promise<void> => {
  await setDoc(doc(db, "users", uid, "memos", teamId), { text });
};

// --- Groups ---

export const createGroup = async (name: string, ownerId: string): Promise<string> => {
  const ref = doc(collection(db, "groups"));
  await setDoc(ref, { name, ownerId, createdAt: new Date().toISOString() });
  await updateDoc(doc(db, "users", ownerId), { groupId: ref.id });
  return ref.id;
};

export const getGroupById = async (groupId: string): Promise<Group | null> => {
  const snap = await getDoc(doc(db, "groups", groupId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Group) : null;
};

export const getGroupByOwner = async (ownerId: string): Promise<Group | null> => {
  const snap = await getDocs(
    query(collection(db, "groups"), where("ownerId", "==", ownerId)),
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Group;
};

export const updateGroupName = async (groupId: string, name: string): Promise<void> => {
  await updateDoc(doc(db, "groups", groupId), { name });
};

export const getAllGroups = async (): Promise<Group[]> => {
  const snap = await getDocs(collection(db, "groups"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
};

export const getTeamsByGroup = async (groupId: string, ownerUid?: string): Promise<Team[]> => {
  // PM path: query by ownerId so Firestore can verify resource.data.ownerId == request.auth.uid
  // SM path: query by groupId (isSuperManager() satisfies the rule for all docs)
  const snap = ownerUid
    ? await getDocs(query(collection(db, "teams"), where("ownerId", "==", ownerUid)))
    : await getDocs(query(collection(db, "teams"), where("groupId", "==", groupId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Team));
};

export const getGroupMemberProfiles = async (groupId: string): Promise<UserProfile[]> => {
  const snap = await getDocs(
    query(collection(db, "users"), where("groupId", "==", groupId)),
  );
  return snap.docs.map((d) => d.data() as UserProfile);
};

export const removeGroupMember = async (
  groupId: string,
  userId: string,
  displayName: string,
  groupOwnerId?: string,
): Promise<void> => {
  const teams = await getTeamsByGroup(groupId, groupOwnerId);
  await Promise.all(
    teams.map(async (t) => {
      if (!t.memberIds.includes(userId)) return;
      await updateDoc(doc(db, "teams", t.id), { memberIds: arrayRemove(userId) });
      const appState = await loadTeamState(t.id);
      if (appState && displayName.trim()) {
        appState.preferences.members = appState.preferences.members.filter(
          (m) => m !== displayName.trim(),
        );
        await saveTeamState(t.id, appState);
      }
    }),
  );
  await updateDoc(doc(db, "users", userId), { groupId: deleteField() });
};

// Back-link existing teams owned by ownerId to groupId; also set groupId on their members (migration).
export const linkExistingTeamsToGroup = async (ownerId: string, groupId: string): Promise<void> => {
  const snap = await getDocs(
    query(collection(db, "teams"), where("ownerId", "==", ownerId)),
  );
  const memberIds = new Set<string>();
  await Promise.all(
    snap.docs.map(async (d) => {
      await updateDoc(doc(db, "teams", d.id), { groupId });
      const data = d.data();
      ((data.memberIds as string[]) ?? []).forEach((id) => memberIds.add(id));
    }),
  );
  memberIds.delete(ownerId);
  await Promise.all(
    Array.from(memberIds).map(async (uid) => {
      try {
        const userSnap = await getDoc(doc(db, "users", uid));
        if (userSnap.exists() && !userSnap.data().groupId) {
          await updateDoc(doc(db, "users", uid), { groupId });
        }
      } catch { /* ignore missing profiles */ }
    }),
  );
};

// --- Invitations ---

export const createInvitation = async (inv: Omit<Invitation, "id">): Promise<string> => {
  const ref = doc(collection(db, "invitations"));
  await setDoc(ref, inv);
  return ref.id;
};

export const getInvitation = async (inviteId: string): Promise<(Invitation & { id: string }) | null> => {
  const snap = await getDoc(doc(db, "invitations", inviteId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Invitation & { id: string }) : null;
};

export const updateInvitation = async (inviteId: string, updates: Partial<Invitation>): Promise<void> => {
  await updateDoc(doc(db, "invitations", inviteId), updates as Record<string, unknown>);
};

export const getInvitationsByGroup = async (groupId: string): Promise<(Invitation & { id: string })[]> => {
  const snap = await getDocs(
    query(collection(db, "invitations"), where("groupId", "==", groupId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invitation & { id: string }));
};

// --- PM Requests ---

export const createPmRequest = async (req: Omit<PmRequest, "id">): Promise<string> => {
  const ref = doc(collection(db, "pm_requests"));
  await setDoc(ref, req);
  return ref.id;
};

export const getPmRequest = async (requestId: string): Promise<(PmRequest & { id: string }) | null> => {
  const snap = await getDoc(doc(db, "pm_requests", requestId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as PmRequest & { id: string }) : null;
};

export const getAllPmRequests = async (): Promise<(PmRequest & { id: string })[]> => {
  const snap = await getDocs(collection(db, "pm_requests"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PmRequest & { id: string }));
};

export const updatePmRequest = async (requestId: string, updates: Partial<PmRequest>): Promise<void> => {
  await updateDoc(doc(db, "pm_requests", requestId), updates as Record<string, unknown>);
};

// --- Pre-Registrations ---

export const createPreregistrations = async (entries: Omit<PreRegistration, "claimedBy" | "claimedAt">[]): Promise<string[]> => {
  const ids: string[] = [];
  await Promise.all(
    entries.map(async (entry) => {
      const ref = doc(collection(db, "preregistrations"));
      await setDoc(ref, { ...entry, email: entry.email.toLowerCase().trim() });
      ids.push(ref.id);
    }),
  );
  return ids;
};

export const getPreregistrationByEmail = async (email: string): Promise<(PreRegistration & { id: string }) | null> => {
  const normalised = email.toLowerCase().trim();
  const snap = await getDocs(
    query(collection(db, "preregistrations"), where("email", "==", normalised), where("status", "==", "pending")),
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as PreRegistration & { id: string };
};

export const getPreregistrationsByGroup = async (groupId: string, createdBy: string): Promise<(PreRegistration & { id: string })[]> => {
  const snap = await getDocs(
    query(collection(db, "preregistrations"), where("groupId", "==", groupId), where("createdBy", "==", createdBy)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PreRegistration & { id: string }));
};

export const updatePreregistration = async (id: string, updates: Partial<PreRegistration>): Promise<void> => {
  await updateDoc(doc(db, "preregistrations", id), updates as Record<string, unknown>);
};

// --- App Settings ---

export const getAppSettings = async (): Promise<{ pmRequestDisabled?: boolean }> => {
  const snap = await getDoc(doc(db, "settings", "app"));
  return snap.exists() ? (snap.data() as { pmRequestDisabled?: boolean }) : {};
};

export const setAppSetting = async (key: string, value: unknown): Promise<void> => {
  await setDoc(doc(db, "settings", "app"), { [key]: value }, { merge: true });
};
