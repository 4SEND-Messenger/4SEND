const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, index: true },
    displayName: { type: String, default: '', maxlength: 30, match: /^[a-zA-Z]{0,30}$/ },
    bio: { type: String, default: '', maxlength: 100 },
    password: { type: String },
    twoFactorPassword: { type: String, default: null },
    panicPassword: { type: String, default: null },
    avatar: { type: String, default: null },
    last_seen: { type: Date, default: Date.now },
    pushToken: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    role: { type: String, default: 'user', enum: ['user', 'admin', 'banned'] },
    privacy: { type: String, default: '{}' },
    autoDeleteMonths: { type: Number, default: 6 },
    autoLogoutDays: { type: Number, default: 7 },
    archivePassword: { type: String, default: null },
    notificationRepeat: { type: Number, default: 5 },
    sessions: [{ token: String, device: String, ip: String, lastActive: { type: Date, default: Date.now } }]
}, { collection: 'users' });

module.exports = mongoose.model('User', UserSchema);
