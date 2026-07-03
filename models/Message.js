const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    dialog_id: { type: String, index: true },
    sender: { type: String, index: true },
    receiver: { type: String, index: true },
    text: { type: String },
    fileUrl: { type: String, default: null },
    fileUrls: { type: [String], default: [] },
    fileName: { type: String, default: null, maxlength: 255 },
    isAudio: { type: Boolean, default: false },
    isMusic: { type: Boolean, default: false },
    isVideoNote: { type: Boolean, default: false },
    reply_to: { type: String, default: null, maxlength: 300 },
    reply_to_id: { type: String, default: null, maxlength: 100, index: true },
    is_read: { type: Boolean, default: false },
    read_by: [{ type: String }],
    is_edited: { type: Boolean, default: false },
    expires_at: { type: Date, default: null },
    isService: { type: Boolean, default: false },
    callType: { type: String, default: null },
    callDuration: { type: Number, default: 0 },
    callWithVideo: { type: Boolean, default: false },
    tempId: { type: String, default: null, maxlength: 100 },
    last_notified: { type: Date },
    timestamp: { type: Date, default: Date.now, index: true }
});

MessageSchema.index({ dialog_id: 1, timestamp: -1 });
MessageSchema.index({ receiver: 1, is_read: 1 });
MessageSchema.index({ receiver: 1, timestamp: -1 });
MessageSchema.index({ receiver: 1, read_by: 1 });
MessageSchema.index({ receiver: 1, isService: 1, timestamp: -1 });
MessageSchema.index({ sender: 1, receiver: 1 });
MessageSchema.index({ dialog_id: 1, isService: 1, timestamp: -1 });
MessageSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Message', MessageSchema);
