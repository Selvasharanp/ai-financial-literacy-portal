const mongoose = require('mongoose');
const crypto = require('crypto');

const TripInvitationSchema = new mongoose.Schema({
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // participantId is the string ID in Trip.participants that belongs to this invitee
    participantId: { type: String, required: true },
    // Store SHA-256 hash, never the raw token
    tokenHash: { type: String, required: true, unique: true },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined', 'revoked', 'expired'],
        default: 'pending'
    },
    expiresAt: { type: Date, required: true },
    // Track email delivery
    emailSent: { type: Boolean, default: false },
    lastEmailSentAt: { type: Date },
    resendCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

// TTL index: MongoDB will delete expired docs automatically (clean-up aid — status check is primary guard)
TripInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Helper: generate a cryptographically secure token and its hash
TripInvitationSchema.statics.generateToken = function () {
    const raw = crypto.randomBytes(32).toString('hex'); // 64-char hex string
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return { raw, hash };
};

// Helper: look up by raw token
TripInvitationSchema.statics.findByToken = function (rawToken) {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    return this.findOne({ tokenHash: hash });
};

module.exports = mongoose.model('TripInvitation', TripInvitationSchema);
