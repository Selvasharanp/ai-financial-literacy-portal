const Trip = require('../models/Trip');
const TripExpense = require('../models/TripExpense');
const TripSettlement = require('../models/TripSettlement');
const TripMember = require('../models/TripMember');
const { calculateTrip, validateSettlement, toPaise, fromPaise } = require('../utils/tripCalculator');

// ---------------------------------------------------------------------------
// Create a new trip
// ---------------------------------------------------------------------------
exports.createTrip = async (req, res) => {
    try {
        const { name, description, participants, collaborativeMode, startDate, endDate, status } = req.body;
        if (!name?.trim()) {
            return res.status(400).json({ error: 'A trip name is required.' });
        }

        const isCollaborative = Boolean(collaborativeMode);
        const parsedStartDate = startDate ? new Date(startDate) : undefined;
        const parsedEndDate = endDate ? new Date(endDate) : undefined;
        const tripStatus = ['active', 'completed'].includes(status) ? status : 'active';

        // For collaborative trips the creator is automatically a participant
        // with a reserved participantId so the link to User is clear.
        let cleanParticipants = [];
        if (isCollaborative) {
            // In collaborative mode the creator is always participant 0
            const creatorParticipantId = `user_${req.user.id}`;
            // Creator participant is added automatically; additional name-based
            // participants can be pre-seeded but will normally arrive via invitations.
            const extra = Array.isArray(participants)
                ? participants.filter(p => p.id !== creatorParticipantId && String(p.name || '').trim())
                : [];
            cleanParticipants = [
                { id: creatorParticipantId, name: req.body.myName || 'You', email: '' },
                ...extra.map((p, idx) => ({
                    id: p.id || `p_${Date.now()}_${idx}`,
                    name: String(p.name).trim(),
                    email: String(p.email || '').trim()
                }))
            ];

            const trip = new Trip({
                userId: req.user.id,
                name: name.trim(),
                description: description ? String(description).trim() : '',
                startDate: parsedStartDate,
                endDate: parsedEndDate,
                status: tripStatus,
                collaborativeMode: true,
                participants: cleanParticipants
            });
            await trip.save();

            // Register the creator as an accepted member
            await TripMember.findOneAndUpdate(
                { tripId: trip._id, userId: req.user.id },
                { tripId: trip._id, userId: req.user.id, participantId: creatorParticipantId, role: 'creator' },
                { upsert: true, new: true }
            );

            return res.status(201).json(trip);
        }

        // --- Legacy single-user mode ---
        if (!Array.isArray(participants) || participants.length < 2) {
            return res.status(400).json({ error: 'At least 2 participants are required for a personal trip.' });
        }
        cleanParticipants = participants.map((p, idx) => ({
            id: p.id || `p_${Date.now()}_${idx}`,
            name: String(p.name || '').trim(),
            email: String(p.email || '').trim()
        }));
        if (cleanParticipants.some(p => !p.name)) {
            return res.status(400).json({ error: 'All participants must have a valid name.' });
        }

        const trip = new Trip({
            userId: req.user.id,
            name: name.trim(),
            description: description ? String(description).trim() : '',
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            status: tripStatus,
            collaborativeMode: false,
            participants: cleanParticipants
        });
        await trip.save();
        res.status(201).json(trip);
    } catch (err) {
        console.error('Trip create error:', err);
        res.status(500).json({ error: 'Server Error creating trip.' });
    }
};

// ---------------------------------------------------------------------------
// Get all trips for the authenticated user (created + member-of)
// Enriched with creator info, member counts, total expenses, and current user net balance
// ---------------------------------------------------------------------------
exports.getTrips = async (req, res) => {
    try {
        // Trips created by the user
        const createdTrips = await Trip.find({ userId: req.user.id })
            .populate('userId', 'name email')
            .sort({ createdAt: -1 });

        // Trips where the user is an accepted member (not the creator)
        const memberships = await TripMember.find({ userId: req.user.id }).select('tripId participantId role');
        const memberTripIds = memberships.map(m => m.tripId);
        const memberTrips = await Trip.find({
            _id: { $in: memberTripIds },
            userId: { $ne: req.user.id } // exclude own created trips (avoid duplicates)
        })
            .populate('userId', 'name email')
            .sort({ createdAt: -1 });

        // Merge: created trips first, then member trips
        const allTrips = [...createdTrips, ...memberTrips];

        // Enrich each trip with quick summary stats for Dashboard and TripSplitter
        const enriched = await Promise.all(allTrips.map(async (trip) => {
            const expenses = await TripExpense.find({ tripId: trip._id });
            const settlements = await TripSettlement.find({ tripId: trip._id });
            const calculation = calculateTrip(trip.participants, expenses, settlements);

            // Determine current user's participantId in this trip
            let userParticipantId = null;
            if (trip.collaborativeMode) {
                const mem = memberships.find(m => m.tripId.toString() === trip._id.toString());
                if (mem) {
                    userParticipantId = mem.participantId;
                } else if ((trip.userId?._id || trip.userId).toString() === req.user.id) {
                    userParticipantId = `user_${req.user.id}`;
                }
            } else {
                userParticipantId = 'p_you';
            }

            const pSummary = userParticipantId ? calculation.participantSummary.find(p => p.id === userParticipantId) : null;
            const netBalance = pSummary ? pSummary.netBalance : 0;

            const memberCount = trip.collaborativeMode
                ? await TripMember.countDocuments({ tripId: trip._id })
                : (trip.participants?.length || 0);

            const creatorId = trip.userId?._id ? trip.userId._id.toString() : trip.userId?.toString();
            const isCreator = creatorId === req.user.id;

            return {
                _id: trip._id,
                name: trip.name,
                description: trip.description || '',
                startDate: trip.startDate,
                endDate: trip.endDate,
                status: trip.status || 'active',
                collaborativeMode: trip.collaborativeMode,
                participants: trip.participants,
                createdAt: trip.createdAt,
                creator: {
                    id: creatorId,
                    name: trip.userId?.name || (isCreator ? 'You' : 'Creator'),
                    email: trip.userId?.email || ''
                },
                isCreator,
                acceptedMemberCount: memberCount,
                totalExpenses: calculation.totalTripExpense,
                currentUserNetBalance: netBalance,
                currentUserNetStatus: netBalance > 0 ? 'receive' : (netBalance < 0 ? 'pay' : 'settled')
            };
        }));

        res.json(enriched);
    } catch (err) {
        console.error('Trips fetch error:', err);
        res.status(500).json({ error: 'Server Error fetching trips.' });
    }
};

// ---------------------------------------------------------------------------
// Get single trip details (auth: creator OR accepted member)
// req.trip is set by requireTripAccess middleware
// ---------------------------------------------------------------------------
exports.getTripDetails = async (req, res) => {
    try {
        const trip = req.trip;
        const expenses = await TripExpense.find({ tripId: trip._id }).sort({ date: -1 });
        const recordedSettlements = await TripSettlement.find({ tripId: trip._id }).sort({ date: -1 });
        const calculation = calculateTrip(trip.participants, expenses, recordedSettlements);

        // For collaborative trips, fetch membership info
        let members = [];
        if (trip.collaborativeMode) {
            const TripInvitation = require('../models/TripInvitation');
            const memberDocs = await TripMember.find({ tripId: trip._id })
                .populate('userId', 'name email')
                .lean();
            const invitationDocs = await TripInvitation.find({ tripId: trip._id })
                .populate('recipientUserId', 'name email')
                .lean();

            members = memberDocs.map(m => ({
                userId: m.userId?._id,
                name: m.userId?.name,
                email: m.userId?.email,
                participantId: m.participantId,
                role: m.role,
                joinedAt: m.joinedAt
            }));

            // Attach pending invitations to the response
            const pendingInvitations = invitationDocs
                .filter(inv => inv.status === 'pending')
                .map(inv => ({
                    _id: inv._id,
                    recipientName: inv.recipientUserId?.name,
                    recipientEmail: inv.recipientUserId?.email,
                    participantId: inv.participantId,
                    status: inv.status,
                    expiresAt: inv.expiresAt,
                    resendCount: inv.resendCount
                }));

            const declinedRevoked = invitationDocs
                .filter(inv => ['declined', 'revoked', 'expired'].includes(inv.status))
                .map(inv => ({
                    _id: inv._id,
                    recipientName: inv.recipientUserId?.name,
                    status: inv.status,
                    expiresAt: inv.expiresAt
                }));

            return res.json({
                trip,
                expenses,
                recordedSettlements,
                members,
                pendingInvitations,
                declinedRevoked,
                isCreator: req.isTripCreator,
                currentUserId: req.user.id,
                ...calculation
            });
        }

        res.json({
            trip,
            expenses,
            recordedSettlements,
            isCreator: req.isTripCreator,
            currentUserId: req.user.id,
            ...calculation
        });
    } catch (err) {
        console.error('Trip details error:', err);
        res.status(500).json({ error: 'Server Error fetching trip details.' });
    }
};

// ---------------------------------------------------------------------------
// Update trip participants (creator only)
// ---------------------------------------------------------------------------
exports.updateTripParticipants = async (req, res) => {
    try {
        const { participants } = req.body;
        if (!Array.isArray(participants) || participants.length < 1) {
            return res.status(400).json({ error: 'At least 1 participant required.' });
        }

        const trip = req.trip;
        trip.participants = participants.map((p, idx) => ({
            id: p.id || `p_${Date.now()}_${idx}`,
            name: String(p.name || '').trim(),
            email: String(p.email || '').trim()
        }));

        await trip.save();
        res.json(trip);
    } catch (err) {
        console.error('Trip participants update error:', err);
        res.status(500).json({ error: 'Server Error updating trip participants.' });
    }
};

// ---------------------------------------------------------------------------
// Add expense to a trip (auth: creator OR accepted member)
// ---------------------------------------------------------------------------
exports.addTripExpense = async (req, res) => {
    try {
        const { description, amount, paidBy, sharedWith, date, splitType, participantShares } = req.body;
        const trip = req.trip;

        const parsedAmount = Number(amount);
        if (!description?.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !paidBy) {
            return res.status(400).json({ error: 'Provide a description, positive total amount, and payer.' });
        }

        // Validate payer belongs to this trip
        const validIds = new Set(trip.participants.map(p => p.id));
        if (!validIds.has(paidBy)) {
            return res.status(400).json({ error: 'Invalid payer participant ID.' });
        }

        const effectiveSplitType = splitType === 'custom' ? 'custom' : 'equal';
        let validatedSharedWith = [];
        let validatedShares = [];

        if (effectiveSplitType === 'custom') {
            if (!Array.isArray(participantShares) || participantShares.length === 0) {
                return res.status(400).json({ error: 'Custom Amount Split requires participant shares.' });
            }

            const totalPaise = toPaise(parsedAmount);
            let sumSharesPaise = 0;

            for (const share of participantShares) {
                if (!share.participantId || !validIds.has(share.participantId)) {
                    return res.status(400).json({ error: `Invalid participant ID in custom shares: ${share.participantId}` });
                }
                const shareAmt = Number(share.amount);
                if (!Number.isFinite(shareAmt) || shareAmt < 0) {
                    return res.status(400).json({ error: 'Individual amounts must be valid non-negative numbers.' });
                }
                const sPaise = toPaise(shareAmt);
                sumSharesPaise += sPaise;
                if (sPaise > 0) {
                    validatedSharedWith.push(share.participantId);
                }
                validatedShares.push({
                    participantId: share.participantId,
                    amount: fromPaise(sPaise)
                });
            }

            if (validatedSharedWith.length === 0) {
                return res.status(400).json({ error: 'At least one participant must have an amount greater than 0.' });
            }

            if (sumSharesPaise !== totalPaise) {
                const diff = fromPaise(Math.abs(totalPaise - sumSharesPaise));
                const direction = sumSharesPaise < totalPaise ? 'less than' : 'greater than';
                return res.status(400).json({
                    error: `The sum of individual amounts (₹${fromPaise(sumSharesPaise).toFixed(2)}) is ${direction} total expense (₹${fromPaise(totalPaise).toFixed(2)}) by ₹${diff.toFixed(2)}. Sum must equal total expense.`
                });
            }
        } else {
            // Equal split
            if (!Array.isArray(sharedWith) || sharedWith.length === 0) {
                return res.status(400).json({ error: 'Equal split must be shared with at least 1 participant.' });
            }
            const invalidShared = sharedWith.filter(id => !validIds.has(id));
            if (invalidShared.length > 0) {
                return res.status(400).json({ error: `Invalid participant IDs in sharedWith: ${invalidShared.join(', ')}` });
            }
            validatedSharedWith = sharedWith;
        }

        const expense = new TripExpense({
            tripId: trip._id,
            userId: req.user.id,
            createdByUserId: req.user.id,
            description: description.trim(),
            amount: parsedAmount,
            paidBy,
            sharedWith: validatedSharedWith,
            splitType: effectiveSplitType,
            participantShares: effectiveSplitType === 'custom' ? validatedShares : [],
            date: date ? new Date(date) : new Date()
        });

        await expense.save();
        res.status(201).json(expense);
    } catch (err) {
        console.error('Trip expense add error:', err);
        res.status(500).json({ error: 'Server Error adding trip expense.' });
    }
};

// ---------------------------------------------------------------------------
// Edit a trip expense (expense creator OR trip creator)
// ---------------------------------------------------------------------------
exports.editTripExpense = async (req, res) => {
    try {
        const { description, amount, paidBy, sharedWith, date, splitType, participantShares } = req.body;
        const trip = req.trip;

        const expense = await TripExpense.findOne({ _id: req.params.expenseId, tripId: trip._id });
        if (!expense) return res.status(404).json({ error: 'Trip expense not found.' });

        // Authorization: trip creator OR the user who created the expense
        const canEdit = req.isTripCreator || expense.userId.toString() === req.user.id;
        if (!canEdit) {
            return res.status(403).json({ error: 'You can only edit your own expenses.' });
        }

        const parsedAmount = amount !== undefined ? Number(amount) : expense.amount;
        if (description !== undefined && !description.trim()) {
            return res.status(400).json({ error: 'Description cannot be empty.' });
        }
        if (amount !== undefined && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
            return res.status(400).json({ error: 'Amount must be positive.' });
        }

        const validIds = new Set(trip.participants.map(p => p.id));
        if (paidBy && !validIds.has(paidBy)) {
            return res.status(400).json({ error: 'Invalid payer participant ID.' });
        }

        const effectiveSplitType = splitType !== undefined ? (splitType === 'custom' ? 'custom' : 'equal') : (expense.splitType || 'equal');
        let validatedSharedWith = sharedWith || expense.sharedWith;
        let validatedShares = participantShares || expense.participantShares || [];

        if (effectiveSplitType === 'custom') {
            if (!Array.isArray(validatedShares) || validatedShares.length === 0) {
                return res.status(400).json({ error: 'Custom Amount Split requires participant shares.' });
            }

            const totalPaise = toPaise(parsedAmount);
            let sumSharesPaise = 0;
            const finalShares = [];
            const activeParticipants = [];

            for (const share of validatedShares) {
                if (!share.participantId || !validIds.has(share.participantId)) {
                    return res.status(400).json({ error: `Invalid participant ID in custom shares: ${share.participantId}` });
                }
                const shareAmt = Number(share.amount);
                if (!Number.isFinite(shareAmt) || shareAmt < 0) {
                    return res.status(400).json({ error: 'Individual amounts must be valid non-negative numbers.' });
                }
                const sPaise = toPaise(shareAmt);
                sumSharesPaise += sPaise;
                if (sPaise > 0) activeParticipants.push(share.participantId);
                finalShares.push({ participantId: share.participantId, amount: fromPaise(sPaise) });
            }

            if (activeParticipants.length === 0) {
                return res.status(400).json({ error: 'At least one participant must have an amount greater than 0.' });
            }

            if (sumSharesPaise !== totalPaise) {
                const diff = fromPaise(Math.abs(totalPaise - sumSharesPaise));
                const direction = sumSharesPaise < totalPaise ? 'less than' : 'greater than';
                return res.status(400).json({
                    error: `The sum of individual amounts (₹${fromPaise(sumSharesPaise).toFixed(2)}) is ${direction} total expense (₹${fromPaise(totalPaise).toFixed(2)}) by ₹${diff.toFixed(2)}. Sum must equal total expense.`
                });
            }

            validatedSharedWith = activeParticipants;
            validatedShares = finalShares;
        } else {
            if (!Array.isArray(validatedSharedWith) || validatedSharedWith.length === 0) {
                return res.status(400).json({ error: 'Expense must be shared with at least 1 person.' });
            }
            const invalid = validatedSharedWith.filter(id => !validIds.has(id));
            if (invalid.length > 0) {
                return res.status(400).json({ error: `Invalid participant IDs in sharedWith: ${invalid.join(', ')}` });
            }
        }

        if (description) expense.description = description.trim();
        if (amount) expense.amount = parsedAmount;
        if (paidBy) expense.paidBy = paidBy;
        expense.sharedWith = validatedSharedWith;
        expense.splitType = effectiveSplitType;
        expense.participantShares = effectiveSplitType === 'custom' ? validatedShares : [];
        if (date) expense.date = new Date(date);

        await expense.save();
        res.json(expense);
    } catch (err) {
        console.error('Trip expense edit error:', err);
        res.status(500).json({ error: 'Server Error editing trip expense.' });
    }
};

// ---------------------------------------------------------------------------
// Delete a trip expense (expense creator OR trip creator)
// ---------------------------------------------------------------------------
exports.deleteTripExpense = async (req, res) => {
    try {
        const expense = await TripExpense.findOne({ _id: req.params.expenseId, tripId: req.trip._id });
        if (!expense) return res.status(404).json({ error: 'Trip expense not found.' });

        const canDelete = req.isTripCreator || expense.userId.toString() === req.user.id;
        if (!canDelete) {
            return res.status(403).json({ error: 'You can only delete your own expenses.' });
        }

        await expense.deleteOne();
        res.json({ msg: 'Trip expense removed.' });
    } catch (err) {
        console.error('Trip expense delete error:', err);
        res.status(500).json({ error: 'Server Error deleting trip expense.' });
    }
};

// ---------------------------------------------------------------------------
// Record a settlement payment (auth: creator OR accepted member)
// ---------------------------------------------------------------------------
exports.recordTripSettlement = async (req, res) => {
    try {
        const { fromParticipantId, toParticipantId, amount, notes, date } = req.body;
        const trip = req.trip;

        const parsedAmount = Number(amount);
        if (!fromParticipantId || !toParticipantId || fromParticipantId === toParticipantId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Invalid settlement: Provide different payer and payee with positive amount.' });
        }

        const expenses = await TripExpense.find({ tripId: trip._id });
        const recordedSettlements = await TripSettlement.find({ tripId: trip._id });
        const currentCalc = calculateTrip(trip.participants, expenses, recordedSettlements);

        const validation = validateSettlement(currentCalc, fromParticipantId, toParticipantId, parsedAmount);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const settlement = new TripSettlement({
            tripId: trip._id,
            userId: req.user.id,
            fromParticipantId,
            toParticipantId,
            amount: parsedAmount,
            notes: notes ? String(notes).trim() : '',
            date: date ? new Date(date) : new Date()
        });

        await settlement.save();
        res.status(201).json(settlement);
    } catch (err) {
        console.error('Trip settlement record error:', err);
        res.status(500).json({ error: 'Server Error recording settlement payment.' });
    }
};

// ---------------------------------------------------------------------------
// Delete / undo a recorded settlement (settlement creator OR trip creator)
// ---------------------------------------------------------------------------
exports.deleteTripSettlement = async (req, res) => {
    try {
        const settlement = await TripSettlement.findOne({ _id: req.params.settlementId, tripId: req.trip._id });
        if (!settlement) return res.status(404).json({ error: 'Settlement record not found.' });

        const canDelete = req.isTripCreator || settlement.userId.toString() === req.user.id;
        if (!canDelete) {
            return res.status(403).json({ error: 'You can only remove your own settlement records.' });
        }

        await settlement.deleteOne();
        res.json({ msg: 'Settlement record removed.' });
    } catch (err) {
        console.error('Trip settlement delete error:', err);
        res.status(500).json({ error: 'Server Error deleting settlement record.' });
    }
};

// ---------------------------------------------------------------------------
// Delete entire trip (creator only)
// ---------------------------------------------------------------------------
exports.deleteTrip = async (req, res) => {
    try {
        const trip = req.trip;

        await TripExpense.deleteMany({ tripId: trip._id });
        await TripSettlement.deleteMany({ tripId: trip._id });
        await TripMember.deleteMany({ tripId: trip._id });

        const TripInvitation = require('../models/TripInvitation');
        await TripInvitation.deleteMany({ tripId: trip._id });

        await trip.deleteOne();
        res.json({ msg: 'Trip and all associated records removed.' });
    } catch (err) {
        console.error('Trip delete error:', err);
        res.status(500).json({ error: 'Server Error deleting trip.' });
    }
};
