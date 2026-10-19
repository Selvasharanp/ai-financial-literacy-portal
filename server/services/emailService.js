/**
 * Email Service — wraps Nodemailer with env-var SMTP configuration.
 * If not configured, invitation creation still works; the raw invite
 * link is logged to the server console for development testing.
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;
    if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
        return null;
    }

    transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: Number(EMAIL_PORT) || 587,
        secure: Number(EMAIL_PORT) === 465,
        auth: { user: EMAIL_USER, pass: EMAIL_PASS }
    });

    return transporter;
}

/**
 * Send a trip invitation email.
 * @param {object} opts
 * @param {string} opts.to             - recipient email address
 * @param {string} opts.recipientName  - invitee display name
 * @param {string} opts.tripName       - name of the trip
 * @param {string} opts.creatorName    - name of the person who sent the invite
 * @param {string} opts.acceptUrl      - full URL to accept the invitation
 * @param {string} opts.declineUrl     - full URL to decline the invitation
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendInvitationEmail({ to, recipientName, tripName, creatorName, acceptUrl, declineUrl }) {
    const transport = getTransporter();
    if (!transport) {
        console.warn('[EmailService] Email not configured. Invitation link for development:');
        console.warn(`  ACCEPT:  ${acceptUrl}`);
        console.warn(`  DECLINE: ${declineUrl}`);
        return { sent: false, reason: 'Email provider not configured. Set EMAIL_HOST, EMAIL_USER and EMAIL_PASS in server/.env.' };
    }

    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:32px;">
  <div style="max-width:520px;margin:auto;background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
    <div style="text-align:center;margin-bottom:24px">
      <h1 style="color:#183630;font-size:24px;margin:0">FinWise Trip Splitter</h1>
    </div>
    <h2 style="color:#1a1a1a;font-size:18px">Hi ${recipientName},</h2>
    <p style="color:#444">
      <strong>${creatorName}</strong> has invited you to join the trip
      <strong>"${tripName}"</strong> on FinWise and start splitting expenses together.
    </p>
    <div style="margin:28px 0;text-align:center">
      <a href="${acceptUrl}" style="display:inline-block;background:#183630;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">
        ✅ Accept Invitation
      </a>
    </div>
    <p style="color:#666;font-size:13px;text-align:center">
      Don't want to join? <a href="${declineUrl}" style="color:#777">Decline this invitation</a>.
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
    <p style="color:#999;font-size:12px;text-align:center">
      This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.
    </p>
  </div>
</body>
</html>`;

    try {
        await transport.sendMail({
            from,
            to,
            subject: `${creatorName} invited you to "${tripName}" on FinWise`,
            html
        });
        return { sent: true };
    } catch (err) {
        console.error('[EmailService] Send failed:', err.message);
        return { sent: false, reason: err.message };
    }
}

module.exports = { sendInvitationEmail };
