import { signInWithGoogle, signInWithFakeEmail, signOut } from "./auth.ts";
import {
  getTeamsForUser,
  getTeamsManagedBy,
  loadTeamState,
  createTeam,
  addMemberToTeamWithPrefs,
  removeMemberFromTeamWithPrefs,
  getAllUsers,
  setUserRole,
  deleteUserProfile,
  deleteTeam,
  updateUserProfile,
} from "./db.ts";
import type { User } from "firebase/auth";
import type { UserProfile, Team, UserRole } from "./types.ts";

// Module-level state for the back-navigation in admin screen
let _currentUser: User | null = null;
let _currentProfile: UserProfile | null = null;
let _onTeamSelected: ((teamId: string, teamName: string) => void) | null = null;

const getContainer = (): HTMLElement => {
  let el = document.getElementById("screen-overlays");
  if (!el) {
    el = document.createElement("div");
    el.id = "screen-overlays";
    document.body.appendChild(el);
  }
  return el;
};

const clearContainer = (): void => {
  const el = document.getElementById("screen-overlays");
  if (el) el.innerHTML = "";
};

export const hideAllScreens = (): void => clearContainer();

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------------------------------------------------------------------
// Login Screen
// ---------------------------------------------------------------------------

export const showLoginScreen = (): void => {
  clearContainer();
  const isLocal = window.location.hostname === "localhost";

  getContainer().innerHTML = `
    <div class="screen-overlay" id="loginScreen">
      <div class="screen-card login-card">
        <p class="eyebrow">Sprint Burndown</p>
        <h1 class="screen-title">Burndown Studio</h1>
        <p class="screen-subtitle">Track your team's sprint progress in real time.</p>
        <div class="login-actions">
          <button class="login-google-btn" id="loginGoogleBtn">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.658 14.234 17.64 11.926 17.64 9.2z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
          ${isLocal ? `
          <div class="login-divider"><span>or (dev only)</span></div>
          <div class="login-fake-row">
            <input type="email" id="fakeEmailInput" class="login-email-input" placeholder="dev@example.com" autocomplete="off" />
            <button class="btn ghost" id="loginFakeBtn">Continue</button>
          </div>
          ` : ""}
        </div>
        <div class="screen-error" id="loginError" hidden></div>
      </div>
    </div>
  `;

  document.getElementById("loginGoogleBtn")!.addEventListener("click", async () => {
    const errEl = document.getElementById("loginError")!;
    errEl.hidden = true;
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      errEl.textContent = e instanceof Error ? e.message : "Sign-in failed.";
      errEl.hidden = false;
    }
  });

  if (isLocal) {
    const fakeInput = document.getElementById("fakeEmailInput") as HTMLInputElement;
    const doFakeLogin = async () => {
      const email = fakeInput.value.trim();
      if (!email) return;
      const errEl = document.getElementById("loginError")!;
      errEl.hidden = true;
      try {
        await signInWithFakeEmail(email);
      } catch (e: unknown) {
        errEl.textContent = e instanceof Error ? e.message : "Sign-in failed.";
        errEl.hidden = false;
      }
    };
    document.getElementById("loginFakeBtn")!.addEventListener("click", doFakeLogin);
    fakeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doFakeLogin(); });
  }
};

// ---------------------------------------------------------------------------
// Register Prompt
// ---------------------------------------------------------------------------

export const showRegisterPrompt = (
  email: string,
  onConfirm: () => void,
  onCancel: () => void,
): void => {
  document.getElementById("registerPromptModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "registerPromptModal";
  modal.className = "team-modal-overlay";
  modal.innerHTML = `
    <div class="team-modal">
      <h3>Account Not Found</h3>
      <p class="pref-hint">No account exists for <strong>${escapeHtml(email)}</strong>.</p>
      <p class="pref-hint">Would you like to register as a new user?</p>
      <div class="team-modal-footer">
        <button class="btn ghost" id="registerPromptCancel">Cancel</button>
        <button class="btn" id="registerPromptConfirm">Register</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("registerPromptCancel")!.addEventListener("click", () => {
    modal.remove();
    onCancel();
  });
  document.getElementById("registerPromptConfirm")!.addEventListener("click", () => {
    modal.remove();
    onConfirm();
  });
};

// ---------------------------------------------------------------------------
// Team Selection Screen
// ---------------------------------------------------------------------------

export const showTeamScreen = (
  user: User,
  profile: UserProfile,
  onTeamSelected: (teamId: string, teamName: string) => void,
): void => {
  _currentUser = user;
  _currentProfile = profile;
  _onTeamSelected = onTeamSelected;
  clearContainer();

  getContainer().innerHTML = `
    <div class="screen-overlay" id="teamScreen">
      <div class="screen-card team-screen-card">
        <div class="team-screen-header">
          <div>
            <p class="eyebrow">Sprint Burndown</p>
            <h2 class="screen-title">Select a Team</h2>
          </div>
          <div class="team-screen-user">
            <span class="team-user-name">${escapeHtml(profile.displayName)}</span>
            ${profile.role === "super_manager" ? '<button class="btn ghost small" id="adminBtn">Admin</button>' : ""}
            <button class="btn ghost small" id="teamSignOutBtn">Sign Out</button>
          </div>
        </div>
        <div class="screen-error" id="teamError" hidden></div>
        <div class="team-grid" id="teamGrid">
          <div class="team-card-loading">Loading teams…</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("teamSignOutBtn")!.addEventListener("click", () => signOut());

  if (profile.role === "super_manager") {
    document.getElementById("adminBtn")?.addEventListener("click", () =>
      showAdminScreen(profile, () => showTeamScreen(user, profile, onTeamSelected))
    );
  }

  loadAndRenderTeams(user, profile);
};

const loadAndRenderTeams = async (user: User, profile: UserProfile): Promise<void> => {
  const grid = document.getElementById("teamGrid");
  if (!grid) return;
  try {
    const teams = await getTeamsForUser(user.uid, profile.role);
    renderTeamGrid(grid, teams, profile);
  } catch (e: unknown) {
    const err = document.getElementById("teamError");
    if (err) {
      err.textContent = e instanceof Error ? e.message : "Failed to load teams.";
      err.hidden = false;
    }
    grid.innerHTML = "";
  }
};

const renderTeamGrid = (grid: HTMLElement, teams: Team[], profile: UserProfile): void => {
  grid.innerHTML = "";

  for (const team of teams) {
    const card = document.createElement("button");
    card.className = "team-card";
    card.innerHTML = `
      <div class="team-card-name">${escapeHtml(team.name)}</div>
      <div class="team-card-meta">${team.memberIds.length} member${team.memberIds.length !== 1 ? "s" : ""}</div>
    `;
    card.addEventListener("click", () => _onTeamSelected?.(team.id, team.name));
    grid.appendChild(card);

    const canManage = profile.role === "product_manager" || profile.role === "super_manager";
    const canDelete = profile.role === "super_manager" || team.ownerId === profile.uid;

    if (canManage) {
      const manageBtn = document.createElement("button");
      manageBtn.className = "btn ghost small team-manage-btn";
      manageBtn.textContent = "Manage";
      manageBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showManageMembers(team, profile, () => {
          if (_currentUser && _currentProfile) loadAndRenderTeams(_currentUser, _currentProfile);
        });
      });
      card.appendChild(manageBtn);
    }

    if (canDelete) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn ghost small danger team-delete-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete team "${team.name}"?\n\nAll shared sprint data for this team will be permanently removed.`)) return;
        const errEl = document.getElementById("teamError");
        if (errEl) errEl.hidden = true;
        try {
          await deleteTeam(team.id);
          card.remove();
        } catch (err: unknown) {
          if (errEl) {
            errEl.textContent = err instanceof Error ? err.message : "Failed to delete team.";
            errEl.hidden = false;
          }
        }
      });
      card.appendChild(deleteBtn);
    }
  }

  if (profile.role === "product_manager" || profile.role === "super_manager") {
    const newCard = document.createElement("button");
    newCard.className = "team-card team-card-new";
    newCard.innerHTML = `<span class="team-card-new-icon">+</span><span class="team-card-name">New Team</span>`;
    newCard.addEventListener("click", () => showCreateTeam(profile));
    grid.appendChild(newCard);
  }

  if (teams.length === 0 && profile.role === "member") {
    const empty = document.createElement("div");
    empty.className = "team-card-loading";
    empty.textContent = "You haven't been added to any team yet. Ask a Product Manager to add you.";
    grid.appendChild(empty);
  }
};

// ---------------------------------------------------------------------------
// Create Team inline modal
// ---------------------------------------------------------------------------

const showCreateTeam = (profile: UserProfile): void => {
  document.getElementById("createTeamModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "createTeamModal";
  modal.className = "team-modal-overlay";
  modal.innerHTML = `
    <div class="team-modal">
      <h3>Create Team</h3>
      <input type="text" id="newTeamName" class="screen-input" placeholder="Team name" />
      <div class="screen-error" id="createTeamError" hidden></div>
      <div class="team-modal-footer">
        <button class="btn ghost" id="createTeamCancel">Cancel</button>
        <button class="btn" id="createTeamConfirm">Create</button>
      </div>
    </div>
  `;
  getContainer().appendChild(modal);

  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
  document.getElementById("createTeamCancel")!.addEventListener("click", () => modal.remove());

  const doCreate = async () => {
    const name = (document.getElementById("newTeamName") as HTMLInputElement).value.trim();
    if (!name) return;
    const errEl = document.getElementById("createTeamError")!;
    errEl.hidden = true;
    try {
      await createTeam(name, profile.uid);
      modal.remove();
      const grid = document.getElementById("teamGrid");
      if (grid && _currentUser) {
        const teams = await getTeamsForUser(_currentUser.uid, profile.role);
        renderTeamGrid(grid, teams, profile);
      }
    } catch (e: unknown) {
      errEl.textContent = e instanceof Error ? e.message : "Failed to create team.";
      errEl.hidden = false;
    }
  };

  document.getElementById("createTeamConfirm")!.addEventListener("click", doCreate);
  (document.getElementById("newTeamName") as HTMLInputElement).addEventListener("keydown", (e) => {
    if (e.key === "Enter") doCreate();
  });
  setTimeout(() => (document.getElementById("newTeamName") as HTMLInputElement).focus(), 50);
};

// ---------------------------------------------------------------------------
// Manage Members inline modal
// ---------------------------------------------------------------------------

const findAssignedTasksInState = (displayName: string, email: string, appState: { sprints: { tasks: { assignedTo?: string; name?: string; taskId?: string }[] }[]; backlog?: { stories: { storyId: string; tasks: { assignedTo?: string[]; description?: string; taskId?: string }[] }[] } }, label: string): string[] => {
  const found: string[] = [];
  appState.sprints.forEach((sprint, i) => {
    for (const task of sprint.tasks) {
      const names = (task.assignedTo ?? "").split(",").map(s => s.trim()).filter(Boolean);
      if (names.includes(displayName)) {
        found.push(`${label} › Sprint ${i + 1}: ${task.name || task.taskId || "(unnamed)"}`);
      }
    }
  });
  for (const story of (appState.backlog?.stories ?? [])) {
    for (const task of story.tasks) {
      // assignedTo stores emails; fall back to matching displayName for legacy data
      const arr = task.assignedTo ?? [];
      if (arr.includes(email) || arr.includes(displayName)) {
        found.push(`${label} › Backlog [${story.storyId}]: ${task.description || task.taskId || "(unnamed)"}`);
      }
    }
  }
  return found;
};

// PM: checks only the current team being managed
const findAssignedTasksInTeam = async (displayName: string, email: string, teamId: string, teamName: string): Promise<string[]> => {
  const appState = await loadTeamState(teamId);
  if (!appState) return [];
  return findAssignedTasksInState(displayName, email, appState, teamName);
};

// SM: checks across ALL teams the member belongs to
const findAssignedTasksAcrossTeams = async (displayName: string, email: string, userUid: string): Promise<string[]> => {
  const found: string[] = [];
  let teams: Team[] = [];
  try {
    teams = await getTeamsForUser(userUid, "member");
  } catch {
    return found;
  }
  await Promise.all(teams.map(async (t) => {
    const appState = await loadTeamState(t.id);
    if (!appState) return;
    found.push(...findAssignedTasksInState(displayName, email, appState, t.name || t.id));
  }));
  return found;
};

const showSmRemoveBlockedDialog = (displayName: string, assignedTasks: string[]): void => {
  document.getElementById("smRemoveBlockedDialog")?.remove();
  const modal = document.createElement("div");
  modal.id = "smRemoveBlockedDialog";
  modal.className = "team-modal-overlay";
  const listItems = assignedTasks.slice(0, 5).map(t => `<li>${escapeHtml(t)}</li>`).join("");
  const more = assignedTasks.length > 5 ? `<li style="color:var(--text-muted,#888)">… and ${assignedTasks.length - 5} more</li>` : "";
  modal.innerHTML = `
    <div class="team-modal">
      <h3 style="color:#ef4444">&#9888; Cannot Remove Member</h3>
      <p><strong>${escapeHtml(displayName)}</strong> is still assigned to the following tasks:</p>
      <ul style="margin:10px 0;padding-left:20px;font-size:0.88em;line-height:1.6">${listItems}${more}</ul>
      <p class="pref-hint">All task assignments must be cleared before this member can be removed from any team.</p>
      <div class="team-modal-footer">
        <button class="btn" id="smRemoveBlockedOk">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("smRemoveBlockedOk")!.addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
};

const showPmManagesTeamsBlockedDialog = (displayName: string, teamNames: string[]): void => {
  document.getElementById("smRemoveBlockedDialog")?.remove();
  const modal = document.createElement("div");
  modal.id = "smRemoveBlockedDialog";
  modal.className = "team-modal-overlay";
  const listItems = teamNames.map(n => `<li>${escapeHtml(n)}</li>`).join("");
  modal.innerHTML = `
    <div class="team-modal">
      <h3 style="color:#ef4444">&#9888; Cannot Remove Member</h3>
      <p><strong>${escapeHtml(displayName)}</strong> is the owner of the following team(s):</p>
      <ul style="margin:10px 0;padding-left:20px;font-size:0.88em;line-height:1.6">${listItems}</ul>
      <p class="pref-hint">Transfer or delete all managed teams before removing this member.</p>
      <div class="team-modal-footer">
        <button class="btn" id="smRemoveBlockedOk">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("smRemoveBlockedOk")!.addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
};

const showSmRemoveConfirmDialog = (
  displayName: string,
  message: string,
  onConfirm: () => void,
  onCancel: () => void,
): void => {
  document.getElementById("smRemoveConfirmDialog")?.remove();
  const modal = document.createElement("div");
  modal.id = "smRemoveConfirmDialog";
  modal.className = "team-modal-overlay";
  modal.innerHTML = `
    <div class="team-modal">
      <h3>Remove Team Member</h3>
      <p class="confirm-dialog-warning">${message}</p>
      <div class="team-modal-footer">
        <button class="btn ghost" id="smRemoveConfirmCancel">Cancel</button>
        <button class="btn danger-solid" id="smRemoveConfirmOk">Remove</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const cleanup = () => modal.remove();
  document.getElementById("smRemoveConfirmCancel")!.addEventListener("click", () => { cleanup(); onCancel(); });
  document.getElementById("smRemoveConfirmOk")!.addEventListener("click", () => { cleanup(); onConfirm(); });
  modal.addEventListener("click", (e) => { if (e.target === modal) { cleanup(); onCancel(); } });
};

const showManageMembers = (team: Team, profile: UserProfile, onDone?: () => void): void => {
  document.getElementById("manageMembersModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "manageMembersModal";
  modal.className = "team-modal-overlay";
  modal.innerHTML = `
    <div class="team-modal team-modal-wide">
      <h3>Manage Members — ${escapeHtml(team.name)}</h3>
      <div class="screen-error" id="manageMemberError" hidden></div>
      <div class="manage-members-body">
        <div class="manage-members-col">
          <div class="manage-members-col-title">Current Members</div>
          <div id="currentMemberList" class="manage-member-list">Loading…</div>
        </div>
        <div class="manage-members-col">
          <div class="manage-members-col-title">All Users (click to add)</div>
          <div id="availableUserList" class="manage-member-list">Loading…</div>
        </div>
      </div>
      <div class="team-modal-footer">
        <button class="btn" id="manageMembersDone">Done</button>
      </div>
    </div>
  `;
  getContainer().appendChild(modal);

  modal.addEventListener("click", (e) => { if (e.target === modal) { modal.remove(); onDone?.(); } });
  document.getElementById("manageMembersDone")!.addEventListener("click", () => { modal.remove(); onDone?.(); });

  const refresh = async () => {
    const errEl = document.getElementById("manageMemberError")!;
    errEl.hidden = true;
    const currentEl = document.getElementById("currentMemberList")!;
    const availableEl = document.getElementById("availableUserList")!;
    currentEl.innerHTML = availableEl.innerHTML = "Loading…";

    let allUsers;
    try {
      allUsers = await getAllUsers();
    } catch {
      currentEl.innerHTML = availableEl.innerHTML = "<em>Failed to load users.</em>";
      return;
    }

    const members = allUsers.filter((u) => team.memberIds.includes(u.uid));
    const available = allUsers.filter((u) => !team.memberIds.includes(u.uid));

    const memberRow = (u: typeof allUsers[0], isRemovable: boolean) => {
      const phone = u.phoneNumber ? `<span class="member-phone">${escapeHtml(u.phoneNumber)}</span>` : "";
      return `
        <div class="manage-member-row" data-uid="${u.uid}" data-name="${escapeHtml(u.displayName)}">
          <div class="manage-member-info">
            <span class="member-name">${escapeHtml(u.displayName)}</span>
            <span class="member-email">${escapeHtml(u.email)}</span>
            ${phone}
          </div>
          ${isRemovable ? `<button class="btn ghost small danger member-remove-btn"
            data-uid="${u.uid}" data-name="${escapeHtml(u.displayName)}"
            ${u.uid === profile.uid ? "disabled title='Cannot remove yourself'" : ""}>Remove</button>` : ""}
        </div>
      `;
    };

    // Current members
    if (members.length === 0) {
      currentEl.innerHTML = "<em>No members yet.</em>";
    } else {
      currentEl.innerHTML = members.map((u) => memberRow(u, true)).join("");
      currentEl.querySelectorAll<HTMLButtonElement>(".member-remove-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const uid = btn.dataset.uid!;
          const displayName = btn.dataset.name!;
          errEl.hidden = true;

          btn.disabled = true;
          const prevText = btn.textContent;
          btn.textContent = "Checking…";
          let assigned: string[] = [];
          let managedTeams: import("./types.ts").Team[] = [];
          try {
            [assigned, managedTeams] = await Promise.all([
              findAssignedTasksInTeam(displayName, team.id, team.name),
              getTeamsManagedBy(uid),
            ]);
          } finally {
            btn.disabled = false;
            btn.textContent = prevText;
          }

          if (managedTeams.length > 0) {
            errEl.textContent = `Cannot remove ${displayName}: they manage ${managedTeams.length} team(s) — ${managedTeams.map(t => t.name).join(", ")}. Transfer or delete those teams first.`;
            errEl.hidden = false;
            return;
          }

          if (assigned.length > 0) {
            const preview = assigned.slice(0, 3).join(", ");
            const more = assigned.length > 3 ? ` … and ${assigned.length - 3} more` : "";
            errEl.textContent = `Cannot remove ${displayName}: assigned to ${assigned.length} task(s) — ${preview}${more}. Unassign first.`;
            errEl.hidden = false;
            return;
          }

          try {
            await removeMemberFromTeamWithPrefs(team.id, uid, displayName);
            team.memberIds = team.memberIds.filter((id) => id !== uid);
            refresh();
          } catch (e: unknown) {
            errEl.textContent = e instanceof Error ? e.message : "Error removing member.";
            errEl.hidden = false;
          }
        });
      });
    }

    // Available users
    if (available.length === 0) {
      availableEl.innerHTML = "<em>All registered users are already members.</em>";
    } else {
      availableEl.innerHTML = available.map((u) => `
        <div class="manage-member-row available" data-uid="${u.uid}" data-name="${escapeHtml(u.displayName)}">
          <div class="manage-member-info">
            <span class="member-name">${escapeHtml(u.displayName)}</span>
            <span class="member-email">${escapeHtml(u.email)}</span>
            ${u.phoneNumber ? `<span class="member-phone">${escapeHtml(u.phoneNumber)}</span>` : ""}
          </div>
          <button class="btn small member-add-btn" data-uid="${u.uid}" data-name="${escapeHtml(u.displayName)}">Add</button>
        </div>
      `).join("");
      availableEl.querySelectorAll<HTMLButtonElement>(".member-add-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const uid = btn.dataset.uid!;
          const displayName = btn.dataset.name!;
          errEl.hidden = true;
          try {
            await addMemberToTeamWithPrefs(team.id, uid, displayName);
            team.memberIds.push(uid);
            refresh();
          } catch (e: unknown) {
            errEl.textContent = e instanceof Error ? e.message : "Failed to add member.";
            errEl.hidden = false;
          }
        });
      });
    }
  };

  refresh();
};

// ---------------------------------------------------------------------------
// Admin Screen
// ---------------------------------------------------------------------------

export const showAdminScreen = (profile: UserProfile, onBack: () => void): void => {
  clearContainer();

  getContainer().innerHTML = `
    <div class="screen-overlay" id="adminScreen">
      <div class="screen-card admin-card">
        <div class="admin-header">
          <button class="btn ghost small" id="adminBackBtn">← Back to Teams</button>
          <h2 class="screen-title">User Administration</h2>
        </div>
        <div class="screen-error" id="adminError" hidden></div>
        <div id="adminUserTable" class="admin-table-wrap">
          <em>Loading users…</em>
        </div>
      </div>
    </div>
  `;

  document.getElementById("adminBackBtn")!.addEventListener("click", onBack);
  loadAdminUsers();
};

let _adminUsers: UserProfile[] = [];
let _adminSort: { key: "email" | "name"; asc: boolean } = { key: "email", asc: true };

const renderAdminTable = (): void => {
  const tableEl = document.getElementById("adminUserTable");
  if (!tableEl) return;

  const sorted = [..._adminUsers].sort((a, b) => {
    const av = _adminSort.key === "email" ? a.email : a.displayName;
    const bv = _adminSort.key === "email" ? b.email : b.displayName;
    return _adminSort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const arrow = (key: "email" | "name") =>
    _adminSort.key === key ? (_adminSort.asc ? " ▲" : " ▼") : "";

  tableEl.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th class="sortable-header" data-sort="email" style="cursor:pointer">Email${arrow("email")}</th>
          <th class="sortable-header" data-sort="name" style="cursor:pointer">Name${arrow("name")}</th>
          <th>Role</th><th></th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map((u) => `
          <tr data-uid="${u.uid}">
            <td>${escapeHtml(u.email)}</td>
            <td>${escapeHtml(u.displayName)}</td>
            <td>
              <select class="role-select" data-uid="${u.uid}">
                <option value="member" ${u.role === "member" ? "selected" : ""}>Member</option>
                <option value="product_manager" ${u.role === "product_manager" ? "selected" : ""}>Product Manager</option>
                <option value="super_manager" ${u.role === "super_manager" ? "selected" : ""}>Super Manager</option>
              </select>
            </td>
            <td>
              <button class="btn ghost small danger delete-user-btn"
                data-uid="${u.uid}" data-email="${escapeHtml(u.email)}"
                ${u.role === "super_manager" ? "disabled title='Cannot delete Super Manager'" : ""}>
                Delete
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  tableEl.querySelectorAll<HTMLElement>(".sortable-header").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort as "email" | "name";
      if (_adminSort.key === key) _adminSort.asc = !_adminSort.asc;
      else _adminSort = { key, asc: true };
      renderAdminTable();
    });
  });

  tableEl.querySelectorAll<HTMLSelectElement>(".role-select").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const uid = sel.dataset.uid!;
      const role = sel.value as UserRole;
      const errEl = document.getElementById("adminError")!;
      errEl.hidden = true;
      try {
        await setUserRole(uid, role);
        const u = _adminUsers.find(u => u.uid === uid);
        if (u) u.role = role;
      } catch (e: unknown) {
        errEl.textContent = e instanceof Error ? e.message : "Failed to update role.";
        errEl.hidden = false;
        renderAdminTable();
      }
    });
  });

  tableEl.querySelectorAll<HTMLButtonElement>(".delete-user-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.uid!;
      const email = btn.dataset.email!;
      const displayName = _adminUsers.find(u => u.uid === uid)?.displayName ?? email;
      const errEl = document.getElementById("adminError")!;
      errEl.hidden = true;

      btn.disabled = true;
      const prevText = btn.textContent;
      btn.textContent = "Checking…";
      let assigned: string[] = [];
      let managedTeams: import("./types.ts").Team[] = [];
      try {
        [assigned, managedTeams] = await Promise.all([
          findAssignedTasksAcrossTeams(displayName, uid),
          getTeamsManagedBy(uid),
        ]);
      } finally {
        btn.disabled = false;
        btn.textContent = prevText;
      }

      if (managedTeams.length > 0) {
        showPmManagesTeamsBlockedDialog(displayName, managedTeams.map(t => t.name));
        return;
      }

      if (assigned.length > 0) {
        showSmRemoveBlockedDialog(displayName, assigned);
        return;
      }

      showSmRemoveConfirmDialog(
        displayName,
        `Deleting <strong>${escapeHtml(displayName)}</strong> (${escapeHtml(email)}) will remove them from all teams and revoke their access. Their Auth account remains — if they sign in again they will be re-created as a plain Member.`,
        async () => {
          try {
            await deleteUserProfile(uid);
            _adminUsers = _adminUsers.filter(u => u.uid !== uid);
            renderAdminTable();
          } catch (e: unknown) {
            errEl.textContent = e instanceof Error ? e.message : "Failed to delete user.";
            errEl.hidden = false;
          }
        },
        () => {},
      );
    });
  });
};

const loadAdminUsers = async (): Promise<void> => {
  const tableEl = document.getElementById("adminUserTable");
  if (!tableEl) return;
  try {
    _adminUsers = await getAllUsers();
    if (_adminUsers.length === 0) {
      tableEl.innerHTML = "<em>No users found.</em>";
      return;
    }
    renderAdminTable();
  } catch (e: unknown) {
    tableEl.innerHTML = `<em>Failed to load users: ${e instanceof Error ? escapeHtml(e.message) : "Unknown error"}</em>`;
  }
};

// ---------------------------------------------------------------------------
// Profile Edit Modal (accessible by clicking user name in header)
// ---------------------------------------------------------------------------

export const showProfileEditModal = (
  profile: UserProfile,
  isNew: boolean,
  onSaved: (updatedProfile: UserProfile) => void,
): void => {
  document.getElementById("profileEditModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "profileEditModal";
  modal.className = "team-modal-overlay";
  modal.innerHTML = `
    <div class="team-modal">
      <h3>${isNew ? "Complete Your Profile" : "Edit Profile"}</h3>
      ${isNew ? '<p class="pref-hint">Welcome! Please confirm your name and optionally add your phone number.</p>' : ""}
      <div class="profile-email-row">${escapeHtml(profile.email)}</div>
      <label class="screen-label">
        Name
        <input type="text" id="profileNameInput" class="screen-input" value="${isNew ? "" : escapeHtml(profile.displayName)}" placeholder="Your name" />
      </label>
      <label class="screen-label">
        Phone Number <span class="label-optional">(optional)</span>
        <input type="tel" id="profilePhoneInput" class="screen-input" value="${escapeHtml(profile.phoneNumber ?? "")}" placeholder="e.g. 010-1234-5678" />
      </label>
      <div class="screen-error" id="profileEditError" hidden></div>
      <div class="team-modal-footer">
        ${isNew ? "" : '<button class="btn ghost" id="profileEditCancel">Cancel</button>'}
        <button class="btn" id="profileEditSave">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  if (!isNew) {
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    document.getElementById("profileEditCancel")!.addEventListener("click", () => modal.remove());
  }

  const doSave = async () => {
    const name = (document.getElementById("profileNameInput") as HTMLInputElement).value.trim();
    const phone = (document.getElementById("profilePhoneInput") as HTMLInputElement).value.trim();
    const errEl = document.getElementById("profileEditError")!;
    errEl.hidden = true;
    if (!name) {
      errEl.textContent = "Name cannot be empty.";
      errEl.hidden = false;
      return;
    }
    try {
      await updateUserProfile(profile.uid, { displayName: name, phoneNumber: phone || null } as Parameters<typeof updateUserProfile>[1]);
      const updated: UserProfile = { ...profile, displayName: name };
      if (phone) updated.phoneNumber = phone; else delete updated.phoneNumber;
      modal.remove();
      onSaved(updated);
    } catch (e: unknown) {
      errEl.textContent = e instanceof Error ? e.message : "Failed to save profile.";
      errEl.hidden = false;
    }
  };

  document.getElementById("profileEditSave")!.addEventListener("click", doSave);
  (document.getElementById("profileNameInput") as HTMLInputElement).addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSave();
  });
  setTimeout(() => (document.getElementById("profileNameInput") as HTMLInputElement).focus(), 50);
};
