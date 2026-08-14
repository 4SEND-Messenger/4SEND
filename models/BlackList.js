const mongoose = require('mongoose');

const BlackListSchema = new mongoose.Schema({
    user_id: { type: String, index: true },
    blocked_id: { type: String, index: true }
});

BlackListSchema.index({ user_id: 1, blocked_id: 1 }, { unique: true });

module.exports = mongoose.model('BlackList', BlackListSchema);
