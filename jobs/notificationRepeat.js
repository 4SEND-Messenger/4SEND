const User = require('../models/User');
const Message = require('../models/Message');
const { sendPushNotification } = require('../services/push');
const { st } = require('../constants/translations');

const startNotificationRepeatJob = () => {
    setInterval(async () => {
        try {
            const now = new Date();
            const users = await User.find({ notificationRepeat: { $gt: 0 }, pushToken: { $ne: null } }).lean();

            for (const u of users) {
                const repeatMs = u.notificationRepeat * 60000;
                const cutoff = new Date(now.getTime() - repeatMs);

                const unreadMsgs = await Message.find({
                    receiver: u.username,
                    is_read: false,
                    timestamp: { $lte: cutoff },
                    $or: [
                        { last_notified: { $exists: false } },
                        { last_notified: { $lte: cutoff } }
                    ]
                }).lean();

                if (unreadMsgs.length > 0) {
                    const msgIds = unreadMsgs.map(m => m._id);
                    await Message.updateMany({ _id: { $in: msgIds } }, { $set: { last_notified: now } });

                    await sendPushNotification(u.username, {
                        notification: { title: st('У вас есть непрочитанные сообщения', 'ru'), body: `${st('Непрочитанных сообщений:', 'ru')} ${unreadMsgs.length}` },
                        android: { notification: { channelId: '4send_channel', priority: 'high', sound: 'default', icon: '/ico.png', tag: 'unread_reminder' } },
                        apns: { payload: { aps: { sound: 'default', badge: unreadMsgs.length, 'thread-id': 'unread_reminder' } } }
                    });
                }
            }
        } catch (err) {}
    }, 60000);
};

module.exports = { startNotificationRepeatJob };
