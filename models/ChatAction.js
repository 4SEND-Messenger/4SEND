const mongoose = require('mongoose');

const ActionSchema = new mongoose.Schema({
    user: { type: String, index: true },
    contact: { type: String, index: true },
    type: { type: String, enum: ['pin', 'archive', 'mute'] }
});

ActionSchema.index({ user: 1, contact: 1 });
ActionSchema.index({ user: 1, contact: 1, type: 1 });

module.exports = mongoose.model('ChatAction', ActionSchema);
