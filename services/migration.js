const User = require('../models/User');
const Message = require('../models/Message');
const Dialog = require('../models/Dialog');
const { logError } = require('../utils/logger');

const runMigration = async () => {
    try {
        const needsMigration = await Message.exists({ dialog_id: { $exists: false }, receiver: { $not: /^room_/ } });
        if (!needsMigration) return;
        const messagesWithoutDialogId = await Message.find({
            dialog_id: { $exists: false },
            receiver: { $not: /^room_/ }
        }).lean();

        const bulkOps = [];
        for (const msg of messagesWithoutDialogId) {
            const dialogId = [String(msg.sender).toLowerCase(), String(msg.receiver).toLowerCase()].sort().join('_');
            bulkOps.push({
                updateOne: {
                    filter: { _id: msg._id },
                    update: { $set: { dialog_id: dialogId } }
                }
            });

            if (bulkOps.length === 1000) {
                await Message.bulkWrite(bulkOps);
                bulkOps.length = 0;
            }
        }
        if (bulkOps.length > 0) {
            await Message.bulkWrite(bulkOps);
        }

        const latestMessages = await Message.aggregate([
            { $match: { receiver: { $not: /^room_/ }, dialog_id: { $exists: true } } },
            { $sort: { timestamp: -1 } },
            { $group: {
                _id: "$dialog_id",
                lastMsg: { $first: "$$ROOT" }
            }}
        ]);

        for (const group of latestMessages) {
            const msg = group.lastMsg;
            const u1 = msg.sender.toLowerCase();
            const u2 = msg.receiver.toLowerCase();

            const unreadU1 = await Message.countDocuments({ dialog_id: msg.dialog_id, receiver: u1, is_read: false });
            const unreadU2 = await Message.countDocuments({ dialog_id: msg.dialog_id, receiver: u2, is_read: false });

            await Dialog.findOneAndUpdate(
                { dialog_id: msg.dialog_id },
                {
                    $set: {
                        participants: [u1, u2],
                        lastMessageText: msg.text,
                        lastSender: msg.sender,
                        lastMessageTimestamp: msg.timestamp,
                        lastIsAudio: msg.isAudio || false,
                        lastIsMusic: msg.isMusic || false,
                        lastIsVideoNote: msg.isVideoNote || false,
                        lastFileUrl: msg.fileUrl || null,
                        lastFileName: msg.fileName || null,
                        [`unreadCounts.${u1}`]: unreadU1,
                        [`unreadCounts.${u2}`]: unreadU2
                    }
                },
                { upsert: true }
            );
        }
    } catch (err) {}
};

if (!global.privacyMap) global.privacyMap = new Map();

const dedupPins = async () => {
    try {
        const Pin = require('../models/Pin');
        await Pin.updateMany({ pin_type: 'self' }, { $set: { pin_type: 'me' } });

        const dupes = await Pin.aggregate([
            { $sort: { timestamp: -1 } },
            { $group: {
                _id: { m: '$message_id', c: '$chat_id', p: '$pinner_id' },
                ids: { $push: '$_id' },
                n: { $sum: 1 }
            } },
            { $match: { n: { $gt: 1 } } }
        ]);
        const toDelete = [];
        for (const d of dupes) toDelete.push(...d.ids.slice(1));
        for (let i = 0; i < toDelete.length; i += 500) {
            await Pin.deleteMany({ _id: { $in: toDelete.slice(i, i + 500) } });
        }
        await Pin.syncIndexes();
    } catch (err) {
        logError('dedup_pins', err);
    }
};

const loadPrivacyMap = async () => {
    try {
        const users = await User.find({ privacy: { $exists: true, $ne: '{}' } }).select('username privacy').lean();
        users.forEach(u => {
            try { global.privacyMap.set(u.username.toLowerCase(), JSON.parse(u.privacy)); } catch (e) {}
        });
    } catch (err) { logError('privacy_load', err); }
};

module.exports = { runMigration, loadPrivacyMap, dedupPins };
