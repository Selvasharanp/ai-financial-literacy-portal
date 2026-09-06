const mongoose = require('mongoose');

const LiteracyContentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String, required: true }, // Matches transaction categories
    tags: [String],
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'] }
});

module.exports = mongoose.model('LiteracyContent', LiteracyContentSchema);