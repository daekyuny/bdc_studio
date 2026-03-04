import { signInWithGoogle, signInWithFakeEmail, signOut } from "./auth.ts";
import {
  getTeamsForUser,
  createTeam,
  addMemberToTeamById,
  removeMemberFromTeam,
  getAllUsers,
  setUserRole,
  deleteUserProfile,
  deleteTeam,
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
          <button class="btn login-google-btn" id="loginGoogleBtn">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
        showManageMembers(team, profile);
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

const showManageMembers = (team: Team, profile: UserProfile): void => {
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

  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
  document.getElementById("manageMembersDone")!.addEventListener("click", () => modal.remove());

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

    // Current members
    if (members.length === 0) {
      currentEl.innerHTML = "<em>No members yet.</em>";
    } else {
      currentEl.innerHTML = members.map((u) => `
        <div class="manage-member-row" data-uid="${u.uid}">
          <div class="manage-member-info">
            <span class="member-email">${escapeHtml(u.email)}</span>
            <span class="member-name">${escapeHtml(u.displayName)}</span>
          </div>
          <button class="btn ghost small danger member-remove-btn"
            data-uid="${u.uid}" ${u.uid === profile.uid ? "disabled title='Cannot remove yourself'" : ""}>Remove</button>
        </div>
      `).join("");
      currentEl.querySelectorAll<HTMLButtonElement>(".member-remove-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const uid = btn.dataset.uid!;
          errEl.hidden = true;
          try {
            await removeMemberFromTeam(team.id, uid);
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
        <div class="manage-member-row available" data-uid="${u.uid}">
          <div class="manage-member-info">
            <span class="member-email">${escapeHtml(u.email)}</span>
            <span class="member-name">${escapeHtml(u.displayName)}</span>
          </div>
          <button class="btn small member-add-btn" data-uid="${u.uid}">Add</button>
        </div>
      `).join("");
      availableEl.querySelectorAll<HTMLButtonElement>(".member-add-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const uid = btn.dataset.uid!;
          errEl.hidden = true;
          try {
            await addMemberToTeamById(team.id, uid);
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

const loadAdminUsers = async (): Promise<void> => {
  const tableEl = document.getElementById("adminUserTable");
  if (!tableEl) return;
  try {
    const users = await getAllUsers();
    if (users.length === 0) {
      tableEl.innerHTML = "<em>No users found.</em>";
      return;
    }
    tableEl.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr><th>Email</th><th>Name</th><th>Role</th><th></th></tr>
        </thead>
        <tbody>
          ${users.map((u) => `
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
    tableEl.querySelectorAll<HTMLSelectElement>(".role-select").forEach((sel) => {
      sel.addEventListener("change", async () => {
        const uid = sel.dataset.uid!;
        const role = sel.value as UserRole;
        const errEl = document.getElementById("adminError")!;
        errEl.hidden = true;
        try {
          await setUserRole(uid, role);
        } catch (e: unknown) {
          errEl.textContent = e instanceof Error ? e.message : "Failed to update role.";
          errEl.hidden = false;
          loadAdminUsers();
        }
      });
    });

    tableEl.querySelectorAll<HTMLButtonElement>(".delete-user-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const uid = btn.dataset.uid!;
        const email = btn.dataset.email!;
        if (!confirm(`Delete user "${email}"?\n\nThey will be removed from all teams and lose access. Their Auth account remains — if they log in again, they will be re-created as a plain Member.`)) return;
        const errEl = document.getElementById("adminError")!;
        errEl.hidden = true;
        try {
          await deleteUserProfile(uid);
          // Remove the row from the table immediately
          tableEl.querySelector(`tr[data-uid="${uid}"]`)?.remove();
        } catch (e: unknown) {
          errEl.textContent = e instanceof Error ? e.message : "Failed to delete user.";
          errEl.hidden = false;
        }
      });
    });
  } catch (e: unknown) {
    tableEl.innerHTML = `<em>Failed to load users: ${e instanceof Error ? escapeHtml(e.message) : "Unknown error"}</em>`;
  }
};
