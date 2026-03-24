import { signInWithGoogle, signInWithEmail, createAccountWithEmail, signOut, changePassword } from "./auth.ts";
import {
  getTeamsForUser,
  getTeamsManagedBy,
  loadTeamState,
  createTeam,
  addMemberToTeamWithPrefs,
  removeMemberFromTeamWithPrefs,
  getAllUsers,
  getAllTeams,
  setUserRole,
  deleteUserProfile,
  deleteTeam,
  updateUserProfile,
  createGroup,
  updateGroupName,
  getAllGroups,
  getGroupById,
  getTeamsByGroup,
  getGroupMemberProfiles,
  removeGroupMember,
  linkExistingTeamsToGroup,
  createInvitation,
  getInvitation,
  updateInvitation,
  getInvitationsByGroup,
  createPreregistrations,
  getPreregistrationsByGroup,
  updatePreregistration,
  createPmRequest,
  getPmRequest,
  getAllPmRequests,
  updatePmRequest,
  deletePmRequest,
  getUserProfileByEmail,
  getAppSettings,
  setAppSetting,
  getUsersByIds,
  updateTeamOrder,
  updateTeamName,
} from "./db.ts";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase.ts";
import type { User } from "firebase/auth";
import type { UserProfile, Team, UserRole, Group, Invitation, PmRequest } from "./types.ts";

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
// Avatar helpers
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  "#6c7ee1","#e06c75","#56b6c2","#e5c07b","#98c379",
  "#d19a66","#c678dd","#61afef","#888faa","#f08d49",
];

const _avatarCache = new Map<string, string>();

const makeInitialAvatar = (name: string, size: number): string => {
  const key = `${name}:${size}`;
  const cached = _avatarCache.get(key);
  if (cached) return cached;
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  const colorIdx = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = AVATAR_COLORS[colorIdx];
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.round(size * 0.42)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initial, size / 2, size / 2);
  const result = canvas.toDataURL("image/png");
  _avatarCache.set(key, result);
  return result;
};

export const avatarSrc = (profile: UserProfile, size: number): string => {
  if (size >= 80 && profile.photoFull) return profile.photoFull;
  if (profile.photoThumb) return profile.photoThumb;
  return makeInitialAvatar(profile.displayName, size);
};

const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const resizeImage = (file: File, maxDim: number): Promise<string> =>
  new Promise((resolve, reject) => {
    if (file.size > MAX_AVATAR_FILE_SIZE) {
      reject(new Error("Image file too large (max 5 MB)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const resizeDataUrl = (dataUrl: string, maxDim: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });

const showCropModal = (file: File, onCropped: (dataUrl: string) => void): void => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX_DISPLAY = 480;
      const scale = Math.min(1, MAX_DISPLAY / Math.max(img.width, img.height));
      const dispW = Math.round(img.width * scale);
      const dispH = Math.round(img.height * scale);

      // Initial selection: centered square
      const initSize = Math.round(Math.min(dispW, dispH) * 0.85);
      let selX = Math.round((dispW - initSize) / 2);
      let selY = Math.round((dispH - initSize) / 2);
      let selW = initSize;
      let selH = initSize;

      const overlay = document.createElement("div");
      overlay.className = "crop-overlay";
      overlay.innerHTML = `
        <div class="crop-dialog">
          <div class="crop-title">Drag to select crop area</div>
          <div class="crop-workspace" id="cropWorkspace" style="width:${dispW}px;height:${dispH}px">
            <img src="${img.src}" style="width:${dispW}px;height:${dispH}px;display:block" draggable="false" />
            <div class="crop-selection" id="cropSelection">
              <div class="crop-handle crop-handle-nw" data-handle="nw"></div>
              <div class="crop-handle crop-handle-ne" data-handle="ne"></div>
              <div class="crop-handle crop-handle-sw" data-handle="sw"></div>
              <div class="crop-handle crop-handle-se" data-handle="se"></div>
            </div>
          </div>
          <div class="crop-actions">
            <button class="btn ghost" id="cropCancel">Cancel</button>
            <button class="btn" id="cropConfirm">Crop &amp; Use</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const sel = document.getElementById("cropSelection")!;

      const updateSel = () => {
        sel.style.left = selX + "px";
        sel.style.top = selY + "px";
        sel.style.width = selW + "px";
        sel.style.height = selH + "px";
      };
      updateSel();

      type DragType = "move" | "nw" | "ne" | "sw" | "se";
      let drag: { type: DragType; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null = null;
      const MIN = 20;
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

      sel.addEventListener("mousedown", (e) => {
        if ((e.target as HTMLElement).dataset.handle) return;
        e.preventDefault();
        drag = { type: "move", sx: e.clientX, sy: e.clientY, ox: selX, oy: selY, ow: selW, oh: selH };
      });
      sel.querySelectorAll<HTMLElement>(".crop-handle").forEach((h) => {
        h.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          drag = { type: h.dataset.handle as DragType, sx: e.clientX, sy: e.clientY, ox: selX, oy: selY, ow: selW, oh: selH };
        });
      });

      const onMove = (e: MouseEvent) => {
        if (!drag) return;
        const dx = e.clientX - drag.sx;
        const dy = e.clientY - drag.sy;
        if (drag.type === "move") {
          selX = clamp(drag.ox + dx, 0, dispW - selW);
          selY = clamp(drag.oy + dy, 0, dispH - selH);
        } else {
          let x1 = drag.ox, y1 = drag.oy, x2 = drag.ox + drag.ow, y2 = drag.oy + drag.oh;
          if (drag.type === "nw") { x1 = clamp(x1 + dx, 0, x2 - MIN); y1 = clamp(y1 + dy, 0, y2 - MIN); }
          if (drag.type === "ne") { x2 = clamp(x2 + dx, x1 + MIN, dispW); y1 = clamp(y1 + dy, 0, y2 - MIN); }
          if (drag.type === "sw") { x1 = clamp(x1 + dx, 0, x2 - MIN); y2 = clamp(y2 + dy, y1 + MIN, dispH); }
          if (drag.type === "se") { x2 = clamp(x2 + dx, x1 + MIN, dispW); y2 = clamp(y2 + dy, y1 + MIN, dispH); }
          selX = x1; selY = y1; selW = x2 - x1; selH = y2 - y1;
        }
        updateSel();
      };
      const onUp = () => { drag = null; };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);

      const cleanup = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        overlay.remove();
      };

      document.getElementById("cropCancel")!.addEventListener("click", cleanup);
      document.getElementById("cropConfirm")!.addEventListener("click", () => {
        const origX = Math.round(selX / scale);
        const origY = Math.round(selY / scale);
        const origW = Math.round(selW / scale);
        const origH = Math.round(selH / scale);
        const canvas = document.createElement("canvas");
        canvas.width = origW;
        canvas.height = origH;
        canvas.getContext("2d")!.drawImage(img, origX, origY, origW, origH, 0, 0, origW, origH);
        onCropped(canvas.toDataURL("image/jpeg", 0.95));
        cleanup();
      });
    };
    img.src = e.target!.result as string;
  };
  reader.readAsDataURL(file);
};

export const showPhotoPopup = (src: string): void => {
  document.getElementById("photoPopupOverlay")?.remove();
  const popup = document.createElement("div");
  popup.id = "photoPopupOverlay";
  popup.className = "team-modal-overlay";
  popup.style.cssText = "cursor:pointer";
  popup.innerHTML = `<img src="${escapeHtml(src)}" style="max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,0.4)" />`;
  document.body.appendChild(popup);
  const close = () => popup.remove();
  popup.addEventListener("click", close);
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);
};

const showChangePasswordModal = (user: User): void => {
  document.getElementById("changePasswordModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "changePasswordModal";
  modal.className = "team-modal-overlay";
  modal.innerHTML = `
    <div class="team-modal">
      <h3>Change Password</h3>
      <label class="screen-label">
        Current Password
        <input type="password" id="cpCurrent" class="screen-input" placeholder="Current password" autocomplete="current-password" />
      </label>
      <label class="screen-label">
        New Password
        <input type="password" id="cpNew" class="screen-input" placeholder="Min 6 characters" autocomplete="new-password" />
      </label>
      <label class="screen-label">
        Confirm New Password
        <input type="password" id="cpConfirm" class="screen-input" placeholder="Confirm new password" autocomplete="new-password" />
      </label>
      <div class="screen-error" id="cpError" hidden></div>
      <div class="screen-success" id="cpSuccess" hidden></div>
      <div class="team-modal-footer">
        <button class="btn ghost" id="cpCancel">Cancel</button>
        <button class="btn" id="cpSave">Change Password</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
  document.getElementById("cpCancel")!.addEventListener("click", () => modal.remove());

  const doChange = async () => {
    const current = (document.getElementById("cpCurrent") as HTMLInputElement).value;
    const newPw = (document.getElementById("cpNew") as HTMLInputElement).value;
    const confirm = (document.getElementById("cpConfirm") as HTMLInputElement).value;
    const errEl = document.getElementById("cpError")!;
    const successEl = document.getElementById("cpSuccess")!;
    errEl.hidden = true;
    successEl.hidden = true;
    if (!current) { errEl.textContent = "Current password is required."; errEl.hidden = false; return; }
    if (newPw.length < 6) { errEl.textContent = "New password must be at least 6 characters."; errEl.hidden = false; return; }
    if (newPw !== confirm) { errEl.textContent = "Passwords do not match."; errEl.hidden = false; return; }
    const btn = document.getElementById("cpSave") as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      await changePassword(user, current, newPw);
      successEl.textContent = "Password changed successfully!";
      successEl.hidden = false;
      setTimeout(() => modal.remove(), 1500);
    } catch (e: unknown) {
      errEl.textContent = e instanceof Error ? e.message : "Failed to change password.";
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = "Change Password";
    }
  };

  document.getElementById("cpSave")!.addEventListener("click", doChange);
  (document.getElementById("cpConfirm") as HTMLInputElement).addEventListener("keydown", (e) => {
    if (e.key === "Enter") void doChange();
  });
  setTimeout(() => (document.getElementById("cpCurrent") as HTMLInputElement).focus(), 50);
};

// ---------------------------------------------------------------------------
// Landing Page (replaces login screen)
// ---------------------------------------------------------------------------

const googleSvg = `
  <svg width="14" height="14" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.658 14.234 17.64 11.926 17.64 9.2z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>`;

export const showLandingPage = (): void => {
  clearContainer();

  const pendingPmApproved = sessionStorage.getItem("pendingPmApproved");
  const pendingInvite = sessionStorage.getItem("pendingInvite");

  // PM approval: show a dedicated registration page, not the general landing
  if (pendingPmApproved) {
    renderPmRegistrationPage(pendingPmApproved);
    return;
  }

  // Invitation accept: show a dedicated registration page
  if (pendingInvite) {
    renderInvitationRegistrationPage(pendingInvite);
    return;
  }

  const loginError = sessionStorage.getItem("loginError");
  if (loginError) sessionStorage.removeItem("loginError");

  const burndownLogoSvg = `
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="6" y1="38" x2="38" y2="38" stroke="#ddd" stroke-width="1.2"/>
      <line x1="6" y1="6" x2="6" y2="38" stroke="#ddd" stroke-width="1.2"/>
      <line x1="6" y1="8" x2="38" y2="36" stroke="#6c7ee1" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.7"/>
      <polyline points="6,8 13,13 19,18 25,16 31,26 38,30" stroke="#e06c75" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  getContainer().innerHTML = `
    <div class="screen-overlay" id="landingScreen">
      <div class="landing-layout">

        <div class="landing-brand">
          <div class="landing-logo">${burndownLogoSvg}</div>
          <div>
            <h1 class="landing-title">Burndown Studio</h1>
            <p class="landing-subtitle">Sprint burndown tracking for teams</p>
          </div>
        </div>

        <div class="landing-card">
          <p class="landing-card-label">Already a user?</p>
          <input type="email" id="landingEmail" class="screen-input" placeholder="Email" autocomplete="off" />
          <input type="password" id="landingPassword" class="screen-input" placeholder="Password" autocomplete="new-password" />
          <div class="landing-signin-row">
            <button class="btn" id="landingSignInBtn">Sign In</button>
          </div>
          <div class="login-divider"><span>or</span></div>
          <button class="login-google-btn" id="loginGoogleBtn">${googleSvg} Sign in with Google</button>
          <div class="screen-error" id="loginError"${loginError ? "" : " hidden"}>${loginError ? escapeHtml(loginError) : ""}</div>
        </div>

        <div class="landing-card landing-pm-card">
          <p class="landing-pm-title">Want to bring your team?</p>
          <p class="landing-pm-sub">Apply for a PM account to create your group and manage teams.</p>
          <button class="btn ghost" id="requestPmBtn">Request PM Account</button>
        </div>

      </div>
    </div>
  `;

  const errEl = () => document.getElementById("loginError")!;

  const doEmailSignIn = async () => {
    const email = (document.getElementById("landingEmail") as HTMLInputElement).value.trim();
    const password = (document.getElementById("landingPassword") as HTMLInputElement).value;
    if (!email || !password) {
      errEl().textContent = "Email and password are required.";
      errEl().hidden = false;
      return;
    }
    errEl().hidden = true;
    try {
      await signInWithEmail(email, password);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("popup-closed-by-user")) return;
      errEl().textContent = e instanceof Error ? e.message : "Sign-in failed.";
      errEl().hidden = false;
    }
  };

  document.getElementById("landingSignInBtn")!.addEventListener("click", doEmailSignIn);
  (document.getElementById("landingPassword") as HTMLInputElement).addEventListener("keydown", (e) => {
    if (e.key === "Enter") void doEmailSignIn();
  });
  document.getElementById("loginGoogleBtn")!.addEventListener("click", async () => {
    errEl().hidden = true;
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("popup-closed-by-user")) return;
      errEl().textContent = e instanceof Error ? e.message : "Sign-in failed.";
      errEl().hidden = false;
    }
  });
  const requestPmBtn = document.getElementById("requestPmBtn") as HTMLButtonElement;
  requestPmBtn.addEventListener("click", () => showPmRequestForm());

  // Disable "Request PM Account" if SM has turned off PM requests
  getAppSettings().then((settings) => {
    if (settings.pmRequestDisabled) {
      requestPmBtn.disabled = true;
      requestPmBtn.title = "PM account requests are currently closed.";
      requestPmBtn.textContent = "Requests Closed";
    }
  }).catch(() => { /* silently ignore — button stays enabled on error */ });
};

// Dedicated page shown when arriving via the PM approval email link
const renderPmRegistrationPage = (requestId: string): void => {
  const c = getContainer();
  c.innerHTML = `<div class="screen-overlay"><div class="screen-card login-card"><p class="pref-hint">Loading…</p></div></div>`;

  getPmRequest(requestId).then((pmReq) => {
    const email = pmReq?.email ?? "";

    c.innerHTML = `
      <div class="screen-overlay" id="landingScreen">
        <div class="landing-layout">
          <div class="landing-brand">
            <h1 class="landing-title">Burndown Studio</h1>
            <p class="landing-subtitle">PM Account Registration</p>
          </div>
          <div class="landing-card">
            <p class="landing-card-label">Complete your registration</p>
            <p class="pref-hint" style="margin:0 0 12px">Your PM account has been approved. Create a password for <strong>${escapeHtml(email)}</strong>.</p>
            <label class="screen-label">
              Email
              <input type="email" id="regEmail" class="screen-input" value="${escapeHtml(email)}" readonly
                style="background:var(--bg-secondary,#f1f5f9);cursor:default;color:var(--text-muted,#64748b)" />
            </label>
            <label class="screen-label">
              Password
              <input type="password" id="regPassword" class="screen-input" placeholder="Min 6 characters" autocomplete="new-password" />
            </label>
            <label class="screen-label">
              Confirm Password
              <input type="password" id="regPassword2" class="screen-input" placeholder="Confirm password" autocomplete="new-password" />
            </label>
            <button class="btn" id="regCreateBtn" style="width:100%;margin-top:4px">Continue</button>
            <div class="screen-error" id="regError" hidden></div>
            <div class="login-divider"><span>or</span></div>
            <button class="login-google-btn" id="regGoogleBtn">${googleSvg} Sign in with Google</button>
            <p class="pref-hint" style="font-size:11px;margin-top:6px">Use Google Sign-In if <strong>${escapeHtml(email)}</strong> is a Google or Google Workspace account.</p>
          </div>
        </div>
      </div>
    `;

    const errEl = document.getElementById("regError")!;

    const doCreate = async () => {
      const pw1 = (document.getElementById("regPassword") as HTMLInputElement).value;
      const pw2 = (document.getElementById("regPassword2") as HTMLInputElement).value;
      errEl.hidden = true;
      if (!pw1) { errEl.textContent = "Password is required."; errEl.hidden = false; return; }
      if (pw1 !== pw2) { errEl.textContent = "Passwords do not match."; errEl.hidden = false; return; }
      if (pw1.length < 6) { errEl.textContent = "Password must be at least 6 characters."; errEl.hidden = false; return; }
      const btn = document.getElementById("regCreateBtn") as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = "Processing…";
      try {
        await createAccountWithEmail(email, pw1);
        // Auth callback picks up pendingPmApproved from sessionStorage
      } catch (e: unknown) {
        const code = (e as { code?: string }).code;
        if (code === "auth/email-already-in-use") {
          // Account already exists — try signing in with the provided password
          try {
            await signInWithEmail(email, pw1);
          } catch {
            errEl.textContent = "An account with this email already exists. Enter your existing password in both fields, or use Google sign-in.";
            errEl.hidden = false;
            btn.disabled = false;
            btn.textContent = "Continue";
          }
        } else {
          errEl.textContent = e instanceof Error ? e.message : "Failed to create account.";
          errEl.hidden = false;
          btn.disabled = false;
          btn.textContent = "Continue";
        }
      }
    };

    document.getElementById("regCreateBtn")!.addEventListener("click", doCreate);
    (document.getElementById("regPassword2") as HTMLInputElement).addEventListener("keydown", (e) => {
      if (e.key === "Enter") void doCreate();
    });

    document.getElementById("regGoogleBtn")!.addEventListener("click", async () => {
      errEl.hidden = true;
      try {
        await signInWithGoogle();
      } catch (e: unknown) {
        errEl.textContent = e instanceof Error ? e.message : "Sign-in failed.";
        errEl.hidden = false;
      }
    });

    setTimeout(() => (document.getElementById("regPassword") as HTMLInputElement)?.focus(), 50);
  }).catch(() => {
    c.innerHTML = `<div class="screen-overlay"><div class="screen-card login-card">
      <p class="screen-error">Failed to load registration details. Please try the link again.</p>
    </div></div>`;
  });
};

// ---------------------------------------------------------------------------
// Invitation Registration Page
// ---------------------------------------------------------------------------

const renderInvitationRegistrationPage = (inviteId: string): void => {
  const c = getContainer();
  c.innerHTML = `<div class="screen-overlay"><div class="screen-card login-card"><p class="pref-hint">Loading invitation…</p></div></div>`;

  getInvitation(inviteId).then((invitation) => {
    if (!invitation || invitation.status !== "pending") {
      c.innerHTML = `<div class="screen-overlay"><div class="screen-card login-card">
        <h2>Invitation Unavailable</h2>
        <p class="screen-error">${invitation ? "This invitation has already been used or declined." : "Invitation not found."}</p>
      </div></div>`;
      return;
    }

    const email = invitation.email;

    c.innerHTML = `
      <div class="screen-overlay" id="landingScreen">
        <div class="landing-layout">
          <div class="landing-brand">
            <h1 class="landing-title">Burndown Studio</h1>
            <p class="landing-subtitle">Team Invitation</p>
          </div>
          <div class="landing-card">
            <p class="landing-card-label">You've been invited to join a team</p>
            <p class="pref-hint" style="margin:0 0 12px">Accept the invitation for <strong>${escapeHtml(email)}</strong>.</p>
            <div class="screen-error" id="invError" hidden></div>
            <label class="screen-label">
              Password
              <input type="password" id="invPassword" class="screen-input" placeholder="Min 6 characters (new account)" autocomplete="new-password" />
            </label>
            <label class="screen-label">
              Confirm Password
              <input type="password" id="invPassword2" class="screen-input" placeholder="Confirm password" autocomplete="new-password" />
            </label>
            <button class="btn" id="invCreateBtn" style="width:100%;margin-top:4px">Continue</button>
            <div class="login-divider"><span>or</span></div>
            <button class="login-google-btn" id="invGoogleBtn">${googleSvg} Continue with Google</button>
          </div>
        </div>
      </div>
    `;

    const errEl = document.getElementById("invError")!;

    document.getElementById("invGoogleBtn")!.addEventListener("click", async () => {
      errEl.hidden = true;
      try {
        await signInWithGoogle();
      } catch (e: unknown) {
        errEl.textContent = e instanceof Error ? e.message : "Sign-in failed.";
        errEl.hidden = false;
      }
    });

    const doCreate = async () => {
      const pw1 = (document.getElementById("invPassword") as HTMLInputElement).value;
      const pw2 = (document.getElementById("invPassword2") as HTMLInputElement).value;
      errEl.hidden = true;
      if (!pw1) { errEl.textContent = "Password is required."; errEl.hidden = false; return; }
      if (pw1 !== pw2) { errEl.textContent = "Passwords do not match."; errEl.hidden = false; return; }
      if (pw1.length < 6) { errEl.textContent = "Password must be at least 6 characters."; errEl.hidden = false; return; }
      const btn = document.getElementById("invCreateBtn") as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = "Processing…";
      try {
        await createAccountWithEmail(email, pw1);
      } catch (e: unknown) {
        const code = (e as { code?: string }).code;
        if (code === "auth/email-already-in-use") {
          // Account already exists — try signing in with the provided password
          try {
            await signInWithEmail(email, pw1);
          } catch {
            errEl.textContent = "An account with this email already exists. Enter your existing password in both fields, or use Google sign-in.";
            errEl.hidden = false;
            btn.disabled = false;
            btn.textContent = "Continue";
          }
        } else {
          errEl.textContent = e instanceof Error ? e.message : "Failed to create account.";
          errEl.hidden = false;
          btn.disabled = false;
          btn.textContent = "Continue";
        }
      }
    };

    document.getElementById("invCreateBtn")!.addEventListener("click", doCreate);
    (document.getElementById("invPassword2") as HTMLInputElement).addEventListener("keydown", (e) => {
      if (e.key === "Enter") void doCreate();
    });

setTimeout(() => (document.getElementById("invPassword") as HTMLInputElement)?.focus(), 50);
  }).catch(() => {
    c.innerHTML = `<div class="screen-overlay"><div class="screen-card login-card">
      <p class="screen-error">Failed to load invitation. Please try the link again.</p>
    </div></div>`;
  });
};

// ---------------------------------------------------------------------------
// PM Request Form
// ---------------------------------------------------------------------------

export const showPmRequestForm = (): void => {
  document.getElementById("pmRequestModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "pmRequestModal";
  modal.className = "team-modal-overlay";
  modal.innerHTML = `
    <div class="team-modal team-modal-wide">
      <h3>Request PM Account</h3>
      <p class="pref-hint">Fill in the details below. We'll review your request and notify you by email.</p>
      <label class="screen-label">
        Your Name
        <input type="text" id="pmReqName" class="screen-input" placeholder="Full name" />
      </label>
      <label class="screen-label">
        Your Email
        <input type="email" id="pmReqEmail" class="screen-input" placeholder="you@example.com" />
      </label>
      <label class="screen-label">
        Group Name
        <input type="text" id="pmReqGroup" class="screen-input" placeholder="e.g. Acme Dev Team" />
      </label>
      <label class="screen-label">
        Organization <span class="optional-hint">(optional)</span>
        <input type="text" id="pmReqOrg" class="screen-input" placeholder="Company or organization" />
      </label>
      <label class="screen-label">
        Brief Description <span class="optional-hint">(optional)</span>
        <textarea id="pmReqDesc" class="screen-input" rows="3" placeholder="Purpose of the group, number of members, etc."></textarea>
      </label>
      <div class="screen-error" id="pmReqError" hidden></div>
      <div class="screen-success" id="pmReqSuccess" hidden></div>
      <div class="team-modal-footer">
        <button class="btn ghost" id="pmReqCancel">Cancel</button>
        <button class="btn" id="pmReqSubmit">Submit Request</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
  document.getElementById("pmReqCancel")!.addEventListener("click", () => modal.remove());

  document.getElementById("pmReqSubmit")!.addEventListener("click", async () => {
    const name = (document.getElementById("pmReqName") as HTMLInputElement).value.trim();
    const email = (document.getElementById("pmReqEmail") as HTMLInputElement).value.trim();
    const groupName = (document.getElementById("pmReqGroup") as HTMLInputElement).value.trim();
    const organization = (document.getElementById("pmReqOrg") as HTMLInputElement).value.trim();
    const description = (document.getElementById("pmReqDesc") as HTMLTextAreaElement).value.trim();
    const errEl = document.getElementById("pmReqError")!;
    const successEl = document.getElementById("pmReqSuccess")!;
    errEl.hidden = true;
    successEl.hidden = true;

    if (!name || !email || !groupName) {
      errEl.textContent = "Please fill in all required fields.";
      errEl.hidden = false;
      return;
    }

    const btn = document.getElementById("pmReqSubmit") as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "Submitting…";
    try {
      await createPmRequest({
        email,
        displayName: name,
        groupName,
        organization,
        description,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      modal.remove();
    } catch (e: unknown) {
      errEl.textContent = e instanceof Error ? e.message : "Failed to submit request.";
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = "Submit Request";
    }
  });

  setTimeout(() => (document.getElementById("pmReqName") as HTMLInputElement).focus(), 50);
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
  onProfileUpdated?: (updated: UserProfile) => void,
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
            <p class="eyebrow">GROUP</p>
            <p class="admin-sidebar-group-name" id="teamScreenGroupName"></p>
          </div>
          <div class="team-screen-user">
            <img id="teamUserAvatar" class="team-user-avatar" />
            <div class="team-user-info">
              <span class="team-user-name" id="teamUserName">${escapeHtml(profile.displayName)}</span>
            </div>
            <button class="btn ghost small" id="teamEditProfileBtn" title="Edit profile" style="padding:4px 8px">✎</button>
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

  // Set avatar
  const avatarImg = document.getElementById("teamUserAvatar") as HTMLImageElement;
  avatarImg.src = avatarSrc(profile, 36);

  // Load group name for members
  if (profile.groupId) {
    getGroupById(profile.groupId).then((group) => {
      const header = document.getElementById("teamScreenGroupName");
      if (header) header.textContent = group?.name ?? "";
    }).catch(() => {});
  }

  document.getElementById("teamSignOutBtn")!.addEventListener("click", () => signOut());

  document.getElementById("teamEditProfileBtn")!.addEventListener("click", () => {
    showProfileEditModal(profile, false, (updated) => {
      _currentProfile = updated;
      profile = updated;
      const nameEl = document.getElementById("teamUserName");
      if (nameEl) nameEl.textContent = updated.displayName;
      const avImg = document.getElementById("teamUserAvatar") as HTMLImageElement | null;
      if (avImg) avImg.src = avatarSrc(updated, 36);
      onProfileUpdated?.(updated);
      // Refresh team grid to reflect any name changes
      loadAndRenderTeams(user, updated);
    }, user);
  });

  loadAndRenderTeams(user, profile);
};

const loadAndRenderTeams = async (user: User, profile: UserProfile): Promise<void> => {
  const grid = document.getElementById("teamGrid");
  if (!grid) return;
  try {
    const teams = await getTeamsForUser(user.uid, profile.role);
    teams.sort((a, b) => {
      const oa = a.order ?? Number.MAX_SAFE_INTEGER;
      const ob = b.order ?? Number.MAX_SAFE_INTEGER;
      return oa !== ob ? oa - ob : a.createdAt.localeCompare(b.createdAt);
    });
    // Collect all unique member UIDs across all teams
    const allUids = Array.from(new Set(teams.flatMap((t) => t.memberIds)));
    const memberProfiles = await getUsersByIds(allUids);
    const memberMap = new Map(memberProfiles.map((p) => [p.uid, p]));
    renderTeamGrid(grid, teams, profile, memberMap);
  } catch (e: unknown) {
    const err = document.getElementById("teamError");
    if (err) {
      err.textContent = e instanceof Error ? e.message : "Failed to load teams.";
      err.hidden = false;
    }
    grid.innerHTML = "";
  }
};

const renderTeamGrid = (
  grid: HTMLElement,
  teams: Team[],
  profile: UserProfile,
  memberMap: Map<string, UserProfile> = new Map(),
): void => {
  grid.innerHTML = "";

  const isPM = profile.role === "product_manager";

  for (const team of teams) {
    const card = document.createElement("button");
    card.className = "team-card";

    // Build member avatar row (max 5 shown + overflow count)
    const MAX_SHOWN = 5;
    const memberProfs = team.memberIds
      .map((uid) => memberMap.get(uid))
      .filter((p): p is UserProfile => !!p);
    const shown = memberProfs.slice(0, MAX_SHOWN);
    const overflow = memberProfs.length - shown.length;
    const avatarRowHtml = shown.length > 0 ? `
      <div class="team-card-avatars">
        ${shown.map((p) => `<img class="team-card-avatar" src="${escapeHtml(avatarSrc(p, 28))}" title="${escapeHtml(p.displayName)}" data-uid="${p.uid}" />`).join("")}
        ${overflow > 0 ? `<div class="team-card-avatar-more">+${overflow}</div>` : ""}
      </div>
    ` : `<div class="team-card-meta">${team.memberIds.length} member${team.memberIds.length !== 1 ? "s" : ""}</div>`;

    card.innerHTML = `
      ${isPM ? '<div class="team-card-drag-handle" title="Drag to reorder">⠿</div>' : ""}
      <div class="team-card-name">${escapeHtml(team.name)}</div>
      ${avatarRowHtml}
    `;
    card.addEventListener("click", () => _onTeamSelected?.(team.id, team.name));
    grid.appendChild(card);

    // Drag-to-reorder (PM only)
    if (isPM) {
      card.dataset.teamId = team.id;

      card.addEventListener("pointerdown", (e) => {
        if ((e.target as HTMLElement).closest(".team-manage-btn, .team-delete-btn")) return;
        e.preventDefault();
        card.setPointerCapture(e.pointerId);

        const startX = e.clientX;
        const startY = e.clientY;
        const rect = card.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        let dragging = false;
        let floatEl: HTMLElement | null = null;
        let targetCard: HTMLElement | null = null;

        const onMove = (ev: PointerEvent) => {
          if (!dragging) {
            if (Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
            dragging = true;
            card.classList.add("team-card-dragging");
            floatEl = document.createElement("div");
            floatEl.className = "team-card team-card-floating";
            floatEl.innerHTML = card.innerHTML;
            floatEl.style.width = card.offsetWidth + "px";
            floatEl.style.height = card.offsetHeight + "px";
            document.body.appendChild(floatEl);
          }
          if (floatEl) {
            floatEl.style.left = (ev.clientX - offsetX) + "px";
            floatEl.style.top = (ev.clientY - offsetY) + "px";
          }
          // floatEl has pointer-events:none so elementFromPoint sees through it
          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          const candidate = el?.closest<HTMLElement>(".team-card[data-team-id]");
          grid.querySelectorAll(".team-card-drag-over").forEach((c) => c.classList.remove("team-card-drag-over"));
          if (candidate && candidate !== card) {
            candidate.classList.add("team-card-drag-over");
            targetCard = candidate;
          } else {
            targetCard = null;
          }
        };

        const onUp = async () => {
          card.removeEventListener("pointermove", onMove);
          floatEl?.remove();
          card.classList.remove("team-card-dragging");
          grid.querySelectorAll(".team-card-drag-over").forEach((c) => c.classList.remove("team-card-drag-over"));

          if (!dragging) return;
          card.addEventListener("click", (ev) => ev.stopPropagation(), { once: true, capture: true });

          const toId = targetCard?.dataset.teamId;
          if (!toId || toId === team.id) return;
          const ordered = [...teams];
          const fromIdx = ordered.findIndex((t) => t.id === team.id);
          const toIdx = ordered.findIndex((t) => t.id === toId);
          if (fromIdx === -1 || toIdx === -1) return;
          const [moved] = ordered.splice(fromIdx, 1);
          ordered.splice(toIdx, 0, moved);
          await Promise.all(ordered.map((t, idx) => updateTeamOrder(t.id, idx)));
          if (_currentUser && _currentProfile) loadAndRenderTeams(_currentUser, _currentProfile);
        };

        card.addEventListener("pointermove", onMove);
        card.addEventListener("pointerup", onUp, { once: true });
        card.addEventListener("pointercancel", onUp, { once: true });
      });
    }

    // Avatar click → popup profile
    card.querySelectorAll<HTMLImageElement>(".team-card-avatar").forEach((img) => {
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        const uid = img.dataset.uid;
        const p = uid ? memberMap.get(uid) : undefined;
        if (p?.photoFull) showPhotoPopup(p.photoFull);
        else if (p?.photoThumb) showPhotoPopup(p.photoThumb);
        else if (p) showPhotoPopup(makeInitialAvatar(p.displayName, 200));
      });
    });

    const canManage = profile.role === "product_manager";
    const canDelete = team.ownerId === profile.uid;

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

  if (profile.role === "product_manager") {
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

const showManageMembers = (team: Team, profile: UserProfile, onDone?: () => void, groupId?: string): void => {
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
          <div class="manage-members-col-title">Add Group Members</div>
          <div id="availableMemberList" class="manage-member-list"><em>Loading…</em></div>
          <hr class="manage-section-divider" />
          <div class="manage-members-col-title">Invite by Email</div>
          <textarea id="inviteEmailInput" class="screen-input manage-section-input" rows="4" placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com" style="width:100%;resize:vertical"></textarea>
          <button class="btn manage-section-btn" id="inviteSendBtn">Send Invites</button>
          <div class="screen-error" id="inviteError" hidden></div>
          <div class="screen-success" id="inviteSuccess" hidden></div>
          <div class="manage-members-col-title" style="margin-top:8px">Pending Invitations</div>
          <div id="pendingInviteList" class="manage-member-list"><em>Loading…</em></div>
          <hr class="manage-section-divider" />
          <div class="manage-members-col-title">Pre-register Users</div>
          <p class="pref-hint" style="margin:2px 0 6px">Users with Google accounts are auto-joined on first sign-in.</p>
          <textarea id="preregEmailsInput" class="screen-input manage-section-input" rows="4" placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com" style="width:100%;resize:vertical"></textarea>
          <button class="btn manage-section-btn" id="preregSubmitBtn">Pre-register</button>
          <div class="screen-error" id="preregError" hidden></div>
          <div class="screen-success" id="preregSuccess" hidden></div>
          <div class="manage-members-col-title" style="margin-top:8px">Pending Pre-registrations</div>
          <div id="pendingPreregList" class="manage-member-list"><em>Loading…</em></div>
        </div>
      </div>
      <div class="team-modal-footer">
        <button class="btn" id="manageMembersDone">Done</button>
      </div>
    </div>
  `;
  getContainer().appendChild(modal);
  document.body.style.overflow = "hidden";

  const closeModal = () => {
    modal.remove();
    document.body.style.overflow = "";
    onDone?.();
  };

  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.getElementById("manageMembersDone")!.addEventListener("click", closeModal);

  const refreshMembers = async () => {
    const errEl = document.getElementById("manageMemberError")!;
    errEl.hidden = true;
    const currentEl = document.getElementById("currentMemberList")!;
    currentEl.innerHTML = "Loading…";

    let allUsers;
    try {
      allUsers = groupId ? await getGroupMemberProfiles(groupId) : await getAllUsers();
    } catch {
      currentEl.innerHTML = "<em>Failed to load users.</em>";
      return;
    }

    const members = allUsers.filter((u) => team.memberIds.includes(u.uid));
    const available = allUsers.filter((u) => !team.memberIds.includes(u.uid));

    // Populate available group members (not yet in this team)
    const availableEl = document.getElementById("availableMemberList")!;
    if (available.length === 0) {
      availableEl.innerHTML = "<em>All group members are already in this team.</em>";
    } else {
      availableEl.innerHTML = available.map((u) => `
        <div class="manage-member-row">
          <div class="manage-member-info">
            <span class="member-name">${escapeHtml(u.displayName)}</span>
            <span class="member-email">${escapeHtml(u.email)}</span>
          </div>
          <button class="btn ghost small member-add-btn" data-uid="${u.uid}">Add</button>
        </div>
      `).join("");
      availableEl.querySelectorAll<HTMLButtonElement>(".member-add-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const uid = btn.dataset.uid!;
          btn.disabled = true;
          btn.textContent = "Adding…";
          try {
            const u = available.find((x) => x.uid === uid)!;
            await addMemberToTeamWithPrefs(team.id, uid, u.displayName);
            team.memberIds = [...team.memberIds, uid];
            void refreshMembers();
          } catch (e: unknown) {
            btn.disabled = false;
            btn.textContent = "Add";
            errEl.textContent = e instanceof Error ? e.message : "Failed to add member.";
            errEl.hidden = false;
          }
        });
      });
    }

    const memberRow = (u: typeof allUsers[0]) => {
      const phone = u.phoneNumber ? `<span class="member-phone">${escapeHtml(u.phoneNumber)}</span>` : "";
      return `
        <div class="manage-member-row" data-uid="${u.uid}" data-name="${escapeHtml(u.displayName)}">
          <div class="manage-member-info">
            <span class="member-name">${escapeHtml(u.displayName)}</span>
            <span class="member-email">${escapeHtml(u.email)}</span>
            ${phone}
          </div>
          <button class="btn ghost small danger member-remove-btn"
            data-uid="${u.uid}" data-name="${escapeHtml(u.displayName)}" data-email="${escapeHtml(u.email)}"
            ${u.uid === profile.uid ? "disabled title='Cannot remove yourself'" : ""}>Remove</button>
        </div>
      `;
    };

    if (members.length === 0) {
      currentEl.innerHTML = "<em>No members yet.</em>";
    } else {
      currentEl.innerHTML = members.map((u) => memberRow(u)).join("");
      currentEl.querySelectorAll<HTMLButtonElement>(".member-remove-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const uid = btn.dataset.uid!;
          const displayName = btn.dataset.name!;
          const email = btn.dataset.email!;
          errEl.hidden = true;

          btn.disabled = true;
          const prevText = btn.textContent;
          btn.textContent = "Checking…";
          let assigned: string[] = [];
          try {
            assigned = await findAssignedTasksInTeam(displayName, email, team.id, team.name);
          } catch {
            // ignore — proceed without assignment check
          } finally {
            btn.disabled = false;
            btn.textContent = prevText;
          }

          const doRemove = async () => {
            try {
              await removeMemberFromTeamWithPrefs(team.id, uid, displayName);
              team.memberIds = team.memberIds.filter((id) => id !== uid);
              refreshMembers();
            } catch (e: unknown) {
              errEl.textContent = e instanceof Error ? e.message : "Error removing member.";
              errEl.hidden = false;
            }
          };

          if (assigned.length > 0) {
            // Show confirmation dialog
            const existingDialog = document.getElementById("pmRemoveConfirmDialog");
            existingDialog?.remove();
            const dlg = document.createElement("div");
            dlg.id = "pmRemoveConfirmDialog";
            dlg.className = "team-modal-overlay";
            const listItems = assigned.slice(0, 5).map(t => `<li>${escapeHtml(t)}</li>`).join("");
            const more = assigned.length > 5 ? `<li style="color:var(--text-muted,#888)">… and ${assigned.length - 5} more</li>` : "";
            dlg.innerHTML = `
              <div class="team-modal">
                <h3>Remove Member?</h3>
                <p><strong>${escapeHtml(displayName)}</strong> is still assigned to ${assigned.length} task(s):</p>
                <ul style="margin:10px 0;padding-left:20px;font-size:0.88em;line-height:1.6">${listItems}${more}</ul>
                <p class="pref-hint">Removing them will not unassign these tasks. Continue?</p>
                <div class="team-modal-footer">
                  <button class="btn ghost" id="pmRemoveCancel">Cancel</button>
                  <button class="btn danger" id="pmRemoveConfirm">Remove Anyway</button>
                </div>
              </div>
            `;
            document.body.appendChild(dlg);
            document.getElementById("pmRemoveCancel")!.addEventListener("click", () => dlg.remove());
            document.getElementById("pmRemoveConfirm")!.addEventListener("click", async () => {
              dlg.remove();
              await doRemove();
            });
            return;
          }

          await doRemove();
        });
      });
    }
  };

  const refreshPendingInvites = async () => {
    const pendingEl = document.getElementById("pendingInviteList")!;
    if (!groupId) { pendingEl.innerHTML = "<em>No group context.</em>"; return; }
    try {
      const invites = await getInvitationsByGroup(groupId);
      const pending = invites.filter((i) => i.status === "pending");
      if (pending.length === 0) {
        pendingEl.innerHTML = "<em>No pending invitations.</em>";
      } else {
        pendingEl.innerHTML = pending.map((inv) => `
          <div class="manage-member-row">
            <div class="manage-member-info">
              <span class="member-email">${escapeHtml(inv.email)}</span>
              <span class="member-role-badge" style="margin-left:8px">pending</span>
            </div>
            <button class="btn ghost" data-cancel-invite="${inv.id}" style="font-size:0.8em;padding:2px 8px">Cancel</button>
          </div>
        `).join("");
        pendingEl.querySelectorAll<HTMLButtonElement>("[data-cancel-invite]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.cancelInvite!;
            btn.disabled = true;
            btn.textContent = "Cancelling…";
            try {
              await updateInvitation(id, { status: "cancelled" });
              void refreshPendingInvites();
            } catch {
              btn.disabled = false;
              btn.textContent = "Cancel";
            }
          });
        });
      }
    } catch {
      pendingEl.innerHTML = "<em>Failed to load.</em>";
    }
  };

  // Wire invite button
  document.getElementById("inviteSendBtn")!.addEventListener("click", async () => {
    const textarea = document.getElementById("inviteEmailInput") as HTMLTextAreaElement;
    const errInvEl = document.getElementById("inviteError")!;
    const successEl = document.getElementById("inviteSuccess")!;
    const btn = document.getElementById("inviteSendBtn") as HTMLButtonElement;
    errInvEl.hidden = true;
    successEl.hidden = true;

    if (!groupId) {
      errInvEl.textContent = "No group context for invitation.";
      errInvEl.hidden = false;
      return;
    }

    const emails = [...new Set(
      textarea.value.split("\n")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    )];
    if (emails.length === 0) {
      errInvEl.textContent = "Please enter at least one valid email address.";
      errInvEl.hidden = false;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Sending…";
    const failed: string[] = [];
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sendEmail = httpsCallable(functions, "sendInvitationEmail");

    for (const email of emails) {
      let inviteId: string | null = null;
      try {
        inviteId = await createInvitation({
          email,
          groupId,
          teamIds: [team.id],
          invitedBy: profile.uid,
          status: "pending",
          createdAt: now.toISOString(),
          expiresAt: expires.toISOString(),
        });
        await sendEmail({ inviteId });
      } catch {
        if (inviteId) void updateInvitation(inviteId, { status: "cancelled" });
        failed.push(email);
      }
    }

    btn.disabled = false;
    btn.textContent = "Send Invites";

    const sent = emails.length - failed.length;
    if (failed.length > 0) {
      errInvEl.textContent = `Failed to send to: ${failed.join(", ")}`;
      errInvEl.hidden = false;
    }
    if (sent > 0) {
      textarea.value = "";
      successEl.textContent = `Invitation${sent > 1 ? "s" : ""} sent to ${sent} recipient${sent > 1 ? "s" : ""}.`;
      successEl.hidden = false;
    }
    void refreshPendingInvites();
  });

  const refreshPendingPreregs = async () => {
    const listEl = document.getElementById("pendingPreregList")!;
    if (!groupId) { listEl.innerHTML = "<em>No group context.</em>"; return; }
    try {
      const all = await getPreregistrationsByGroup(groupId, profile.uid);
      const pending = all.filter((p) => p.status === "pending" && p.teamIds.includes(team.id));
      if (pending.length === 0) {
        listEl.innerHTML = "<em>No pending pre-registrations.</em>";
      } else {
        listEl.innerHTML = pending.map((p) => `
          <div class="manage-member-row">
            <div class="manage-member-info">
              <span class="member-email">${escapeHtml(p.email)}</span>
              <span class="member-role-badge" style="margin-left:8px">pending</span>
            </div>
            <button class="btn ghost" data-cancel-prereg="${p.id}" style="font-size:0.8em;padding:2px 8px">Cancel</button>
          </div>
        `).join("");
        listEl.querySelectorAll<HTMLButtonElement>("[data-cancel-prereg]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.cancelPrereg!;
            btn.disabled = true;
            btn.textContent = "Cancelling…";
            try {
              await updatePreregistration(id, { status: "cancelled" });
              void refreshPendingPreregs();
            } catch {
              btn.disabled = false;
              btn.textContent = "Cancel";
            }
          });
        });
      }
    } catch {
      listEl.innerHTML = "<em>Failed to load.</em>";
    }
  };

  // Wire pre-register button
  document.getElementById("preregSubmitBtn")!.addEventListener("click", async () => {
    const textarea = document.getElementById("preregEmailsInput") as HTMLTextAreaElement;
    const errEl = document.getElementById("preregError")!;
    const successEl = document.getElementById("preregSuccess")!;
    const btn = document.getElementById("preregSubmitBtn") as HTMLButtonElement;
    errEl.hidden = true;
    successEl.hidden = true;

    if (!groupId) {
      errEl.textContent = "No group context.";
      errEl.hidden = false;
      return;
    }

    // Parse, normalise, deduplicate
    const emails = [...new Set(
      textarea.value.split("\n")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    )];
    if (emails.length === 0) {
      errEl.textContent = "Enter at least one valid email address.";
      errEl.hidden = false;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Pre-registering…";
    try {
      // Skip emails that already have a pending pre-registration in this group
      const existing = await getPreregistrationsByGroup(groupId, profile.uid);
      const pendingEmails = new Set(existing.filter((p) => p.status === "pending" && p.teamIds.includes(team.id)).map((p) => p.email));
      const toCreate = emails.filter((e) => !pendingEmails.has(e));
      const skipped = emails.length - toCreate.length;

      if (toCreate.length > 0) {
        const now = new Date().toISOString();
        await createPreregistrations(
          toCreate.map((email) => ({
            email,
            groupId,
            teamIds: [team.id],
            createdBy: profile.uid,
            createdAt: now,
            status: "pending" as const,
          })),
        );
      }

      textarea.value = "";
      let msg = toCreate.length > 0 ? `${toCreate.length} student(s) pre-registered.` : "";
      if (skipped > 0) msg += ` ${skipped} already pending (skipped).`;
      successEl.textContent = msg.trim();
      successEl.hidden = false;
      void refreshPendingPreregs();
    } catch (e: unknown) {
      errEl.textContent = e instanceof Error ? e.message : "Failed to pre-register.";
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Pre-register";
    }
  });

  void refreshMembers();
  void refreshPendingInvites();
  void refreshPendingPreregs();
};

// ---------------------------------------------------------------------------
// Admin Screen
// ---------------------------------------------------------------------------

export const showAdminScreen = (profile: UserProfile): void => {
  clearContainer();

  getContainer().innerHTML = `
    <div class="screen-overlay" id="adminScreen">
      <div class="admin-layout">
        <aside class="admin-sidebar">
          <div class="admin-sidebar-brand">
            <p class="eyebrow">Burndown Studio</p>
            <p class="admin-sidebar-role">Administration</p>
          </div>
          <nav class="admin-nav">
            <button class="admin-nav-item active" data-section="users">Users</button>
            <button class="admin-nav-item" data-section="groups">Groups</button>
            <button class="admin-nav-item" data-section="requests">Requests</button>
          </nav>
          <div class="admin-sidebar-footer">
            <span class="admin-footer-name">${escapeHtml(profile.displayName)}</span>
            <button class="btn ghost small" id="adminSignOutBtn">Sign Out</button>
          </div>
        </aside>
        <main class="admin-main">
          <div class="admin-main-header">
            <h2 class="admin-section-title" id="adminSectionTitle">Users</h2>
          </div>
          <div class="screen-error" id="adminError" hidden></div>
          <div id="adminContent">
            <div id="adminUserTable" class="admin-table-wrap"><em>Loading users…</em></div>
          </div>
        </main>
      </div>
    </div>
  `;

  document.getElementById("adminSignOutBtn")!.addEventListener("click", () => signOut());

  document.querySelectorAll<HTMLButtonElement>(".admin-nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll<HTMLButtonElement>(".admin-nav-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadAdminSection(btn.dataset.section!);
    });
  });

  loadAdminUsers();
};

const loadAdminSection = (section: string): void => {
  const content = document.getElementById("adminContent");
  const title = document.getElementById("adminSectionTitle");
  if (!content || !title) return;
  if (section === "users") {
    title.textContent = "Users";
    content.innerHTML = `<div id="adminUserTable" class="admin-table-wrap"><em>Loading users…</em></div>`;
    loadAdminUsers();
  } else if (section === "groups") {
    title.textContent = "Groups";
    content.innerHTML = `<div id="adminGroupTable" class="admin-table-wrap"><em>Loading groups…</em></div>`;
    void loadAdminGroups();
  } else if (section === "requests") {
    title.textContent = "PM Requests";
    content.innerHTML = `<div id="adminRequestsToggle"></div><div id="adminRequestTable" class="admin-table-wrap"><em>Loading requests…</em></div>`;
    void loadAdminRequests();
  }
};

const loadAdminGroups = async (): Promise<void> => {
  const tableEl = document.getElementById("adminGroupTable");
  if (!tableEl) return;
  try {
    const [groups, allUsers, allTeams] = await Promise.all([
      getAllGroups(),
      getAllUsers(),
      getAllTeams(),
    ]);
    const userMap = new Map(allUsers.map((u) => [u.uid, u]));
    if (groups.length === 0) {
      tableEl.innerHTML = "<em>No groups found.</em>";
      return;
    }
    tableEl.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Group Name</th>
            <th>Owner</th>
            <th>Members</th>
            <th>Teams</th>
          </tr>
        </thead>
        <tbody>
          ${groups.map((g) => {
            const owner = userMap.get(g.ownerId);
            const memberCount = allUsers.filter((u) => u.groupId === g.id).length;
            const teamCount = allTeams.filter((t) => t.groupId === g.id).length;
            return `
              <tr>
                <td>${escapeHtml(g.name)}</td>
                <td>${owner
                  ? `${owner.displayName !== owner.email ? `${escapeHtml(owner.displayName)} ` : ""}<span class="member-email">${escapeHtml(owner.email)}</span>`
                  : "<em>unknown</em>"
                }</td>
                <td>${memberCount}</td>
                <td>${teamCount}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  } catch (e: unknown) {
    tableEl.innerHTML = `<em>Failed to load groups: ${e instanceof Error ? escapeHtml(e.message) : "Unknown error"}</em>`;
  }
};

const loadAdminRequests = async (): Promise<void> => {
  const tableEl = document.getElementById("adminRequestTable");
  if (!tableEl) return;
  try {
    const [requests, settings] = await Promise.all([getAllPmRequests(), getAppSettings()]);
    const pmRequestDisabled = !!settings.pmRequestDisabled;

    // Render the on/off toggle above the table
    const toggleContainer = document.getElementById("adminRequestsToggle");
    if (toggleContainer) {
      toggleContainer.innerHTML = `
        <div class="admin-setting-row">
          <div style="display:flex;align-items:center;gap:8px;justify-content:flex-start">
            <label for="pmRequestDisabledChk" style="font-size:0.9rem;cursor:pointer;margin:0">Disable PM Account Requests</label>
            <input type="checkbox" id="pmRequestDisabledChk" ${pmRequestDisabled ? "checked" : ""} style="width:15px;height:15px;cursor:pointer;margin:0;flex-shrink:0" />
          </div>
          <p class="pref-hint" style="margin:4px 0 0">When checked, the "Request PM Account" button on the landing page is disabled.</p>
        </div>
      `;
      const chk = document.getElementById("pmRequestDisabledChk") as HTMLInputElement;
      chk.addEventListener("change", async () => {
        chk.disabled = true;
        try {
          await setAppSetting("pmRequestDisabled", chk.checked);
        } catch {
          chk.checked = !chk.checked; // revert on error
        } finally {
          chk.disabled = false;
        }
      });
    }
    // Sort: pending first, then by createdAt desc
    requests.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    if (requests.length === 0) {
      tableEl.innerHTML = "<em>No PM requests yet.</em>";
      return;
    }
    tableEl.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Group Name</th>
            <th>Organization</th>
            <th>Description</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${requests.map((r) => `
            <tr data-req-id="${r.id}">
              <td>${escapeHtml(r.email)}</td>
              <td>${escapeHtml(r.displayName)}</td>
              <td>${escapeHtml(r.groupName)}</td>
              <td>${escapeHtml(r.organization)}</td>
              <td style="max-width:200px;white-space:normal;font-size:0.85em">${escapeHtml(r.description || "")}</td>
              <td><span class="req-status req-status-${r.status}">${r.status}</span></td>
              <td>
                ${r.status === "pending" ? `
                  <button class="btn small req-approve-btn" data-id="${r.id}">Approve</button>
                  <button class="btn ghost small danger req-reject-btn" data-id="${r.id}" style="margin-left:4px">Reject</button>
                ` : ""}
                <button class="btn ghost small danger req-delete-btn" data-id="${r.id}" style="margin-left:4px" title="Delete this request">✕</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    const errEl = document.getElementById("adminError")!;

    tableEl.querySelectorAll<HTMLButtonElement>(".req-approve-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id!;
        btn.disabled = true;
        btn.textContent = "Approving…";
        errEl.hidden = true;
        try {
          const req = requests.find((r) => r.id === id)!;
          await updatePmRequest(id, {
            status: "approved",
            reviewedAt: new Date().toISOString(),
          });
          // If the user already has an account, promote them immediately
          const existingProfile = await getUserProfileByEmail(req.email);
          if (existingProfile && existingProfile.role !== "product_manager" && existingProfile.role !== "super_manager") {
            await setUserRole(existingProfile.uid, "product_manager");
          }
          const sendApproval = httpsCallable(functions, "sendPmApprovalEmail");
          await sendApproval({ requestId: id });
          void loadAdminRequests();
        } catch (e: unknown) {
          errEl.textContent = e instanceof Error ? e.message : "Failed to approve.";
          errEl.hidden = false;
          btn.disabled = false;
          btn.textContent = "Approve";
        }
      });
    });

    tableEl.querySelectorAll<HTMLButtonElement>(".req-reject-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id!;
        btn.disabled = true;
        errEl.hidden = true;
        try {
          await updatePmRequest(id, {
            status: "rejected",
            reviewedAt: new Date().toISOString(),
          });
          void loadAdminRequests();
        } catch (e: unknown) {
          errEl.textContent = e instanceof Error ? e.message : "Failed to reject.";
          errEl.hidden = false;
          btn.disabled = false;
        }
      });
    });

    tableEl.querySelectorAll<HTMLButtonElement>(".req-delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this PM request? This cannot be undone.")) return;
        const id = btn.dataset.id!;
        btn.disabled = true;
        errEl.hidden = true;
        try {
          await deletePmRequest(id);
          void loadAdminRequests();
        } catch (e: unknown) {
          errEl.textContent = e instanceof Error ? e.message : "Failed to delete.";
          errEl.hidden = false;
          btn.disabled = false;
        }
      });
    });
  } catch (e: unknown) {
    tableEl.innerHTML = `<em>Failed to load requests: ${e instanceof Error ? escapeHtml(e.message) : "Unknown error"}</em>`;
  }
};

let _adminUsers: UserProfile[] = [];
let _adminGroups: Group[] = [];
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
          <th>Role</th><th>Group</th><th></th>
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
              <select class="group-select" data-uid="${u.uid}" ${u.role === "super_manager" ? "disabled" : ""}>
                <option value="">— none —</option>
                ${_adminGroups.map((g) => {
                  const pmName = _adminUsers.find(x => x.uid === g.ownerId)?.displayName ?? g.ownerId;
                  return `<option value="${g.id}" ${u.groupId === g.id ? "selected" : ""}>${escapeHtml(g.name)} (${escapeHtml(pmName)})</option>`;
                }).join("")}
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
        renderAdminTable(); // re-render to disable group select for SM
      } catch (e: unknown) {
        errEl.textContent = e instanceof Error ? e.message : "Failed to update role.";
        errEl.hidden = false;
        renderAdminTable();
      }
    });
  });

  tableEl.querySelectorAll<HTMLSelectElement>(".group-select").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const uid = sel.dataset.uid!;
      const groupId = sel.value || null;
      const errEl = document.getElementById("adminError")!;
      errEl.hidden = true;
      try {
        await updateUserProfile(uid, { groupId } as Parameters<typeof updateUserProfile>[1]);
        const u = _adminUsers.find(u => u.uid === uid);
        if (u) u.groupId = groupId === null ? undefined : groupId;
      } catch (e: unknown) {
        errEl.textContent = e instanceof Error ? e.message : "Failed to update group.";
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
          findAssignedTasksAcrossTeams(displayName, email, uid),
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
    [_adminUsers, _adminGroups] = await Promise.all([getAllUsers(), getAllGroups()]);
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
  user?: User,
): void => {
  document.getElementById("profileEditModal")?.remove();

  // Track pending photo changes (not persisted until Save)
  let pendingThumb: string | null = null;
  let pendingFull: string | null = null;

  const isGoogleUser = user?.providerData.some((p) => p.providerId === "google.com") ?? false;
  const currentAvatarSrc = avatarSrc(profile, 80);

  const modal = document.createElement("div");
  modal.id = "profileEditModal";
  modal.className = "team-modal-overlay";
  modal.innerHTML = `
    <div class="team-modal">
      <h3>${isNew ? "Complete Your Profile" : "Edit Profile"}</h3>
      ${isNew ? '<p class="pref-hint">Welcome! Please confirm your name and optionally add your phone number.</p>' : ""}
      <div class="profile-photo-section">
        <img id="profilePhotoImg" class="profile-photo-img" src="${escapeHtml(currentAvatarSrc)}" title="Click to view" />
        <div class="profile-photo-actions">
          <button type="button" class="btn ghost small" id="profileChangePhotoBtn">Change Photo</button>
          ${profile.photoThumb ? '<button type="button" class="btn ghost small danger" id="profileRemovePhotoBtn">Remove</button>' : ""}
        </div>
        <input type="file" id="profilePhotoFile" accept="image/*" style="display:none" />
      </div>
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
        ${!isNew && user && !isGoogleUser ? '<button class="btn ghost" id="profileChangePwBtn">Change Password</button>' : ""}
        ${isNew ? "" : '<button class="btn ghost" id="profileEditCancel">Cancel</button>'}
        <button class="btn" id="profileEditSave">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Photo preview click → popup
  const photoImg = document.getElementById("profilePhotoImg") as HTMLImageElement;
  photoImg.addEventListener("click", () => {
    const src = pendingFull ?? profile.photoFull ?? pendingThumb ?? profile.photoThumb;
    if (src) showPhotoPopup(src);
  });

  // Change photo
  const fileInput = document.getElementById("profilePhotoFile") as HTMLInputElement;
  document.getElementById("profileChangePhotoBtn")!.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    fileInput.value = "";
    const errEl = document.getElementById("profileEditError")!;
    errEl.hidden = true;
    if (file.size > 10 * 1024 * 1024) {
      errEl.textContent = "Image file is too large (max 10 MB).";
      errEl.hidden = false;
      return;
    }
    showCropModal(file, async (croppedDataUrl) => {
      try {
        [pendingFull, pendingThumb] = await Promise.all([
          resizeDataUrl(croppedDataUrl, 640),
          resizeDataUrl(croppedDataUrl, 80),
        ]);
        photoImg.src = pendingFull;
      } catch {
        errEl.textContent = "Failed to process image.";
        errEl.hidden = false;
      }
    });
  });

  // Remove photo
  document.getElementById("profileRemovePhotoBtn")?.addEventListener("click", () => {
    pendingThumb = "";
    pendingFull = "";
    photoImg.src = makeInitialAvatar(profile.displayName, 80);
  });

  // Change password button
  document.getElementById("profileChangePwBtn")?.addEventListener("click", () => {
    if (user) showChangePasswordModal(user);
  });

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
    const btn = document.getElementById("profileEditSave") as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      const photoUpdates: Record<string, string | null> = {};
      if (pendingThumb !== null) photoUpdates.photoThumb = pendingThumb || null;
      if (pendingFull !== null) photoUpdates.photoFull = pendingFull || null;
      await updateUserProfile(profile.uid, {
        displayName: name,
        phoneNumber: phone || null,
        ...photoUpdates,
      } as Parameters<typeof updateUserProfile>[1]);
      const updated: UserProfile = { ...profile, displayName: name };
      if (phone) updated.phoneNumber = phone; else delete updated.phoneNumber;
      if (pendingThumb !== null) {
        if (pendingThumb) updated.photoThumb = pendingThumb; else delete updated.photoThumb;
      }
      if (pendingFull !== null) {
        if (pendingFull) updated.photoFull = pendingFull; else delete updated.photoFull;
      }
      // Invalidate avatar cache for this name
      _avatarCache.delete(`${profile.displayName}:36`);
      _avatarCache.delete(`${profile.displayName}:80`);
      _avatarCache.delete(`${profile.displayName}:28`);
      _avatarCache.delete(`${profile.displayName}:24`);
      modal.remove();
      onSaved(updated);
    } catch (e: unknown) {
      errEl.textContent = e instanceof Error ? e.message : "Failed to save profile.";
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = "Save";
    }
  };

  document.getElementById("profileEditSave")!.addEventListener("click", doSave);
  (document.getElementById("profileNameInput") as HTMLInputElement).addEventListener("keydown", (e) => {
    if (e.key === "Enter") void doSave();
  });
  setTimeout(() => (document.getElementById("profileNameInput") as HTMLInputElement).focus(), 50);
};

// ---------------------------------------------------------------------------
// Create Group Screen (PM first-login)
// ---------------------------------------------------------------------------

export const showCreateGroupScreen = (
  user: User,
  profile: UserProfile,
  defaultName: string,
  onCreated: (group: Group) => void,
): void => {
  clearContainer();

  getContainer().innerHTML = `
    <div class="screen-overlay" id="createGroupScreen">
      <div class="screen-card login-card" style="max-width:440px;text-align:left">
        <p class="eyebrow">Burndown Studio</p>
        <h2 class="screen-title">Create Your Group</h2>
        <p class="screen-subtitle" style="text-align:left">Your Group is your workspace. Teams and members are organised within it.</p>
        <label class="screen-label">
          Group Name
          <input type="text" id="groupNameInput" class="screen-input" value="${escapeHtml(defaultName)}" />
        </label>
        <div class="screen-error" id="createGroupError" hidden></div>
        <div style="margin-top:20px;display:flex;justify-content:flex-end">
          <button class="btn" id="createGroupBtn">Create Group</button>
        </div>
      </div>
    </div>
  `;

  const doCreate = async () => {
    const name = (document.getElementById("groupNameInput") as HTMLInputElement).value.trim();
    const errEl = document.getElementById("createGroupError")!;
    errEl.hidden = true;
    if (!name) {
      errEl.textContent = "Group name cannot be empty.";
      errEl.hidden = false;
      return;
    }
    const btn = document.getElementById("createGroupBtn") as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "Creating…";
    try {
      const groupId = await createGroup(name, profile.uid);
      await linkExistingTeamsToGroup(profile.uid, groupId);
      const group: Group = { id: groupId, name, ownerId: profile.uid, createdAt: new Date().toISOString() };
      onCreated(group);
    } catch (e: unknown) {
      errEl.textContent = e instanceof Error ? e.message : "Failed to create group.";
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = "Create Group";
    }
  };

  document.getElementById("createGroupBtn")!.addEventListener("click", doCreate);
  (document.getElementById("groupNameInput") as HTMLInputElement).addEventListener("keydown", (e) => {
    if (e.key === "Enter") void doCreate();
  });
  setTimeout(() => (document.getElementById("groupNameInput") as HTMLInputElement).focus(), 50);
};

// ---------------------------------------------------------------------------
// Group Screen (PM main screen)
// ---------------------------------------------------------------------------

export const showGroupScreen = (
  user: User,
  profile: UserProfile,
  group: Group,
  onTeamSelected: (teamId: string, teamName: string) => void,
): void => {
  _currentUser = user;
  _currentProfile = profile;
  _onTeamSelected = onTeamSelected;
  clearContainer();

  getContainer().innerHTML = `
    <div class="screen-overlay" id="groupScreen">
      <div class="admin-layout">
        <aside class="admin-sidebar">
          <div class="admin-sidebar-brand">
            <p class="eyebrow">Group</p>
            <p class="admin-sidebar-group-name" id="groupNameDisplay">${escapeHtml(group.name)}</p>
            <button class="btn ghost small" id="editGroupNameBtn" style="margin-top:6px">Edit</button>
          </div>
          <nav class="admin-nav">
            <button class="admin-nav-item active" data-section="teams">Teams</button>
            <button class="admin-nav-item" data-section="members">Members</button>
          </nav>
          <div class="admin-sidebar-footer">
            <div class="admin-footer-user">
              <img id="groupFooterAvatar" class="member-avatar-sm" src="${escapeHtml(avatarSrc(profile, 32))}" />
              <span class="admin-footer-name" id="groupFooterName">${escapeHtml(profile.displayName)}</span>
              <button class="btn ghost small" id="groupEditProfileBtn" title="Edit profile" style="padding:3px 7px;flex-shrink:0">✎</button>
            </div>
            <button class="btn ghost small" id="groupSignOutBtn">Sign Out</button>
          </div>
        </aside>
        <main class="admin-main">
          <div class="admin-main-header">
            <h2 class="admin-section-title" id="groupSectionTitle">Teams</h2>
          </div>
          <div class="screen-error" id="groupError" hidden></div>
          <div id="groupContent" class="group-content"></div>
        </main>
      </div>
    </div>
  `;

  document.getElementById("groupSignOutBtn")!.addEventListener("click", () => signOut());

  document.getElementById("groupEditProfileBtn")!.addEventListener("click", () => {
    showProfileEditModal(profile, false, (updated) => {
      profile = updated;
      _currentProfile = updated;
      const nameEl = document.getElementById("groupFooterName");
      if (nameEl) nameEl.textContent = updated.displayName;
      const avImg = document.getElementById("groupFooterAvatar") as HTMLImageElement | null;
      if (avImg) avImg.src = avatarSrc(updated, 32);
    }, user);
  });

  document.getElementById("editGroupNameBtn")!.addEventListener("click", () => {
    showEditGroupModal(group, profile, (newName, newDisplayName) => {
      group.name = newName;
      const display = document.getElementById("groupNameDisplay");
      if (display) display.textContent = newName;
      if (newDisplayName !== profile.displayName) {
        profile.displayName = newDisplayName;
        _currentProfile = profile;
        const footerName = document.getElementById("groupFooterName");
        if (footerName) footerName.textContent = newDisplayName;
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".admin-nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll<HTMLButtonElement>(".admin-nav-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const title = document.getElementById("groupSectionTitle");
      if (title) title.textContent = btn.dataset.section === "teams" ? "Teams" : "Members";
      const errEl = document.getElementById("groupError");
      if (errEl) errEl.hidden = true;
      loadGroupSection(btn.dataset.section!, group, profile);
    });
  });

  loadGroupSection("teams", group, profile);
};

const showEditGroupModal = (group: Group, profile: UserProfile, onSaved: (newName: string, newDisplayName: string) => void): void => {
  document.getElementById("editGroupModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "editGroupModal";
  modal.className = "team-modal-overlay";
  modal.innerHTML = `
    <div class="team-modal">
      <h3>Edit</h3>
      <label class="screen-label">
        Your Name
        <input type="text" id="editPmNameInput" class="screen-input" value="${escapeHtml(profile.displayName)}" />
      </label>
      <label class="screen-label">
        Group Name
        <input type="text" id="editGroupNameInput" class="screen-input" value="${escapeHtml(group.name)}" />
      </label>
      <div class="screen-error" id="editGroupError" hidden></div>
      <div class="team-modal-footer">
        <button class="btn ghost" id="editGroupCancel">Cancel</button>
        <button class="btn" id="editGroupSave">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
  document.getElementById("editGroupCancel")!.addEventListener("click", () => modal.remove());

  const doSave = async () => {
    const groupName = (document.getElementById("editGroupNameInput") as HTMLInputElement).value.trim();
    const pmName = (document.getElementById("editPmNameInput") as HTMLInputElement).value.trim();
    const errEl = document.getElementById("editGroupError")!;
    errEl.hidden = true;
    if (!groupName) { errEl.textContent = "Group name cannot be empty."; errEl.hidden = false; return; }
    if (!pmName) { errEl.textContent = "Your name cannot be empty."; errEl.hidden = false; return; }
    try {
      const saves: Promise<void>[] = [updateGroupName(group.id, groupName)];
      if (pmName !== profile.displayName) {
        saves.push(updateUserProfile(profile.uid, { displayName: pmName } as Parameters<typeof updateUserProfile>[1]));
      }
      await Promise.all(saves);
      modal.remove();
      onSaved(groupName, pmName);
    } catch (e: unknown) {
      errEl.textContent = e instanceof Error ? e.message : "Failed to save.";
      errEl.hidden = false;
    }
  };

  document.getElementById("editGroupSave")!.addEventListener("click", doSave);
  (document.getElementById("editGroupNameInput") as HTMLInputElement).addEventListener("keydown", (e) => {
    if (e.key === "Enter") void doSave();
  });
  setTimeout(() => (document.getElementById("editPmNameInput") as HTMLInputElement).focus(), 50);
};

const loadGroupSection = (section: string, group: Group, profile: UserProfile): void => {
  const content = document.getElementById("groupContent");
  if (!content) return;
  if (section === "teams") {
    content.innerHTML = `<div id="groupTeamGrid" class="team-grid"><div class="team-card-loading">Loading teams…</div></div>`;
    void loadAndRenderGroupTeams(group, profile);
  } else {
    content.innerHTML = `<div id="groupMemberList" class="group-member-list"><em>Loading members…</em></div>`;
    void loadAndRenderGroupMembers(group, profile);
  }
};

const loadAndRenderGroupTeams = async (group: Group, profile: UserProfile): Promise<void> => {
  const grid = document.getElementById("groupTeamGrid");
  const errEl = document.getElementById("groupError");
  if (!grid) return;
  if (errEl) errEl.hidden = true;
  try {
    const teams = await getTeamsByGroup(group.id, profile.uid);
    teams.sort((a, b) => {
      const oa = a.order ?? Number.MAX_SAFE_INTEGER;
      const ob = b.order ?? Number.MAX_SAFE_INTEGER;
      return oa !== ob ? oa - ob : a.createdAt.localeCompare(b.createdAt);
    });
    const allUids = Array.from(new Set(teams.flatMap((t) => t.memberIds)));
    const memberProfiles = await getUsersByIds(allUids);
    const memberMap = new Map(memberProfiles.map((p) => [p.uid, p]));
    renderGroupTeamGrid(grid, teams, group, profile, memberMap);
  } catch (e: unknown) {
    if (errEl) {
      errEl.textContent = e instanceof Error ? e.message : "Failed to load teams.";
      errEl.hidden = false;
    }
    grid.innerHTML = "";
  }
};

const renderGroupTeamGrid = (
  grid: HTMLElement,
  teams: Team[],
  group: Group,
  profile: UserProfile,
  memberMap: Map<string, UserProfile> = new Map(),
): void => {
  grid.innerHTML = "";

  // FLIP animation: snapshot positions before a DOM change, animate to new positions after
  const flipAnimate = (snapshots: Map<HTMLElement, DOMRect>) => {
    snapshots.forEach((prev, el) => {
      if (!el.isConnected) return;
      const curr = el.getBoundingClientRect();
      const dx = prev.left - curr.left;
      const dy = prev.top - curr.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = "transform 0.18s ease";
        el.style.transform = "";
      }));
    });
  };

  for (const team of teams) {
    const card = document.createElement("button");
    card.className = "team-card";
    card.dataset.teamId = team.id;

    const MAX_SHOWN = 5;
    const memberProfs = team.memberIds
      .map((uid) => memberMap.get(uid))
      .filter((p): p is UserProfile => !!p);
    const shown = memberProfs.slice(0, MAX_SHOWN);
    const overflow = memberProfs.length - shown.length;
    const avatarRowHtml = shown.length > 0 ? `
      <div class="team-card-avatars">
        ${shown.map((p) => `<img class="team-card-avatar" src="${escapeHtml(avatarSrc(p, 28))}" title="${escapeHtml(p.displayName)}" data-uid="${p.uid}" />`).join("")}
        ${overflow > 0 ? `<div class="team-card-avatar-more">+${overflow}</div>` : ""}
      </div>
    ` : `<div class="team-card-meta">${team.memberIds.length} member${team.memberIds.length !== 1 ? "s" : ""}</div>`;

    card.innerHTML = `
      <div class="team-card-drag-handle" title="Drag to reorder">⠿</div>
      <div class="team-card-name">${escapeHtml(team.name)}</div>
      ${avatarRowHtml}
    `;
    card.addEventListener("click", () => _onTeamSelected?.(team.id, team.name));

    card.querySelectorAll<HTMLImageElement>(".team-card-avatar").forEach((img) => {
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        const uid = img.dataset.uid;
        const p = uid ? memberMap.get(uid) : undefined;
        if (p?.photoFull) showPhotoPopup(p.photoFull);
        else if (p?.photoThumb) showPhotoPopup(p.photoThumb);
        else if (p) showPhotoPopup(makeInitialAvatar(p.displayName, 200));
      });
    });

    const manageBtn = document.createElement("button");
    manageBtn.className = "btn ghost small team-manage-btn";
    manageBtn.textContent = "Manage";
    manageBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showManageMembers(team, profile, () => void loadAndRenderGroupTeams(group, profile), group.id);
    });
    card.appendChild(manageBtn);

    if (team.ownerId === profile.uid) {
      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;gap:4px;margin-top:4px";

      const renameBtn = document.createElement("button");
      renameBtn.className = "btn ghost small";
      renameBtn.textContent = "Rename";
      renameBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const newName = prompt("New team name:", team.name)?.trim();
        if (!newName || newName === team.name) return;
        const errEl = document.getElementById("groupError");
        if (errEl) errEl.hidden = true;
        try {
          await updateTeamName(team.id, newName);
          void loadAndRenderGroupTeams(group, profile);
        } catch (err: unknown) {
          if (errEl) {
            errEl.textContent = err instanceof Error ? err.message : "Failed to rename team.";
            errEl.hidden = false;
          }
        }
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn ghost small danger team-delete-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete team "${team.name}"?\n\nAll sprint data for this team will be permanently removed.`)) return;
        const errEl = document.getElementById("groupError");
        if (errEl) errEl.hidden = true;
        try {
          await deleteTeam(team.id);
          void loadAndRenderGroupTeams(group, profile);
        } catch (err: unknown) {
          if (errEl) {
            errEl.textContent = err instanceof Error ? err.message : "Failed to delete team.";
            errEl.hidden = false;
          }
        }
      });

      btnRow.appendChild(renameBtn);
      btnRow.appendChild(deleteBtn);
      card.appendChild(btnRow);
    }

    // Drag-to-reorder with real-time FLIP animation
    card.addEventListener("mousedown", (e) => {
      if (!(e.target as HTMLElement).closest(".team-card-drag-handle")) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const rect = card.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      const cardW = card.offsetWidth;
      const cardH = card.offsetHeight;

      let dragging = false;
      let floatEl: HTMLElement | null = null;
      let lastInsertKey: string | null = null;

      const realCards = () =>
        Array.from(grid.querySelectorAll<HTMLElement>(".team-card[data-team-id]"));

      const onMove = (ev: MouseEvent) => {
        if (!dragging) {
          if (Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
          dragging = true;
          floatEl = document.createElement("div");
          floatEl.className = "team-card team-card-floating";
          floatEl.innerHTML = card.innerHTML;
          floatEl.style.width = cardW + "px";
          floatEl.style.height = cardH + "px";
          document.body.appendChild(floatEl);
          card.classList.add("team-card-placeholder");
        }

        if (floatEl) {
          floatEl.style.left = (ev.clientX - offsetX) + "px";
          floatEl.style.top = (ev.clientY - offsetY) + "px";
        }

        // Find the closest other card to the float's center
        const others = realCards().filter(c => c !== card);
        if (others.length === 0) return;

        const floatCX = ev.clientX - offsetX + cardW / 2;
        const floatCY = ev.clientY - offsetY + cardH / 2;

        let closest: HTMLElement | null = null;
        let closestDist = Infinity;
        for (const c of others) {
          const r = c.getBoundingClientRect();
          const dist = Math.hypot(floatCX - (r.left + r.width / 2), floatCY - (r.top + r.height / 2));
          if (dist < closestDist) { closestDist = dist; closest = c; }
        }
        if (!closest) return;

        const cr = closest.getBoundingClientRect();
        const insertBefore = floatCY < cr.top + cr.height / 2;
        const insertKey = `${closest.dataset.teamId}-${insertBefore}`;
        if (insertKey === lastInsertKey) return;

        const insertRef = insertBefore
          ? closest
          : ((closest.nextElementSibling as HTMLElement | null) ?? grid.querySelector<HTMLElement>(".team-card-new"));
        if (insertRef === card) { lastInsertKey = insertKey; return; }

        // FLIP: snapshot other cards, move placeholder, animate
        const snap = new Map(others.map(c => [c, c.getBoundingClientRect()]));
        grid.insertBefore(card, insertRef);
        lastInsertKey = insertKey;
        flipAnimate(snap);
      };

      const onUp = async () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        floatEl?.remove();
        card.classList.remove("team-card-placeholder");
        card.style.transform = "";
        card.style.transition = "";

        if (!dragging) return;
        card.addEventListener("click", (ev) => ev.stopPropagation(), { once: true, capture: true });

        const finalOrder = realCards().map(c => c.dataset.teamId!);
        await Promise.all(finalOrder.map((id, idx) => updateTeamOrder(id, idx)));
        void loadAndRenderGroupTeams(group, profile);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    grid.appendChild(card);
  }

  const newCard = document.createElement("button");
  newCard.className = "team-card team-card-new";
  newCard.innerHTML = `<span class="team-card-new-icon">+</span><span class="team-card-name">New Team</span>`;
  newCard.addEventListener("click", () =>
    showCreateTeamForGroup(group, profile, () => void loadAndRenderGroupTeams(group, profile)),
  );
  grid.appendChild(newCard);
};

const showCreateTeamForGroup = (group: Group, profile: UserProfile, onCreated: () => void): void => {
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
      await createTeam(name, profile.uid, group.id);
      modal.remove();
      onCreated();
    } catch (e: unknown) {
      errEl.textContent = e instanceof Error ? e.message : "Failed to create team.";
      errEl.hidden = false;
    }
  };

  document.getElementById("createTeamConfirm")!.addEventListener("click", doCreate);
  (document.getElementById("newTeamName") as HTMLInputElement).addEventListener("keydown", (e) => {
    if (e.key === "Enter") void doCreate();
  });
  setTimeout(() => (document.getElementById("newTeamName") as HTMLInputElement).focus(), 50);
};

const findAssignedTasksInGroup = async (
  displayName: string,
  email: string,
  groupId: string,
  groupOwnerId?: string,
): Promise<string[]> => {
  const teams = await getTeamsByGroup(groupId, groupOwnerId);
  const found: string[] = [];
  await Promise.all(
    teams.map(async (t) => {
      const appState = await loadTeamState(t.id);
      if (!appState) return;
      found.push(...findAssignedTasksInState(displayName, email, appState, t.name || t.id));
    }),
  );
  return found;
};

const showInviteMemberModal = (group: Group, profile: UserProfile, onDone: () => void): void => {
  document.getElementById("inviteMemberModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "inviteMemberModal";
  modal.className = "team-modal-overlay";
  modal.innerHTML = `
    <div class="team-modal">
      <h3>Invite Member to Group</h3>
      <p class="pref-hint">Enter the email address of the person you want to invite to <strong>${escapeHtml(group.name)}</strong>.</p>
      <input type="email" id="groupInviteEmail" class="screen-input" placeholder="invitee@example.com" />
      <div class="screen-error" id="groupInviteError" hidden></div>
      <div class="screen-success" id="groupInviteSuccess" hidden></div>
      <div class="team-modal-footer">
        <button class="btn ghost" id="groupInviteCancel">Cancel</button>
        <button class="btn" id="groupInviteConfirm">Send Invitation</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => { if (e.target === modal) { modal.remove(); onDone(); } });
  document.getElementById("groupInviteCancel")!.addEventListener("click", () => { modal.remove(); onDone(); });

  const doInvite = async () => {
    const email = (document.getElementById("groupInviteEmail") as HTMLInputElement).value.trim();
    const errEl = document.getElementById("groupInviteError")!;
    const successEl = document.getElementById("groupInviteSuccess")!;
    errEl.hidden = true;
    successEl.hidden = true;
    if (!email) {
      errEl.textContent = "Please enter an email address.";
      errEl.hidden = false;
      return;
    }
    const confirmBtn = document.getElementById("groupInviteConfirm") as HTMLButtonElement;
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Sending…";
    let inviteId: string | null = null;
    try {
      const now = new Date();
      const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      inviteId = await createInvitation({
        email,
        groupId: group.id,
        teamIds: [],
        invitedBy: profile.uid,
        status: "pending",
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
      });
      const sendEmail = httpsCallable(functions, "sendInvitationEmail");
      await sendEmail({ inviteId });
      successEl.textContent = `Invitation sent to ${email}.`;
      successEl.hidden = false;
      (document.getElementById("groupInviteEmail") as HTMLInputElement).value = "";
    } catch (e: unknown) {
      // Email failed — cancel the orphaned invitation doc so it doesn't linger
      if (inviteId) void updateInvitation(inviteId, { status: "cancelled" });
      errEl.textContent = e instanceof Error ? e.message : "Failed to send invitation.";
      errEl.hidden = false;
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Send Invitation";
    }
  };

  document.getElementById("groupInviteConfirm")!.addEventListener("click", doInvite);
  (document.getElementById("groupInviteEmail") as HTMLInputElement).addEventListener("keydown", (e) => {
    if (e.key === "Enter") void doInvite();
  });
  setTimeout(() => (document.getElementById("groupInviteEmail") as HTMLInputElement).focus(), 50);
};

const loadAndRenderGroupMembers = async (group: Group, profile: UserProfile): Promise<void> => {
  const listEl = document.getElementById("groupMemberList");
  const errEl = document.getElementById("groupError");
  if (!listEl) return;
  if (errEl) errEl.hidden = true;
  try {
    const members = await getGroupMemberProfiles(group.id);
    renderGroupMemberList(listEl, members, group, profile);
  } catch (e: unknown) {
    if (errEl) {
      errEl.textContent = e instanceof Error ? e.message : "Failed to load members.";
      errEl.hidden = false;
    }
    listEl.innerHTML = "<em>Failed to load members.</em>";
  }
};

const renderGroupMemberList = (
  listEl: HTMLElement,
  members: UserProfile[],
  group: Group,
  profile: UserProfile,
): void => {
  listEl.innerHTML = "";

  const toolbar = document.createElement("div");
  toolbar.className = "group-member-toolbar";
  toolbar.innerHTML = `<button class="btn" id="groupInviteMemberBtn">+ Invite Member</button>`;
  listEl.appendChild(toolbar);
  document.getElementById("groupInviteMemberBtn")!.addEventListener("click", () => {
    showInviteMemberModal(group, profile, () => void loadAndRenderGroupMembers(group, profile));
  });

  if (members.length === 0) {
    const empty = document.createElement("p");
    empty.className = "pref-hint";
    empty.textContent = "No members in this group yet.";
    listEl.appendChild(empty);
    return;
  }

  for (const member of members) {
    const isOwner = member.uid === profile.uid;
    const row = document.createElement("div");
    row.className = "manage-member-row";
    row.innerHTML = `
      <img class="member-avatar-sm" src="${escapeHtml(avatarSrc(member, 32))}" title="${escapeHtml(member.displayName)}" />
      <div class="manage-member-info">
        <div class="manage-member-name-row">
          <span class="member-name">${escapeHtml(member.displayName)}</span>
          ${isOwner ? '<span class="member-role-badge">Owner</span>' : ""}
        </div>
        <span class="member-email">${escapeHtml(member.email)}</span>
        ${member.phoneNumber ? `<span class="member-phone">${escapeHtml(member.phoneNumber)}</span>` : ""}
      </div>
      ${!isOwner ? `
        <button class="btn ghost small danger group-member-remove-btn"
          data-uid="${member.uid}"
          data-name="${escapeHtml(member.displayName)}"
          data-email="${escapeHtml(member.email)}">
          Remove
        </button>
      ` : ""}
    `;
    // Click avatar to view full photo
    const img = row.querySelector<HTMLImageElement>(".member-avatar-sm")!;
    img.addEventListener("click", () => {
      if (member.photoFull) showPhotoPopup(member.photoFull);
      else if (member.photoThumb) showPhotoPopup(member.photoThumb);
      else showPhotoPopup(makeInitialAvatar(member.displayName, 200));
    });
    img.style.cursor = "pointer";
    listEl.appendChild(row);
  }

  listEl.querySelectorAll<HTMLButtonElement>(".group-member-remove-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.uid!;
      const displayName = btn.dataset.name!;
      const email = btn.dataset.email!;
      const errEl = document.getElementById("groupError");
      if (errEl) errEl.hidden = true;

      btn.disabled = true;
      const prevText = btn.textContent;
      btn.textContent = "Checking…";
      let assigned: string[] = [];
      try {
        assigned = await findAssignedTasksInGroup(displayName, email, group.id, group.ownerId);
      } finally {
        btn.disabled = false;
        btn.textContent = prevText;
      }

      if (assigned.length > 0) {
        const preview = assigned.slice(0, 3).join(", ");
        const more = assigned.length > 3 ? ` … and ${assigned.length - 3} more` : "";
        if (errEl) {
          errEl.textContent = `Cannot remove ${displayName}: assigned to ${assigned.length} task(s) — ${preview}${more}. Unassign first.`;
          errEl.hidden = false;
        }
        return;
      }

      if (!confirm(`Remove ${displayName} from this group?\n\nThey will also be removed from all teams within the group.`)) return;

      try {
        await removeGroupMember(group.id, uid, displayName, group.ownerId);
        void loadAndRenderGroupMembers(group, profile);
      } catch (e: unknown) {
        if (errEl) {
          errEl.textContent = e instanceof Error ? e.message : "Failed to remove member.";
          errEl.hidden = false;
        }
      }
    });
  });
};
