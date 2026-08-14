const mongoose = require('mongoose');

const PreKeySchema = new mongoose.Schema({
    username: { type: String, unique: true, index: true, lowercase: true },
    identityKey: { type: String, required: true },
    signingPublicKey: { type: String },
    signedPreKey: {
        keyId: { type: Number, required: true },
        publicKey: { type: String, required: true },
        signature: { type: String, required: true },
    },
    oneTimePreKeys: [{
        keyId: { type: Number },
        publicKey: { type: String },
        used: { type: Boolean, default: false },
    }],
    version: { type: Number, default: 1 },
    updatedAt: { type: Date, default: Date.now },
}, { collection: 'prekeys' });

PreKeySchema.index({ 'oneTimePreKeys.used': 1 });

module.exports = mongoose.model('PreKey', PreKeySchema);