const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/authMiddleware');
const {
    lookupEmail,
    sendInvitation,
    listInvitations,
    revokeInvitation,
    resendInvitation,
    validateToken,
    acceptInvitation,
    declineInvitation,
    myPendingInvitations,
    acceptPendingInvitationById,
    declinePendingInvitationById
} = require('../controllers/invitationController');
const { requireTripCreator, requireTripAccess } = require('../middleware/tripAccessMiddleware');

// Rate limiting: max 10 invitation-related requests per 15 minutes per IP
const inviteRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many invitation requests. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Accept/decline rate limit: max 20 per 15 minutes per IP
const acceptRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

// --- Trip-scoped invitation routes (creator only) ---
router.post('/trips/:id/invitations', auth, requireTripCreator, inviteRateLimit, sendInvitation);
router.get('/trips/:id/invitations', auth, requireTripCreator, listInvitations);
router.delete('/trips/:id/invitations/:invId', auth, requireTripCreator, revokeInvitation);
router.post('/trips/:id/invitations/:invId/resend', auth, requireTripCreator, inviteRateLimit, resendInvitation);

// --- Token-based invitation routes (public validate, auth for accept/decline) ---
router.get('/invitations/:token', validateToken);                                // Public
router.post('/invitations/:token/accept', auth, acceptRateLimit, acceptInvitation);
router.post('/invitations/:token/decline', auth, acceptRateLimit, declineInvitation);

// --- My pending invitations (authenticated user) ---
router.get('/my-pending-invitations', auth, myPendingInvitations);
router.post('/my-pending-invitations/:invId/accept', auth, acceptRateLimit, acceptPendingInvitationById);
router.post('/my-pending-invitations/:invId/decline', auth, acceptRateLimit, declinePendingInvitationById);

module.exports = router;
