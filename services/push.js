const User = require('../models/User');
const admin = require('../config/firebase');

const sendPushNotification = async (username, message) => {
    try {
        if (typeof admin.messaging !== 'function') return;
        const user = await User.findOne({ username }).lean();
        if (!user || !user.pushToken) return;
        await admin.messaging().send({ ...message, token: user.pushToken });
    } catch (err) {
        if (err.code === 'messaging/registration-token-not-registered') {
            await User.updateOne({ username }, { $unset: { pushToken: 1 } }).catch(() => {});
        }
    }
};

module.exports = { sendPushNotification };
