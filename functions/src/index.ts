import * as admin from "firebase-admin";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as nodemailer from "nodemailer";

admin.initializeApp();

const db = admin.firestore();

const GMAIL_USER = "burndownstudio.notify@gmail.com";
const APP_URL = "https://burndown-studio.web.app";
const REGION = "asia-northeast3";

const gmailPassword = defineSecret("GMAIL_APP_PASSWORD");

const createTransport = (password: string) =>
  nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: password },
  });

// ---------------------------------------------------------------------------
// sendInvitationEmail — called by PM after creating an invitation doc
// ---------------------------------------------------------------------------

export const sendInvitationEmail = onCall(
  { secrets: [gmailPassword], region: REGION },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { inviteId } = request.data as { inviteId: string };
    if (!inviteId) throw new HttpsError("invalid-argument", "inviteId required.");

    const snap = await db.collection("invitations").doc(inviteId).get();
    if (!snap.exists) throw new HttpsError("not-found", "Invitation not found.");

    const invite = snap.data()!;
    const acceptUrl = `${APP_URL}/?invite=${inviteId}&action=accept`;
    const declineUrl = `${APP_URL}/?invite=${inviteId}&action=decline`;

    const transporter = createTransport(gmailPassword.value());
    await transporter.sendMail({
      from: `"Burndown Studio" <${GMAIL_USER}>`,
      to: invite.email as string,
      subject: "You've been invited to join a team on Burndown Studio",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#1e293b;">You've been invited!</h2>
          <p>You've been invited to join a team on <strong>Burndown Studio</strong>, a sprint burndown tracking tool.</p>
          <p>Please choose one of the options below:</p>
          <p style="margin:24px 0;">
            <a href="${acceptUrl}"
               style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;
                      text-decoration:none;display:inline-block;margin-right:12px;font-weight:600;">
              Accept Invitation
            </a>
            <a href="${declineUrl}"
               style="background:#6b7280;color:#fff;padding:12px 24px;border-radius:6px;
                      text-decoration:none;display:inline-block;font-weight:600;">
              Decline
            </a>
          </p>
          <p style="color:#94a3b8;font-size:12px;">
            This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.
          </p>
        </div>
      `,
    });

    return { success: true };
  },
);

// ---------------------------------------------------------------------------
// acceptInvitation — called by the invitee after authenticating.
// Runs with Admin SDK to bypass Firestore security rules (a regular member
// cannot update team.memberIds directly).
// Atomically: marks invitation accepted, sets user groupId, adds to team(s).
// Returns the first teamId + teamName so the client can navigate directly.
// ---------------------------------------------------------------------------

export const acceptInvitation = onCall(
  { region: REGION },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { inviteId } = request.data as { inviteId: string };
    if (!inviteId) throw new HttpsError("invalid-argument", "inviteId required.");

    const inviteRef = db.collection("invitations").doc(inviteId);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) throw new HttpsError("not-found", "Invitation not found.");

    const invitation = inviteSnap.data()!;

    if (invitation.status !== "pending") {
      throw new HttpsError("failed-precondition", "Invitation is no longer pending.");
    }
    if (invitation.email !== request.auth.token.email) {
      throw new HttpsError("permission-denied", "Invitation email does not match signed-in account.");
    }

    const uid = request.auth.uid;
    const groupId = invitation.groupId as string;
    const teamIds = (invitation.teamIds as string[]) ?? [];

    // All writes via Admin SDK — bypasses Firestore client security rules
    const batch = db.batch();

    // Mark invitation accepted
    batch.update(inviteRef, { status: "accepted" });

    // Set user's groupId
    batch.update(db.collection("users").doc(uid), { groupId });

    // Add user to each team's memberIds
    for (const teamId of teamIds) {
      batch.update(db.collection("teams").doc(teamId), {
        memberIds: admin.firestore.FieldValue.arrayUnion(uid),
      });
    }

    await batch.commit();

    // Return first team info for direct navigation
    if (teamIds.length === 1) {
      const teamSnap = await db.collection("teams").doc(teamIds[0]).get();
      if (teamSnap.exists) {
        return { teamId: teamIds[0], teamName: (teamSnap.data()!.name as string) ?? "" };
      }
    }

    return { teamId: null, teamName: null };
  },
);

// ---------------------------------------------------------------------------
// declineInvitation — public HTTP endpoint, called from the frontend when the
// user lands on /?invite=xxx&action=decline (no auth required)
// ---------------------------------------------------------------------------

export const declineInvitation = onRequest(
  { secrets: [gmailPassword], region: REGION },
  async (req, res) => {
    // CORS — allow any origin since this is a public, unauthenticated endpoint
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const { inviteId } = req.body as { inviteId?: string };
    if (!inviteId) {
      res.status(400).json({ error: "inviteId required." });
      return;
    }

    const inviteRef = db.collection("invitations").doc(inviteId);
    const snap = await inviteRef.get();
    if (!snap.exists) {
      res.status(404).json({ error: "Invitation not found." });
      return;
    }

    const invite = snap.data()!;

    // Idempotent — already processed
    if (invite.status !== "pending") {
      res.json({ success: true, message: "Already processed." });
      return;
    }

    await inviteRef.update({ status: "declined" });

    // Notify the PM
    const pmSnap = await db.collection("users").doc(invite.invitedBy as string).get();
    if (pmSnap.exists) {
      const pm = pmSnap.data()!;
      const transporter = createTransport(gmailPassword.value());
      await transporter.sendMail({
        from: `"Burndown Studio" <${GMAIL_USER}>`,
        to: pm.email as string,
        subject: "Team invitation declined",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
            <p><strong>${invite.email as string}</strong> has declined your team invitation on Burndown Studio.</p>
          </div>
        `,
      });
    }

    res.json({ success: true });
  },
);

// ---------------------------------------------------------------------------
// sendPmApprovalEmail — called by SM after approving a PM request
// ---------------------------------------------------------------------------

export const sendPmApprovalEmail = onCall(
  { secrets: [gmailPassword], region: REGION },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { requestId } = request.data as { requestId: string };
    if (!requestId) throw new HttpsError("invalid-argument", "requestId required.");

    const snap = await db.collection("pm_requests").doc(requestId).get();
    if (!snap.exists) throw new HttpsError("not-found", "PM request not found.");

    const pmReq = snap.data()!;
    const approvalUrl = `${APP_URL}/?pm_approved=${requestId}`;

    const transporter = createTransport(gmailPassword.value());
    await transporter.sendMail({
      from: `"Burndown Studio" <${GMAIL_USER}>`,
      to: pmReq.email as string,
      subject: "Your PM account on Burndown Studio has been approved!",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#1e293b;">Welcome to Burndown Studio!</h2>
          <p>Hi <strong>${pmReq.displayName as string}</strong>,</p>
          <p>
            Your request to become a Product Manager on <strong>Burndown Studio</strong>
            has been approved.
          </p>
          <p>
            Click below to complete your registration and set up your team
            "<strong>${pmReq.groupName as string}</strong>":
          </p>
          <p style="margin:24px 0;">
            <a href="${approvalUrl}"
               style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;
                      text-decoration:none;display:inline-block;font-weight:600;">
              Complete Registration
            </a>
          </p>
          <p style="color:#94a3b8;font-size:12px;">
            This link expires in 7 days. If you did not request a PM account, please ignore this email.
          </p>
        </div>
      `,
    });

    return { success: true };
  },
);
