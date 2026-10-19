const ExpenseSplit = require('../models/ExpenseSplit');

const roundMoney = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;

exports.createExpenseSplit = async (req, res) => {
    try {
        const { description, amount, splitMethod, friends } = req.body;
        const totalAmount = Number(amount);
        if (!description?.trim() || !Number.isFinite(totalAmount) || totalAmount <= 0 || !['equal', 'custom'].includes(splitMethod) || !Array.isArray(friends) || !friends.length) {
            return res.status(400).json({ error: 'Provide a description, positive amount, method, and at least one friend.' });
        }
        const cleanFriends = friends.map((friend) => ({ name: String(friend.name || '').trim(), amountOwed: Number(friend.amountOwed) }));
        if (cleanFriends.some((friend) => !friend.name)) return res.status(400).json({ error: 'Every friend needs a name.' });

        if (splitMethod === 'equal') {
            // The payer is included in the equal share. Friends each owe one equal share to the payer.
            const share = roundMoney(totalAmount / (cleanFriends.length + 1));
            cleanFriends.forEach((friend, index) => { friend.amountOwed = index === cleanFriends.length - 1 ? roundMoney(totalAmount - share * cleanFriends.length) : share; });
        } else {
            if (cleanFriends.some((friend) => !Number.isFinite(friend.amountOwed) || friend.amountOwed <= 0)) return res.status(400).json({ error: 'Custom shares must be valid positive amounts.' });
            const owed = roundMoney(cleanFriends.reduce((total, friend) => total + friend.amountOwed, 0));
            if (owed > totalAmount) return res.status(400).json({ error: 'Friends cannot owe more than the total expense.' });
        }

        const split = await ExpenseSplit.create({ userId: req.user.id, description: description.trim(), totalAmount, splitMethod, friends: cleanFriends });
        res.status(201).json({ ...split.toObject(), settlements: cleanFriends.map((friend) => ({ from: friend.name, to: 'You', amount: friend.amountOwed })) });
    } catch (error) {
        console.error('Expense split create error:', error.message);
        res.status(500).json({ error: 'Unable to save the expense split.' });
    }
};

exports.getExpenseSplits = async (req, res) => {
    try { res.json(await ExpenseSplit.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20)); }
    catch (error) { console.error('Expense split load error:', error.message); res.status(500).json({ error: 'Unable to load expense splits.' }); }
};
