const mongoose = require('mongoose');

const PinSchema = new mongoose.Schema({
    message_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    chat_id: { type: String, index: true },
    pinner_id: { type: String },
    pin_type: { type: String, enum: ['both', 'me', 'self'], default: 'both' },
    text_preview: { type: String },
    timestamp: { type: Date, default: Date.now }
});

PinSchema.index({ chat_id: 1, pinner_id: 1 });
PinSchema.index({ message_id: 1, chat_id: 1, pinner_id: 1 }, { unique: true });

module.exports = mongoose.model('Pin', PinSchema);
