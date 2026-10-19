/**
 * Trip Access Middleware
 * 
 * requireTripAccess — allows the trip creator OR any accepted TripMember.
 * requireTripCreator — allows only the trip creator (for admin operations).
 * 
 * On success, attaches req.trip and req.isTripCreator for downstream handlers.
 */
const Trip = require('../models/Trip');
const TripMember = require('../models/TripMember');

exports.requireTripAccess = async (req, res, next) => {
    try {
        const trip = await Trip.findById(req.params.id);
        if (!trip) return res.status(404).json({ error: 'Trip not found.' });

        const isCreator = trip.userId.toString() === req.user.id;

        if (isCreator) {
            req.trip = trip;
            req.isTripCreator = true;
            return next();
        }

        // Check accepted membership
        const member = await TripMember.findOne({ tripId: trip._id, userId: req.user.id });
        if (!member) {
            return res.status(403).json({ error: 'You are not a member of this trip.' });
        }

        req.trip = trip;
        req.isTripCreator = false;
        req.tripMember = member;
        return next();
    } catch (err) {
        console.error('[TripAccess]', err);
        res.status(500).json({ error: 'Server Error checking trip access.' });
    }
};

exports.requireTripCreator = async (req, res, next) => {
    try {
        const trip = await Trip.findById(req.params.id);
        if (!trip) return res.status(404).json({ error: 'Trip not found.' });

        if (trip.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Only the trip creator can perform this action.' });
        }

        req.trip = trip;
        req.isTripCreator = true;
        return next();
    } catch (err) {
        console.error('[TripCreator]', err);
        res.status(500).json({ error: 'Server Error checking trip ownership.' });
    }
};
