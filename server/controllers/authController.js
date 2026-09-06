const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register User
exports.register = async (req, res) => {
    try {
        const { name, email, password, location } = req.body;

        // Check if user exists
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'User already exists' });

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create User
        user = new User({ name, email, password: hashedPassword, location });
        await user.save();

        // Create JWT
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user._id, name, email, location: user.location } });

    } catch (err) {
        res.status(500).send('Server Error');
    }
};

// Login User
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user._id, name: user.name, email, location: user.location } });

    } catch (err) {
        res.status(500).send('Server Error');
    }
};

exports.getProfile = async (req, res) => {
    const user = await User.findById(req.user.id).select('name email location');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
};

exports.updateProfile = async (req, res) => {
    const { name, location } = req.body;
    if (!name?.trim() || !location?.trim()) return res.status(400).json({ error: 'Name and city are required.' });
    const user = await User.findByIdAndUpdate(req.user.id, { name: name.trim(), location: location.trim() }, { new: true }).select('name email location');
    res.json(user);
};
