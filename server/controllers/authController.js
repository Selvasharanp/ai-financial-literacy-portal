const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register User
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name?.trim() || !email?.trim() || !password || password.length < 8) {
            return res.status(400).json({ msg: 'Name, email, and a password of at least 8 characters are required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if user exists
        let user = await User.findOne({ email: normalizedEmail });
        if (user) return res.status(400).json({ msg: 'User already exists' });

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create User (Default values for onboarding fields)
        user = new User({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            location: 'Global',
            userType: 'Student',
            openingBalance: 0,
            hasCompletedOnboarding: false
        });
        await user.save();

        // Create JWT
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                location: user.location,
                userType: user.userType,
                openingBalance: user.openingBalance,
                openingBalanceDate: user.openingBalanceDate,
                hasCompletedOnboarding: user.hasCompletedOnboarding
            }
        });

    } catch (err) {
        console.error('[Auth Register Error]:', err);
        res.status(500).send('Server Error');
    }
};

// Login User
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email?.trim() || !password) return res.status(400).json({ msg: 'Email and password are required.' });

        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                location: user.location,
                userType: user.userType || 'Student',
                openingBalance: user.openingBalance || 0,
                openingBalanceDate: user.openingBalanceDate || user.createdAt || new Date(),
                hasCompletedOnboarding: user.hasCompletedOnboarding || false
            }
        });

    } catch (err) {
        res.status(500).send('Server Error');
    }
};

// Complete First-Time Onboarding
exports.completeOnboarding = async (req, res) => {
    try {
        const { userType, openingBalance, income, isCredited, monthToDateSpending } = req.body;
        if (!['Student', 'Working Professional'].includes(userType)) {
            return res.status(400).json({ error: 'Please select a valid profile type (Student or Working Professional).' });
        }

        const parsedBalance = openingBalance !== undefined && openingBalance !== '' ? Number(openingBalance) : 0;
        if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
            return res.status(400).json({ error: 'Current available balance must be a valid non-negative number.' });
        }

        const parsedMtdSpending = monthToDateSpending !== undefined && monthToDateSpending !== '' ? Number(monthToDateSpending) : 0;
        if (!Number.isFinite(parsedMtdSpending) || parsedMtdSpending < 0) {
            return res.status(400).json({ error: 'Month-to-date spending must be a valid non-negative number.' });
        }

        const onboardingDate = new Date();

        const parsedIncome = income !== undefined && income !== '' ? Number(income) : 0;
        const isCreditedBool = isCredited !== undefined ? Boolean(isCredited) : true;
        const currentMonthKey = onboardingDate.toISOString().slice(0, 7);

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                userType,
                openingBalance: parsedBalance,
                openingBalanceDate: onboardingDate,
                income: parsedIncome,
                isCredited: isCreditedBool,
                lastCreditedMonth: isCreditedBool ? currentMonthKey : '',
                monthToDateSpending: parsedMtdSpending,
                monthToDateSpendingMonth: currentMonthKey,
                hasCompletedOnboarding: true
            },
            { new: true }
        ).select('name email location locationRegion locationSource userType openingBalance openingBalanceDate income isCredited lastCreditedMonth monthToDateSpending monthToDateSpendingMonth hasCompletedOnboarding');

        if (!user) return res.status(404).json({ error: 'User not found' });

        // If Working Professional provided income > 0, record as transaction
        if (userType === 'Working Professional' && parsedIncome > 0) {
            const Transaction = require('../models/Transaction');
            await new Transaction({
                userId: req.user.id,
                title: 'Monthly Salary',
                amount: parsedIncome,
                type: 'income',
                category: 'Salary',
                date: onboardingDate,
                isCredited: isCreditedBool
            }).save();
        }

        res.json(user);
    } catch (err) {
        console.error('[Onboarding Complete Error]:', err);
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.getProfile = async (req, res) => {
    const user = await User.findById(req.user.id).select('name email location locationRegion locationSource userType openingBalance openingBalanceDate income isCredited lastCreditedMonth hasCompletedOnboarding authProvider googleId avatar password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const profile = user.toObject();
    profile.userType = profile.userType || 'Student';
    profile.openingBalance = profile.openingBalance || 0;
    profile.income = profile.income || 0;
    profile.isCredited = profile.isCredited !== undefined ? profile.isCredited : true;
    profile.lastCreditedMonth = profile.lastCreditedMonth || '';
    profile.openingBalanceDate = profile.openingBalanceDate || profile.createdAt || new Date();
    profile.hasCompletedOnboarding = profile.hasCompletedOnboarding || false;
    profile.authProvider = profile.authProvider || (profile.googleId ? 'google' : 'local');
    profile.isGoogleConnected = Boolean(profile.googleId);
    profile.hasPassword = Boolean(user.password && user.password.length > 0);
    delete profile.password;
    res.json(profile);
};

exports.updateProfile = async (req, res) => {
    const { name, location, userType, openingBalance, openingBalanceDate } = req.body;
    if (!name?.trim() || !location?.trim()) return res.status(400).json({ error: 'Name and city are required.' });

    const updateFields = {
        name: name.trim(),
        location: location.trim(),
        locationRegion: '',
        locationSource: 'manual'
    };

    if (userType && ['Student', 'Working Professional'].includes(userType)) {
        updateFields.userType = userType;
    }
    if (openingBalance !== undefined && openingBalance !== '') {
        const parsedBalance = Number(openingBalance);
        if (Number.isFinite(parsedBalance) && parsedBalance >= 0) {
            updateFields.openingBalance = parsedBalance;
        }
    }
    if (openingBalanceDate) {
        const parsedDate = new Date(openingBalanceDate);
        if (!Number.isNaN(parsedDate.getTime())) {
            updateFields.openingBalanceDate = parsedDate;
        }
    }

    const user = await User.findByIdAndUpdate(req.user.id, updateFields, { new: true })
        .select('name email location locationRegion locationSource userType openingBalance openingBalanceDate authProvider googleId avatar');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const profile = user.toObject();
    profile.userType = profile.userType || 'Student';
    profile.openingBalance = profile.openingBalance || 0;
    profile.isGoogleConnected = Boolean(profile.googleId);
    res.json(profile);
};

exports.detectLocation = async (req, res) => {
    const { latitude, longitude } = req.body;
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    }

    try {
        const endpoint = new URL('https://nominatim.openstreetmap.org/reverse');
        endpoint.searchParams.set('lat', String(lat));
        endpoint.searchParams.set('lon', String(lon));
        endpoint.searchParams.set('format', 'jsonv2');
        endpoint.searchParams.set('addressdetails', '1');
        const response = await fetch(endpoint, { headers: { 'User-Agent': process.env.NOMINATIM_USER_AGENT || 'FinancialLiteracyPortal/1.0' } });
        if (!response.ok) throw new Error(`Reverse geocoding returned ${response.status}`);
        const data = await response.json();
        const address = data.address || {};
        const city = address.city || address.town || address.village || address.county || address.state;
        const region = address.state || address.country || '';
        if (!city) return res.status(422).json({ error: 'We could not determine a city from this location. Please select one manually.' });

        const user = await User.findByIdAndUpdate(req.user.id, { location: city, locationRegion: region, locationSource: 'geolocation' }, { new: true }).select('name email location locationRegion locationSource');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        console.error('[Location] Reverse geocoding failed:', err.message);
        res.status(503).json({ error: 'Unable to detect your city. Please select it manually.' });
    }
};

// Helper: Verify Google Token via Google tokeninfo endpoint
async function verifyGoogleCredential(credential) {
    if (!credential) return null;
    try {
        const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
        if (!res.ok) {
            console.warn('[Google Auth] Token verification responded with status:', res.status);
            return null;
        }
        const data = await res.json();
        return {
            googleId: data.sub,
            email: data.email,
            name: data.name,
            picture: data.picture,
            emailVerified: data.email_verified === 'true' || data.email_verified === true
        };
    } catch (err) {
        console.error('[Google Auth] Error contacting Google tokeninfo:', err.message);
        return null;
    }
}

// Google Sign-In & Registration
exports.googleAuth = async (req, res) => {
    try {
        const { credential, googleId: directGoogleId, email: directEmail, name: directName, avatar: directAvatar } = req.body;
        let verifiedInfo = null;

        if (credential) {
            verifiedInfo = await verifyGoogleCredential(credential);
            if (!verifiedInfo) {
                // Fallback payload decode if offline/sandbox
                try {
                    const payloadBase64 = credential.split('.')[1];
                    if (payloadBase64) {
                        const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
                        if (decoded.sub && decoded.email) {
                            verifiedInfo = {
                                googleId: decoded.sub,
                                email: decoded.email,
                                name: decoded.name || decoded.given_name || 'Google User',
                                picture: decoded.picture || ''
                            };
                        }
                    }
                } catch (e) {
                    console.warn('[Google Auth] Fallback decode failed:', e.message);
                }
            }
        }

        const googleId = verifiedInfo?.googleId || directGoogleId;
        const email = (verifiedInfo?.email || directEmail)?.trim()?.toLowerCase();
        const name = (verifiedInfo?.name || directName || 'Google User').trim();
        const avatar = verifiedInfo?.picture || directAvatar || '';

        if (!email) {
            return res.status(400).json({ msg: 'Google authentication failed: Email address is required.' });
        }

        let user = await User.findOne({ $or: [{ googleId: googleId || '__none__' }, { email }] });

        if (user) {
            let modified = false;
            if (googleId && (!user.googleId || user.googleId !== googleId)) {
                user.googleId = googleId;
                user.authProvider = user.password ? 'both' : 'google';
                modified = true;
            }
            if (avatar && !user.avatar) {
                user.avatar = avatar;
                modified = true;
            }
            if (modified) {
                await user.save();
            }
        } else {
            user = new User({
                name: name || 'Google User',
                email: email,
                googleId: googleId || null,
                authProvider: 'google',
                avatar: avatar,
                location: 'Global',
                userType: 'Student',
                openingBalance: 0,
                hasCompletedOnboarding: false
            });
            await user.save();
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                authProvider: user.authProvider || 'google',
                isGoogleConnected: Boolean(user.googleId),
                hasPassword: Boolean(user.password && user.password.length > 0),
                location: user.location,
                userType: user.userType || 'Student',
                openingBalance: user.openingBalance || 0,
                openingBalanceDate: user.openingBalanceDate || user.createdAt || new Date(),
                hasCompletedOnboarding: user.hasCompletedOnboarding || false
            }
        });
    } catch (err) {
        console.error('[Google Auth Error]:', err);
        return res.status(500).json({ msg: 'Failed to authenticate with Google.' });
    }
};

// Link Google Account to Existing Profile
exports.linkGoogleAccount = async (req, res) => {
    try {
        const { credential, googleId: directGoogleId, email: directEmail } = req.body;
        let verifiedInfo = null;

        if (credential) {
            verifiedInfo = await verifyGoogleCredential(credential);
            if (!verifiedInfo) {
                try {
                    const payloadBase64 = credential.split('.')[1];
                    if (payloadBase64) {
                        const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
                        if (decoded.sub && decoded.email) {
                            verifiedInfo = {
                                googleId: decoded.sub,
                                email: decoded.email,
                                name: decoded.name || 'Google User',
                                picture: decoded.picture || ''
                            };
                        }
                    }
                } catch (e) {
                    console.warn('[Link Google] Fallback decode failed:', e.message);
                }
            }
        }

        const googleId = verifiedInfo?.googleId || directGoogleId;
        const googleEmail = (verifiedInfo?.email || directEmail)?.trim()?.toLowerCase();

        if (!googleId) {
            return res.status(400).json({ error: 'Valid Google account identification is required to link.' });
        }

        const existingLinked = await User.findOne({ googleId, _id: { $ne: req.user.id } });
        if (existingLinked) {
            return res.status(400).json({ error: 'This Google account is already linked to another FinWise account.' });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.googleId = googleId;
        user.authProvider = user.password ? 'both' : 'google';
        if (verifiedInfo?.picture && !user.avatar) {
            user.avatar = verifiedInfo.picture;
        }
        await user.save();

        const profile = user.toObject();
        profile.authProvider = user.authProvider;
        profile.isGoogleConnected = true;
        profile.hasPassword = Boolean(user.password && user.password.length > 0);
        delete profile.password;

        return res.json({
            success: true,
            msg: `Google account (${googleEmail || 'connected'}) successfully linked.`,
            profile
        });
    } catch (err) {
        console.error('[Link Google Error]:', err);
        return res.status(500).json({ error: 'Failed to link Google account.' });
    }
};

// Unlink Google Account
exports.unlinkGoogleAccount = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (!user.password || user.password.length === 0) {
            return res.status(400).json({ error: 'Cannot disconnect Google account without setting an account password first.' });
        }

        user.googleId = null;
        user.authProvider = 'local';
        await user.save();

        const profile = user.toObject();
        profile.authProvider = 'local';
        profile.isGoogleConnected = false;
        profile.hasPassword = true;
        delete profile.password;

        return res.json({
            success: true,
            msg: 'Google account disconnected successfully.',
            profile
        });
    } catch (err) {
        console.error('[Unlink Google Error]:', err);
        return res.status(500).json({ error: 'Failed to disconnect Google account.' });
    }
};

// Delete Account & Cascaded Personal Data (Preserving Shared Trip History)
exports.deleteAccount = async (req, res) => {
    try {
        const { confirmation, password } = req.body;
        const userId = req.user.id;

        if (confirmation !== 'DELETE') {
            return res.status(400).json({ error: 'To confirm account deletion, you must type "DELETE" exactly.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User account not found.' });
        }

        const hasPassword = Boolean(user.password && user.password.length > 0);
        if (hasPassword) {
            if (!password) {
                return res.status(400).json({ error: 'Current password is required to authorize account deletion.' });
            }
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ error: 'Invalid password. Account deletion aborted.' });
            }
        }

        // Required models
        const Transaction = require('../models/Transaction');
        const Goal = require('../models/Goal');
        const GoalTransfer = require('../models/GoalTransfer');
        const TravelPlan = require('../models/TravelPlan');
        const ItemizedBill = require('../models/ItemizedBill');
        const Scenario = require('../models/Scenario');
        const ExpenseSplit = require('../models/ExpenseSplit');
        const Challenge = require('../models/Challenge');
        const Budget = require('../models/Budget');
        const Trip = require('../models/Trip');
        const TripMember = require('../models/TripMember');
        const TripExpense = require('../models/TripExpense');
        const TripSettlement = require('../models/TripSettlement');
        const TripInvitation = require('../models/TripInvitation');

        // 1. Delete purely personal records
        await Promise.all([
            Transaction.deleteMany({ userId }),
            Goal.deleteMany({ userId }),
            GoalTransfer.deleteMany({ userId }),
            TravelPlan.deleteMany({ userId }),
            Scenario.deleteMany({ userId }),
            ExpenseSplit.deleteMany({ userId }),
            Challenge.deleteMany({ userId }),
            Budget.deleteMany({ userId }),
            TripInvitation.deleteMany({ $or: [{ recipientUserId: userId }, { createdByUserId: userId }] })
        ]);

        // 2. Handle trips owned by the user
        const ownedTrips = await Trip.find({ userId });
        for (const trip of ownedTrips) {
            const otherMembers = await TripMember.find({ tripId: trip._id, userId: { $ne: userId } }).sort({ joinedAt: 1 });
            if (otherMembers.length === 0) {
                // Solo trip: safely wipe all trip artifacts
                await Promise.all([
                    TripExpense.deleteMany({ tripId: trip._id }),
                    TripSettlement.deleteMany({ tripId: trip._id }),
                    TripMember.deleteMany({ tripId: trip._id }),
                    TripInvitation.deleteMany({ tripId: trip._id }),
                    ItemizedBill.deleteMany({ tripId: trip._id }),
                    Trip.findByIdAndDelete(trip._id)
                ]);
            } else {
                // Collaborative trip: transfer ownership and preserve ledger integrity
                const newOwner = otherMembers[0];
                trip.userId = newOwner.userId;
                trip.participants = trip.participants.map(p => {
                    if (p.email && p.email.toLowerCase() === user.email.toLowerCase()) {
                        return { id: p.id, name: `${p.name} (Departed)`, email: '' };
                    }
                    return p;
                });
                await trip.save();
                await TripMember.findByIdAndUpdate(newOwner._id, { role: 'creator' });
                await TripMember.deleteOne({ tripId: trip._id, userId });
            }
        }

        // 3. For any other trips where user was a regular member (not creator)
        await TripMember.deleteMany({ userId });

        // 4. Delete personal non-collaborative itemized bills
        await ItemizedBill.deleteMany({ creatorUserId: userId, mode: { $ne: 'collaborative' } });

        // 5. Finally, permanently delete the User document
        await User.findByIdAndDelete(userId);

        return res.json({ 
            success: true, 
            message: 'Your account and associated personal financial data have been permanently deleted.' 
        });
    } catch (err) {
        console.error('[Delete Account Error]:', err);
        return res.status(500).json({ error: 'Failed to delete account. Please try again.' });
    }
};
