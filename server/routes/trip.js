const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { requireTripAccess, requireTripCreator } = require('../middleware/tripAccessMiddleware');
const {
    createTrip,
    getTrips,
    getTripDetails,
    updateTripParticipants,
    addTripExpense,
    editTripExpense,
    deleteTripExpense,
    recordTripSettlement,
    deleteTripSettlement,
    deleteTrip
} = require('../controllers/tripController');


// Lookup email (for invite search) - in auth routes but proxied here for convenience
const { lookupEmail } = require('../controllers/invitationController');
const rateLimit = require('express-rate-limit');
const emailLookupLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many email lookup attempts. Please try again later.' },
    standardHeaders: true, legacyHeaders: false
});

router.post('/', auth, createTrip);
router.get('/', auth, getTrips);

// Creator OR accepted member
router.get('/:id', auth, requireTripAccess, getTripDetails);
router.post('/:id/expenses', auth, requireTripAccess, addTripExpense);
router.put('/:id/expenses/:expenseId', auth, requireTripAccess, editTripExpense);
router.delete('/:id/expenses/:expenseId', auth, requireTripAccess, deleteTripExpense);
router.post('/:id/settlements', auth, requireTripAccess, recordTripSettlement);
router.delete('/:id/settlements/:settlementId', auth, requireTripAccess, deleteTripSettlement);

// Creator only
router.put('/:id/participants', auth, requireTripCreator, updateTripParticipants);
router.delete('/:id', auth, requireTripCreator, deleteTrip);

// Email lookup for invite search
router.post('/invite/lookup-email', auth, emailLookupLimit, lookupEmail);

module.exports = router;
