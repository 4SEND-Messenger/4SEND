const User = require('../models/User');
const admin = require('../config/firebase');

const TOKEN_ERRORS = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/argument-incorrect'
]);

const sendPushNotification = async (username, message) => {
    try {
        if (typeof admin.messaging !== 'function') return;
        const user = await User.findOne({ username }).lean();
        if (!user || !user.pushToken) return;
        await admin.messaging().send({ ...message, token: user.pushToken });
    } catch (err) {
        const code = err && err.code;
        if (TOKEN_ERRORS.has(code)) {
            await User.updateOne({ username }, { $unset: { pushToken: 1 } }).catch(() => {});
        } else {
            console.error('[push] send to', username, 'failed:', code || (err && err.message) || err);
        }
    }
};

module.exports = { sendPushNotification };
