const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    roomId: { type: String, unique: true, index: true },
    name: { type: String, maxlength: 50 },
    description: { type: String, default: '', maxlength: 500 },
    type: { type: String, enum: ['group', 'channel'] },
    isPublic: { type: Boolean, default: false },
    publicLink: { type: String, lowercase: true, trim: true, match: /^[a-z0-9-]{3,30}$/, index: true, sparse: true },
    owner: { type: String, index: true },
    members: [{ type: String }],
    joinRequests: [{ type: String }],
    avatar: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    copyRestriction: { type: Boolean, default: false },
    autoDeleteTimer: { type: Number, default: 0 },
    forwardRestriction: { type: Boolean, default: false },
    screenshotNotification: { type: Boolean, default: false }
});

RoomSchema.index({ members: 1 });
RoomSchema.index({ members: 1, timestamp: -1 });

module.exports = mongoose.model('Room', RoomSchema);
