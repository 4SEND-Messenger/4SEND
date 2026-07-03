const mongoose = require('mongoose');

const DialogSchema = new mongoose.Schema({
    dialog_id: { type: String, unique: true, index: true },
    participants: [{ type: String, index: true }],
    lastMessageText: { type: String },
    lastSender: { type: String },
    lastMessageTimestamp: { type: Date, index: true },
    unreadCounts: { type: Map, of: Number, default: {} },
    lastIsAudio: { type: Boolean, default: false },
    lastIsMusic: { type: Boolean, default: false },
    lastIsVideoNote: { type: Boolean, default: false },
    lastFileUrl: { type: String, default: null },
    lastFileName: { type: String, default: null },
    copyRestriction: { type: Boolean, default: false },
    autoDeleteTimer: { type: Number, default: 0 },
    forwardRestriction: { type: Boolean, default: false },
    lastCallType: { type: String, default: null },
    lastCallDuration: { type: Number, default: 0 },
    lastCallWithVideo: { type: Boolean, default: false },
    screenshotNotification: { type: Boolean, default: false }
});

DialogSchema.index({ participants: 1, lastMessageTimestamp: -1 });

module.exports = mongoose.model('Dialog', DialogSchema);
