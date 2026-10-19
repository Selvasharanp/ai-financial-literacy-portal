const express = require('express');
const router = express.Router();
const { 
    register, 
    login, 
    googleAuth,
    linkGoogleAccount,
    unlinkGoogleAccount,
    deleteAccount,
    getProfile, 
    updateProfile, 
    detectLocation, 
    completeOnboarding 
} = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/link-google', auth, linkGoogleAccount);
router.post('/unlink-google', auth, unlinkGoogleAccount);
router.delete('/delete-account', auth, deleteAccount);
router.delete('/account', auth, deleteAccount);
router.post('/onboarding', auth, completeOnboarding);
router.put('/onboarding', auth, completeOnboarding);
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.post('/detect-location', auth, detectLocation);

module.exports = router;
