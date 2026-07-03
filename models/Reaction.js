const mongoose = require('mongoose');

const ReactionSchema = new mongoose.Schema({
    message_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', index: true },
    user: { type: String },
    emoji: { type: String }
});

ReactionSchema.index({ message_id: 1, user: 1 });

module.exports = mongoose.model('Reaction', ReactionSchema);
