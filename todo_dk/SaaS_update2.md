# SaaS-like update step 2

purpose: will make the BS(Burndown Studio) more SaaS like.
This is Step 2 update

## User/Membership Management

### User Levels (Already Incorporated)

- SM(Super Manager): The manager of BS. Currently only one, dkyoon@gmail.com
- PM(Product Manager): Manager of a Group. SM authorizes.
- Members: All other users. Can belong to multiple Groups.

### How to register as a user of BS and to become a member
- The only way to become a member of a group is only by invitation from PM.
- PM invites member with email then the email is sent to the invitee with two options to choose in the mail body. Accept or decline. If the invitee clicks decline, PM is notified and the pending status for the invitee is cleared as nothing happend. If the invitee clicks accept there are two cases.
	- The invitee is not a registered user of BS: User registration process pops up in the modal dialog box. Name and other profile information will be filled and when done, the invitee is registered as BS user and at the same time becomes a member of the group. There is also an option to register with Google Id other than email.
    - The invitee is already a member of other group, i.e. already a registered user of BS (BS should know): No need for registration process. Just becomes the member of the Group.

### How to become a PM

- This is very analogous to register as a tenent in SaaS.
- On the BS main landing page there is a menu to click to request for PM.
- By clicking this request for PM menu, a new dialogue box pops up, and there PM applicant fill in the registration form. Name of the group, organization, brief explanation of the group (such as purpose or else), and the normal registration infromation. There is also an option to register with Google Id.
 this new must create a Group. Only one Group. PM cannot manage only one group.
- This request in shown in SM's adminstration page, and there SM can approve or reject. 
- Once approved the PM applicant is notifed the approval via email and then PM can login as a PM. After login PM, PM sees regualr PM page where PM can manage teams and members.

### the landing page

Now we need a landing page with the following contents.
- The banner (not to big) with an title of the service and some grahpical brand images.
- Login menu with a small description like "Already a user?" Two login option.
    - Email login
	- Login with Google
- Request for PM menu: When clicked the above "How to become a PM" process starts.
- There will be many other stuff such as manual etc. But this will later be added. It will be nice AI can make a nice little introduction for BS.

### Implementation Note

---

#### 0. Prerequisites — Firebase Console Cleanup (Manual, One-Time)

Before any code changes, clean the Firebase project manually:

- In **Firebase Console → Authentication**: delete all test accounts except `dkyoon@gmail.com`. Enable **Email/Password** provider (disable Email Link / passwordless provider — not used).
- In **Firestore**: delete all documents in `users/`, `teams/`, `groups/`, `appdata/` except the `users/{dkyoon uid}` document (keep its `role: "super_manager"`).
- In **Firebase Console → Functions**: enable the Cloud Functions billing plan (Blaze). Functions are required for email sending.
- Choose an email provider: **SendGrid** (recommended for production, free tier 100/day) or Gmail via Nodemailer (simpler for testing). Store the API key in Firebase Functions config or Secret Manager.

**Do this cleanup yourself in the Firebase Console UI — do not script or delegate it.** It is destructive and irreversible (deleted users and Firestore documents cannot be recovered). The Console gives you visual confirmation of exactly what you are deleting before you delete it, and you can directly verify that `dkyoon@gmail.com` and its `role: "super_manager"` field are intact before closing.

---

#### 1. New Firestore Collections and Types (`types.ts`, `db.ts`)

Two new top-level Firestore collections are needed.

**`invitations/{inviteId}`** — PM-sent member invitations:
```
email: string          // invitee's email address
groupId: string        // the PM's group
teamIds: string[]      // which teams to add to (can be empty initially)
invitedBy: string      // PM's uid
status: "pending" | "accepted" | "declined"
createdAt: string      // ISO timestamp
expiresAt: string      // ISO timestamp (7 days later)
```

**`pm_requests/{requestId}`** — PM applicant registration requests:
```
email: string          // applicant's email
displayName: string    // applicant's name
groupName: string      // desired group name
organization: string   // org/company name
description: string    // brief purpose of the group
status: "pending" | "approved" | "rejected"
createdAt: string
reviewedBy?: string    // SM's uid (set when reviewed)
reviewedAt?: string
```

Add corresponding TypeScript interfaces to `types.ts`. Add CRUD functions to `db.ts`:
- `createInvitation(inv)` → write to `invitations/`
- `getInvitation(inviteId)` → read single doc
- `updateInvitation(inviteId, updates)` → update status
- `getInvitationsByGroup(groupId)` → list for PM's group
- `createPmRequest(req)` → write to `pm_requests/`
- `getAllPmRequests()` → SM admin fetch
- `updatePmRequest(requestId, updates)` → approve / reject

---

#### 2. Firebase Cloud Functions (`functions/` directory)

Create a new `functions/` directory at the project root (standard Firebase Functions layout). Initialize with `firebase init functions` (TypeScript). Install `nodemailer` (or `@sendgrid/mail`) and `firebase-admin`.

Three functions are needed:

**`sendInvitationEmail(inviteId)`** — HTTP-callable or Firestore-triggered:
- Reads the `invitations/{inviteId}` doc.
- Sends an email to `invitation.email` with two links:
  - `https://burndown.studio/?invite={inviteId}&action=accept`
  - `https://burndown.studio/?invite={inviteId}&action=decline`
- Triggered by PM's UI action (callable function is simplest: `httpsCallable(functions, "sendInvitationEmail")`).

**`declineInvitation(inviteId)`** — HTTP-callable (no auth required, called from URL handler):
- Marks `invitations/{inviteId}.status = "declined"`.
- Sends a notification email to the PM (`invitation.invitedBy` → look up PM email from `users/`).
- This function must accept unauthenticated calls (or use a signed URL so no auth is needed).

**`sendPmApprovalEmail(requestId)`** — called by SM after approving a PM request:
- Reads `pm_requests/{requestId}`.
- Sends email to `request.email` with a link: `https://burndown.studio/?pm_approved={requestId}`.
- The link lets the applicant complete registration and get set up as PM.

All three functions are in `functions/src/index.ts`. Deploy with `firebase deploy --only functions`.

---

#### 3. Landing Page (replaces current login overlay)

The current `showLoginScreen()` in `screens.ts` is a minimal overlay. Replace it with a proper landing page. Keep the SPA structure — the landing page is still shown as a full-page overlay inside `#screen-overlays` (same as now). No separate HTML file needed.

The new `showLandingPage()` function in `screens.ts` renders:

```
┌─────────────────────────────────────────┐
│  [Logo / Brand SVG or CSS art]          │
│  Burndown Studio                        │
│  "Sprint burndown tracking for teams"   │
│─────────────────────────────────────────│
│  Already a user?                        │
│  Email:    [___________]                │
│  Password: [___________]                │
│  [Sign In]                              │
│       — or —                            │
│  [Sign in with Google]                  │
│─────────────────────────────────────────│
│  Want to bring your team?               │
│  [Request PM Account]  ← new flow      │
└─────────────────────────────────────────┘
```

There is **no "Create Account" button** on the landing page. Account creation only happens through two controlled flows:
- **Member account**: created during invitation acceptance (PM invites → invitee accepts).
- **PM account**: created during PM approval flow (applicant requests → SM approves → applicant registers via approval email link).

Replace all calls to `showLoginScreen()` in `main.ts` and `screens.ts` with `showLandingPage()`.

The "Sign in with Email" path uses Firebase `signInWithEmailAndPassword()`. The "Sign in with Google" path uses the existing `signInWithGoogle()`.

Remove `signInWithFakeEmail()` from `auth.ts`. No new auth functions are needed — `signInWithEmailAndPassword()` and `createUserWithEmailAndPassword()` are already imported. `createUserWithEmailAndPassword()` is called only inside the invitation acceptance flow, never from the sign-in form.

---

#### 4. URL Parameter Handling at Startup (`main.ts`)

On every page load, before showing the landing page or triggering auth, check URL parameters. At the very top of the auth gate block in `main.ts`:

```typescript
const params = new URLSearchParams(window.location.search);
const inviteId = params.get("invite");
const inviteAction = params.get("action");       // "accept" or "decline"
const pmApprovedId = params.get("pm_approved");  // PM registration link

// Also handle Firebase email link sign-in (passwordless)
if (auth.isSignInWithEmailLink(window.location.href)) {
  // complete the email sign-in flow (see auth.ts)
}
```

**Decline path** (no auth needed):
- If `inviteId` + `action=decline` → call `declineInvitation` Cloud Function, then show a simple "Invitation declined" message. No login required.

**Accept path** (auth required):
- Store `inviteId` in `sessionStorage` (survives the login redirect).
- Show the landing page with a banner: "You've been invited to join a team — sign in to accept."
- After auth completes, read `inviteId` from `sessionStorage` and process:
  - Fetch the invitation doc.
  - If accepted already: skip.
  - If user has no profile: run the normal register flow, then accept.
  - After profile is confirmed: set `invitation.status = "accepted"`, add user to the group (`user.groupId = invitation.groupId`), and add to each team in `invitation.teamIds`.
  - Route user to `showTeamScreen()`.

**PM Approved path** (`pm_approved=requestId`):
- Store `requestId` in `sessionStorage`.
- Show landing page with banner: "Your PM account has been approved — register to continue."
- After auth, read `requestId` from `sessionStorage`:
  - Fetch `pm_requests/{requestId}`, confirm status is "approved" and email matches.
  - If user profile doesn't exist: create it with `role: "product_manager"`.
  - If profile exists but is "member": upgrade to `role: "product_manager"`.
  - Create the group using `groupName` from the pm_request (`createGroup()`).
  - Route to `showGroupScreen()`.

Clean the URL after processing (`window.history.replaceState({}, "", "/")`) to avoid re-processing on refresh.

---

#### 5. PM Invitation Flow — Replace Add-by-Email in `screens.ts`

Currently `showManageMembers()` has an "Add Member" input that calls `addMemberToTeam()` — it requires the user to already exist in Firestore. Replace this with the invitation flow:

- Rename the input label to "Invite by email".
- On submit: call `createInvitation()` to write the `invitations/` doc, then call the `sendInvitationEmail` Cloud Function via `httpsCallable()`.
- Show a confirmation: "Invitation sent to `{email}`."
- Optionally show a list of pending invitations for this group (fetch `getInvitationsByGroup(groupId)`).

The `addMemberToTeam()` / `addMemberToTeamWithPrefs()` functions in `db.ts` remain for when the invitation is accepted (called inside the accept URL handler).

---

#### 6. PM Request Flow — New UI in `screens.ts`

Add `showPmRequestForm()` to `screens.ts`. This modal is triggered by "Request PM Account" on the landing page. It collects:

- Display name (text input)
- Email (text input)
- Group / organization name (text input)
- Brief description of the group (textarea)

On submit: call `createPmRequest()` to write the doc. Show a confirmation: "Your request has been sent. We'll notify you by email when it's reviewed."

No Firebase Auth required to submit a PM request — the form just writes to Firestore. Firestore security rules for `pm_requests` must allow unauthenticated writes (with rate-limiting via rules if desired).

---

#### 7. SM Admin Screen — New "Requests" Tab (`screens.ts`)

Add a third tab "Requests" to `showAdminScreen()` alongside the existing "Users" and "Groups" tabs.

`loadAdminRequests()` fetches all `pm_requests` docs (sorted: pending first, then by `createdAt` desc) and renders a table:

| Email | Name | Group Name | Organization | Status | Action |
|---|---|---|---|---|---|
| user@x.com | Alice | Alice's Group | Acme Corp | pending | [Approve] [Reject] |

- **Approve**: call `updatePmRequest(id, { status: "approved", reviewedBy: sm.uid, reviewedAt: now })`, then call `sendPmApprovalEmail` Cloud Function.
- **Reject**: call `updatePmRequest(id, { status: "rejected", ... })`. Optionally send a rejection email (add a fourth Cloud Function or reuse `sendPmApprovalEmail` with a flag).

---

#### 8. Firebase Hosting Config (`firebase.json`)

Ensure all paths route to `index.html` so that `?invite=...` and `?pm_approved=...` links work when opened fresh:

```json
{
  "hosting": {
    "public": ".",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**", "src/**", "functions/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

---

#### 9. Firestore Security Rules — New Collections

Add rules for the two new collections:

```
match /invitations/{id} {
  allow read: if request.auth != null;   // needed for accept flow
  allow create: if isProductManager();   // only PM can invite
  allow update: if request.auth != null; // accept/decline by invitee
}

match /pm_requests/{id} {
  allow create: if true;                 // unauthenticated (public form)
  allow read, update: if isSuperManager(); // SM only
}
```

---

#### 10. Implementation Order (Sessions)

| Session | Work |
|---|---|
| A | Firebase Console cleanup + enable Functions billing + email provider setup |
| B | `types.ts` new interfaces + `db.ts` CRUD for invitations and pm_requests |
| C | Cloud Functions skeleton (`functions/`), deploy `sendInvitationEmail` + `declineInvitation` |
| D | Landing page (`showLandingPage()` in `screens.ts`), remove fake email, add email link sign-in to `auth.ts` |
| E | URL parameter handling in `main.ts` (invite accept/decline + pm_approved) |
| F | PM invitation UI: update `showManageMembers()` to send invitation instead of add-by-email |
| G | PM Request form (`showPmRequestForm()`), SM admin "Requests" tab, `sendPmApprovalEmail` function |
| H | Firestore rules for new collections, end-to-end testing |
| I | Firebase Hosting `firebase.json` rewrites, final deploy, smoke test full flows |

---

#### 11. Summary of File Changes

| File | Change |
|---|---|
| `types.ts` | Add `Invitation`, `PmRequest` interfaces |
| `db.ts` | Add CRUD for `invitations/` and `pm_requests/` |
| `auth.ts` | Remove `signInWithFakeEmail`; add `sendEmailSignInLink()`, `completeEmailSignIn()` |
| `screens.ts` | Replace `showLoginScreen()` with `showLandingPage()`; add `showPmRequestForm()`; update `showManageMembers()` invitation UI; add Requests tab in `showAdminScreen()` |
| `main.ts` | Add URL param handler block at startup; update all `showLoginScreen()` calls |
| `functions/src/index.ts` | New: Cloud Functions for email sending |
| `firebase.json` | Add hosting rewrites + functions config |
| Firestore rules | Add rules for `invitations/` and `pm_requests/` |











