/**
 * Invitation Controller — secure, token-based trip invitations.
 *
 * Security properties:
 *  - Raw token is generated server-side with crypto.randomBytes(32), never stored
 *  - Only SHA-256 hash is persisted in the database
 *  - Invitation is bound to the RECIPIENT USER ID (not email or URL param alone)
 *  - Acceptance checks: authenticated + is the right recipient + token valid + not expired
 *  - Rate limiting is applied at the route level
 */

const crypto = require('crypto');
const Trip = require('../models/Trip');
const TripMember = require('../models/TripMember');
const TripInvitation = require('../models/TripInvitation');
const User = require('../models/User');
const { sendInvitationEmail } = require('../services/emailService');

const INVITE_EXPIRY_DAYS = 7;
const MAX_RESENDS_PER_INVITE = 3;

// ---------------------------------------------------------------------------
// Helper: build the accept/decline URLs
// ---------------------------------------------------------------------------
function buildInvitationUrls(rawToken) {
    const base = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    return {
        acceptUrl: `${base}/trip-splitter/invite/${rawToken}?action=accept`,
        declineUrl: `${base}/trip-splitter/invite/${rawToken}?action=decline`
    };
}

// ---------------------------------------------------------------------------
// POST /api/auth/lookup-email
// Check if an email is registered and has a FinWise account.
// Returns whether email exists and whether email is verified (all accounts are
// considered verified since the app has no separate email verification flow).
// Does NOT expose the user list.
// ---------------------------------------------------------------------------
exports.lookupEmail = async (req, res) => {
    try {
        const { email, tripId } = req.body;
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'Email is required.' });
        }
        const normalized = email.trim().toLowerCase();

        // Basic format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalized)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        const user = await User.findOne({ email: normalized }).select('_id name email isVerified');

        if (!user) {
            return res.json({
                exists: false,
                verified: false,
                canInvite: false,
                message: "This email is not registered with FinWise yet. Ask your friend to create an account and verify their email before inviting them."
            });
        }

        // Email verification check
        if (user.isVerified === false) {
            return res.json({
                exists: true,
                verified: false,
                canInvite: false,
                name: user.name,
                message: "This account has not verified their email yet. Ask your friend to verify their email before receiving a trip invitation."
            });
        }

        const isSelf = user._id.toString() === req.user.id;
        if (isSelf) {
            return res.json({
                exists: true,
                verified: true,
                isSelf: true,
                canInvite: false,
                name: user.name,
                userId: user._id,
                message: "You cannot invite yourself to your own trip."
            });
        }

        // If tripId is provided, check membership and pending invitation status
        if (tripId) {
            const existingMember = await TripMember.findOne({ tripId, userId: user._id });
            if (existingMember) {
                return res.json({
                    exists: true,
                    verified: true,
                    isMember: true,
                    canInvite: false,
                    name: user.name,
                    userId: user._id,
                    message: `${user.name} is already a member of this trip.`
                });
            }

            const existingInvite = await TripInvitation.findOne({
                tripId,
                recipientUserId: user._id,
                status: 'pending',
                expiresAt: { $gt: new Date() }
            });
            if (existingInvite) {
                return res.json({
                    exists: true,
                    verified: true,
                    isPending: true,
                    canInvite: false,
                    invitationId: existingInvite._id,
                    name: user.name,
                    userId: user._id,
                    message: `A pending invitation already exists for ${user.name}.`
                });
            }
        }

        return res.json({
            exists: true,
            verified: true,
            canInvite: true,
            name: user.name,
            userId: user._id,
            message: `Found registered user: ${user.name}`
        });
    } catch (err) {
        console.error('[lookupEmail]', err);
        res.status(500).json({ error: 'Server Error looking up email.' });
    }
};

// ---------------------------------------------------------------------------
// POST /api/trips/:id/invitations
// Creator invites a registered, verified user to the trip.
// ---------------------------------------------------------------------------
exports.sendInvitation = async (req, res) => {
    try {
        const trip = req.trip; // set by requireTripCreator middleware
        const { recipientUserId } = req.body;

        if (!recipientUserId) {
            return res.status(400).json({ error: 'recipientUserId is required.' });
        }

        // Prevent self-invite
        if (recipientUserId.toString() === req.user.id) {
            return res.status(400).json({ error: 'You cannot invite yourself.' });
        }

        // Confirm recipient exists
        const recipient = await User.findById(recipientUserId).select('_id name email isVerified');
        if (!recipient) {
            return res.status(404).json({ error: 'This email is not registered with FinWise yet. Ask your friend to create an account and verify their email before inviting them.' });
        }

        // Check if recipient account email is verified
        if (recipient.isVerified === false) {
            return res.status(400).json({ error: 'This account has not verified their email yet. Ask your friend to verify their email before receiving a trip invitation.' });
        }

        // Check: recipient is not already an accepted member
        const existingMember = await TripMember.findOne({ tripId: trip._id, userId: recipientUserId });
        if (existingMember) {
            return res.status(409).json({ error: `${recipient.name} is already a member of this trip.` });
        }

        // Check: no pending invitation already exists
        const existingInvite = await TripInvitation.findOne({
            tripId: trip._id,
            recipientUserId,
            status: 'pending',
            expiresAt: { $gt: new Date() }
        });
        if (existingInvite) {
            return res.status(409).json({ error: `A pending invitation already exists for ${recipient.name}.` });
        }

        // Generate secure token
        const { raw, hash } = TripInvitation.generateToken();

        // Add a participant slot to the trip for this invitee (with a unique string id)
        const participantId = `invited_${recipientUserId.toString()}`;
        const alreadyHasSlot = trip.participants.some(p => p.id === participantId);
        if (!alreadyHasSlot) {
            trip.participants.push({ id: participantId, name: recipient.name, email: recipient.email });
            await trip.save();
        }

        // Create invitation record
        const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
        const invitation = new TripInvitation({
            tripId: trip._id,
            createdByUserId: req.user.id,
            recipientUserId,
            participantId,
            tokenHash: hash,
            expiresAt,
            status: 'pending'
        });

        // Send email (best-effort)
        const creator = await User.findById(req.user.id).select('name');
        const { acceptUrl, declineUrl } = buildInvitationUrls(raw);
        const emailResult = await sendInvitationEmail({
            to: recipient.email,
            recipientName: recipient.name,
            tripName: trip.name,
            creatorName: creator.name,
            acceptUrl,
            declineUrl
        });

        invitation.emailSent = emailResult.sent;
        invitation.lastEmailSentAt = new Date();
        await invitation.save();

        const responsePayload = {
            invitation: {
                _id: invitation._id,
                status: invitation.status,
                expiresAt: invitation.expiresAt,
                participantId,
                recipientName: recipient.name,
                recipientEmail: recipient.email
            },
            emailSent: emailResult.sent,
            emailNote: emailResult.sent
                ? null
                : (emailResult.reason || 'Email provider not configured.')
        };

        res.status(201).json(responsePayload);
    } catch (err) {
        console.error('[sendInvitation]', err);
        res.status(500).json({ error: 'Server Error sending invitation.' });
    }
};

// ---------------------------------------------------------------------------
// GET /api/trips/:id/invitations
// List all invitations for the trip (creator view).
// ---------------------------------------------------------------------------
exports.listInvitations = async (req, res) => {
    try {
        const trip = req.trip;
        const invitations = await TripInvitation.find({ tripId: trip._id })
            .sort({ createdAt: -1 })
            .populate('recipientUserId', 'name email')
            .lean();

        const sanitized = invitations.map(inv => ({
            _id: inv._id,
            status: inv.status,
            expiresAt: inv.expiresAt,
            participantId: inv.participantId,
            recipientName: inv.recipientUserId?.name,
            recipientEmail: inv.recipientUserId?.email,
            emailSent: inv.emailSent,
            createdAt: inv.createdAt,
            resendCount: inv.resendCount
        }));

        res.json(sanitized);
    } catch (err) {
        console.error('[listInvitations]', err);
        res.status(500).json({ error: 'Server Error listing invitations.' });
    }
};

// ---------------------------------------------------------------------------
// DELETE /api/trips/:id/invitations/:invId
// Revoke a pending invitation (creator only).
// ---------------------------------------------------------------------------
exports.revokeInvitation = async (req, res) => {
    try {
        const invitation = await TripInvitation.findOne({
            _id: req.params.invId,
            tripId: req.trip._id
        });
        if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });
        if (invitation.status !== 'pending') {
            return res.status(400).json({ error: `Cannot revoke an invitation with status "${invitation.status}".` });
        }

        invitation.status = 'revoked';
        await invitation.save();
        res.json({ msg: 'Invitation revoked.' });
    } catch (err) {
        console.error('[revokeInvitation]', err);
        res.status(500).json({ error: 'Server Error revoking invitation.' });
    }
};

// ---------------------------------------------------------------------------
// POST /api/trips/:id/invitations/:invId/resend
// Regenerate token and resend the invitation email (creator only).
// ---------------------------------------------------------------------------
exports.resendInvitation = async (req, res) => {
    try {
        const invitation = await TripInvitation.findOne({
            _id: req.params.invId,
            tripId: req.trip._id
        }).populate('recipientUserId', 'name email');

        if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });
        if (invitation.status !== 'pending') {
            return res.status(400).json({ error: `Cannot resend an invitation with status "${invitation.status}".` });
        }
        if (invitation.resendCount >= MAX_RESENDS_PER_INVITE) {
            return res.status(429).json({ error: `Maximum resend limit (${MAX_RESENDS_PER_INVITE}) reached for this invitation.` });
        }

        // Regenerate token (invalidates old link)
        const { raw, hash } = TripInvitation.generateToken();
        invitation.tokenHash = hash;
        invitation.expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
        invitation.resendCount += 1;
        invitation.lastEmailSentAt = new Date();

        const creator = await User.findById(req.user.id).select('name');
        const { acceptUrl, declineUrl } = buildInvitationUrls(raw);
        const emailResult = await sendInvitationEmail({
            to: invitation.recipientUserId.email,
            recipientName: invitation.recipientUserId.name,
            tripName: req.trip.name,
            creatorName: creator.name,
            acceptUrl,
            declineUrl
        });

        invitation.emailSent = emailResult.sent;
        await invitation.save();

        const responsePayload = {
            msg: 'Invitation resent.',
            emailSent: emailResult.sent,
            emailNote: emailResult.sent ? null : emailResult.reason
        };

        res.json(responsePayload);
    } catch (err) {
        console.error('[resendInvitation]', err);
        res.status(500).json({ error: 'Server Error resending invitation.' });
    }
};

// ---------------------------------------------------------------------------
// GET /api/invitations/:token
// Public endpoint: validate token and return safe trip info for the invite page.
// Does NOT return any expense data.
// ---------------------------------------------------------------------------
exports.validateToken = async (req, res) => {
    try {
        const { token } = req.params;
        if (!token || token.length < 10) {
            return res.status(400).json({ error: 'Invalid invitation link.' });
        }

        const invitation = await TripInvitation.findByToken(token)
            .populate('tripId', 'name description')
            .populate('createdByUserId', 'name')
            .populate('recipientUserId', 'name email');

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation link is invalid or has been revoked.' });
        }
        if (invitation.status === 'revoked') {
            return res.status(410).json({ error: 'This invitation has been revoked by the trip creator.' });
        }
        if (invitation.status === 'expired' || invitation.expiresAt < new Date()) {
            invitation.status = 'expired';
            await invitation.save();
            return res.status(410).json({ error: 'This invitation link has expired.' });
        }
        if (invitation.status === 'accepted') {
            return res.json({
                alreadyAccepted: true,
                tripId: invitation.tripId?._id,
                tripName: invitation.tripId?.name
            });
        }
        if (invitation.status === 'declined') {
            return res.status(410).json({ error: 'This invitation was already declined.' });
        }

        res.json({
            invitationId: invitation._id,
            status: invitation.status,
            tripName: invitation.tripId?.name,
            tripDescription: invitation.tripId?.description,
            creatorName: invitation.createdByUserId?.name,
            recipientName: invitation.recipientUserId?.name,
            recipientEmail: invitation.recipientUserId?.email,
            expiresAt: invitation.expiresAt
        });
    } catch (err) {
        console.error('[validateToken]', err);
        res.status(500).json({ error: 'Server Error validating invitation.' });
    }
};

// ---------------------------------------------------------------------------
// POST /api/invitations/:token/accept
// Authenticated: the recipient (and ONLY the recipient) can accept.
// ---------------------------------------------------------------------------
exports.acceptInvitation = async (req, res) => {
    try {
        const { token } = req.params;
        const invitation = await TripInvitation.findByToken(token);

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation link is invalid or has been revoked.' });
        }

        // Verify the authenticated user is the intended recipient
        if (invitation.recipientUserId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'This invitation belongs to a different account. Please sign in with the invited email address.' });
        }

        if (invitation.status !== 'pending') {
            return res.status(400).json({
                error: `Cannot accept: invitation is "${invitation.status}".`,
                tripId: invitation.tripId
            });
        }
        if (invitation.expiresAt < new Date()) {
            invitation.status = 'expired';
            await invitation.save();
            return res.status(410).json({ error: 'This invitation has expired.' });
        }

        // Atomic: create membership + mark accepted
        const existingMember = await TripMember.findOne({ tripId: invitation.tripId, userId: req.user.id });
        if (!existingMember) {
            await TripMember.create({
                tripId: invitation.tripId,
                userId: req.user.id,
                participantId: invitation.participantId,
                role: 'member'
            });
        }

        invitation.status = 'accepted';
        await invitation.save();

        res.json({ msg: 'Invitation accepted. You are now a member of the trip.', tripId: invitation.tripId });
    } catch (err) {
        console.error('[acceptInvitation]', err);
        res.status(500).json({ error: 'Server Error accepting invitation.' });
    }
};

// ---------------------------------------------------------------------------
// POST /api/invitations/:token/decline
// Authenticated: the recipient can decline.
// ---------------------------------------------------------------------------
exports.declineInvitation = async (req, res) => {
    try {
        const { token } = req.params;
        const invitation = await TripInvitation.findByToken(token);

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation link is invalid or has been revoked.' });
        }

        if (invitation.recipientUserId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'This invitation belongs to a different account.' });
        }

        if (!['pending'].includes(invitation.status)) {
            return res.status(400).json({ error: `Cannot decline: invitation is "${invitation.status}".` });
        }

        invitation.status = 'declined';
        await invitation.save();

        res.json({ msg: 'Invitation declined.' });
    } catch (err) {
        console.error('[declineInvitation]', err);
        res.status(500).json({ error: 'Server Error declining invitation.' });
    }
};

// ---------------------------------------------------------------------------
// GET /api/trips/my-pending-invitations
// Return pending invitations sent TO the authenticated user.
// ---------------------------------------------------------------------------
exports.myPendingInvitations = async (req, res) => {
    try {
        const invitations = await TripInvitation.find({
            recipientUserId: req.user.id,
            status: 'pending',
            expiresAt: { $gt: new Date() }
        })
            .populate('tripId', 'name description')
            .populate('createdByUserId', 'name')
            .lean();

        const result = invitations.map(inv => ({
            _id: inv._id,
            tripId: inv.tripId?._id,
            tripName: inv.tripId?.name,
            tripDescription: inv.tripId?.description,
            creatorName: inv.createdByUserId?.name,
            participantId: inv.participantId,
            expiresAt: inv.expiresAt,
            createdAt: inv.createdAt
        }));

        res.json(result);
    } catch (err) {
        console.error('[myPendingInvitations]', err);
        res.status(500).json({ error: 'Server Error fetching pending invitations.' });
    }
};

// ---------------------------------------------------------------------------
// POST /api/my-pending-invitations/:invId/accept
// Accept an invitation directly from the authenticated Dashboard.
// ---------------------------------------------------------------------------
exports.acceptPendingInvitationById = async (req, res) => {
    try {
        const invitation = await TripInvitation.findById(req.params.invId);
        if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });

        if (invitation.recipientUserId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'This invitation belongs to a different account.' });
        }
        if (invitation.status !== 'pending') {
            return res.status(400).json({ error: `Cannot accept: invitation is "${invitation.status}".` });
        }
        if (invitation.expiresAt < new Date()) {
            invitation.status = 'expired';
            await invitation.save();
            return res.status(410).json({ error: 'This invitation has expired.' });
        }

        const existingMember = await TripMember.findOne({ tripId: invitation.tripId, userId: req.user.id });
        if (!existingMember) {
            await TripMember.create({
                tripId: invitation.tripId,
                userId: req.user.id,
                participantId: invitation.participantId,
                role: 'member'
            });
        }
        invitation.status = 'accepted';
        await invitation.save();

        res.json({ msg: 'Invitation accepted! You have joined the trip.', tripId: invitation.tripId });
    } catch (err) {
        console.error('[acceptPendingInvitationById]', err);
        res.status(500).json({ error: 'Server Error accepting invitation.' });
    }
};

// ---------------------------------------------------------------------------
// POST /api/my-pending-invitations/:invId/decline
// Decline an invitation directly from the authenticated Dashboard.
// ---------------------------------------------------------------------------
exports.declinePendingInvitationById = async (req, res) => {
    try {
        const invitation = await TripInvitation.findById(req.params.invId);
        if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });

        if (invitation.recipientUserId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'This invitation belongs to a different account.' });
        }
        if (invitation.status !== 'pending') {
            return res.status(400).json({ error: `Cannot decline: invitation is "${invitation.status}".` });
        }

        invitation.status = 'declined';
        await invitation.save();

        res.json({ msg: 'Invitation declined.' });
    } catch (err) {
        console.error('[declinePendingInvitationById]', err);
        res.status(500).json({ error: 'Server Error declining invitation.' });
    }
};

