const crypto = require('crypto');
const { ENCRYPTION_KEY } = require('../config/env');

const decodeMsg = (str) => Buffer.from(str, 'base64').toString('utf-8');

const clarify = (encoded) => {
    if (!encoded || typeof encoded !== 'string') return "";

    if (encoded.startsWith("4S_ENC_")) {
        try {
            const parts = encoded.replace("4S_ENC_", "").split(":");
            if (parts.length !== 3) return "";
            const iv = Buffer.from(parts[0], 'hex');
            const authTag = Buffer.from(parts[1], 'hex');
            const encryptedText = Buffer.from(parts[2], 'hex');
            const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch { return ""; }
    }

    if (encoded.startsWith("4S_")) {
        try {
            const decoded = Buffer.from(encoded.replace("4S_", ""), 'base64').toString('utf8');
            return decoded.includes("||") ? decoded.split("||")[0] : decoded;
        } catch { return encoded; }
    }

    return encoded;
};

const obscure = (text) => {
    if (!text) return "";
    try {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return `4S_ENC_${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch {
        throw new Error('Encryption failed');
    }
};

module.exports = { decodeMsg, clarify, obscure };
