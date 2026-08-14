const User = require('../models/User');
const Message = require('../models/Message');
const Dialog = require('../models/Dialog');
const Room = require('../models/Room');
const { obscure } = require('../utils/crypto');
const { getDialogId } = require('../utils/dialog');
const { st } = require('../constants/translations');
const { getIO } = require('../socket/io');
const { sendPushNotification } = require('./push');

const broadcastSystemAction = async (sender, receiver, actionText) => {
    try {
        const io = getIO();
        const user = await User.findOne({ username: sender }).lean();
        const name = user?.displayName || sender;
        const finalText = `${name} ${actionText}`;
        const hiddenText = obscure(finalText);

        let dialogId = null;
        let targets = [];
        if (receiver.startsWith('room_')) {
            dialogId = receiver;
            const room = await Room.findOne({ roomId: receiver }).lean();
            if (room) targets = room.members;
        } else {
            dialogId = getDialogId(sender, receiver);
            targets = [sender, receiver];
        }

        const newMsgDoc = await Message.create({
            dialog_id: dialogId,
            sender: sender,
            receiver: receiver,
            text: hiddenText,
            isService: true,
            is_read: true,
            timestamp: new Date()
        });

        const msgData = {
            id: newMsgDoc._id.toString(),
            sender: sender,
            receiver: receiver,
            text: finalText,
            timestamp: newMsgDoc.timestamp,
            isVerified: user?.isVerified || false,
            isService: true,
            is_read: true,
            displayName: name,
            senderAvatar: user?.avatar || null
        };

        targets.forEach(m => {
            io.to(m).emit('new_message', msgData);
        });

        if (receiver.startsWith('room_')) {
            await Room.updateOne({ roomId: receiver }, { $set: { timestamp: newMsgDoc.timestamp } });
        } else {
            await Dialog.findOneAndUpdate(
                { dialog_id: dialogId },
                {
                    $set: {
                        participants: [sender, receiver],
                        lastMessageTimestamp: newMsgDoc.timestamp
                    }
                },
                { upsert: true }
            );
        }

        targets.forEach(m => {
            io.to(m).emit('update_chat_list');
        });
    } catch (e) { }
};

const sendLoginNotification = async (username, device, ip, lang = 'ru') => {
    try {
        const io = getIO();
        const systemUser = "4send_system";
        const text = `⚠️ ${st('Новый вход в аккаунт', lang)}\n\n${st('Устройство:', lang)} ${device}\n${st('IP-адрес:', lang)} ${ip}\n${st('Время:', lang)} ${new Date().toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU')}\n\n${st('Если это были не вы, немедленно завершите сеанс в Настройки -> Конфиденциальность -> Активные сеансы и измените пароль.', lang)}`;
        const hiddenText = obscure(text);
        const dialogId = getDialogId(systemUser, username);

        const newMsgDoc = await Message.create({
            dialog_id: dialogId,
            sender: systemUser,
            receiver: username,
            text: hiddenText,
            is_read: false,
            read_by: [systemUser],
            timestamp: new Date()
        });

        await Dialog.findOneAndUpdate(
            { dialog_id: dialogId },
            {
                $set: {
                    participants: [systemUser, username],
                    lastMessageText: hiddenText,
                    lastSender: systemUser,
                    lastMessageTimestamp: newMsgDoc.timestamp,
                    lastIsAudio: false,
                    lastIsMusic: false,
                    lastIsVideoNote: false,
                    lastFileUrl: null,
                    lastFileName: null
                },
                $inc: { [`unreadCounts.${username}`]: 1 }
            },
            { upsert: true, new: true }
        );

        const msgData = {
            id: newMsgDoc._id.toString(),
            sender: systemUser,
            receiver: username,
            text: text,
            timestamp: newMsgDoc.timestamp,
            isVerified: true,
            is_read: false,
            displayName: st('Системные уведомления', 'ru')
        };

        if (io) {
            io.to(username).emit('new_message', msgData);
            io.to(username).emit('update_chat_list');
        }
    } catch (err) {}
};

const sendInternalNotification = async (text) => {
    try {
        const io = getIO();
        const systemUser = "4send_system";
        const admins = await User.find({ role: 'admin' }).lean();
        if (!admins.length) return;

        const hiddenText = obscure(text);
        const timestamp = new Date();

        for (const adminUser of admins) {
            const adminName = adminUser.username;
            const dialogId = getDialogId(systemUser, adminName);

            const newMsgDoc = await Message.create({
                dialog_id: dialogId,
                sender: systemUser,
                receiver: adminName,
                text: hiddenText,
                is_read: false,
                read_by: [systemUser],
                timestamp: timestamp
            });

            await Dialog.findOneAndUpdate(
                { dialog_id: dialogId },
                {
                    $set: {
                        participants: [systemUser, adminName],
                        lastMessageText: hiddenText,
                        lastSender: systemUser,
                        lastMessageTimestamp: timestamp,
                        lastIsAudio: false,
                        lastIsMusic: false,
                        lastIsVideoNote: false,
                        lastFileUrl: null,
                        lastFileName: null
                    },
                    $inc: { [`unreadCounts.${adminName}`]: 1 }
                },
                { upsert: true, new: true }
            );

            const msgData = {
                id: newMsgDoc._id.toString(),
                sender: systemUser,
                receiver: adminName,
                text: text,
                timestamp: timestamp,
                isVerified: true,
                is_read: false,
                displayName: st('Системные уведомления', 'ru')
            };

            if (io) {
                io.to(adminName).emit('new_message', msgData);
                io.to(adminName).emit('update_chat_list');
            }

            await sendPushNotification(adminName, {
                notification: { title: st('Системное уведомление', 'ru'), body: text.substring(0, 60) + '...' },
                android: { notification: { channelId: '4send_channel', priority: 'high', sound: 'default', icon: '/ico.png' } },
                webpush: { notification: { icon: '/ico.png', badge: '/ico.png' } }
            });
        }
    } catch (err) {}
};

module.exports = { broadcastSystemAction, sendLoginNotification, sendInternalNotification };
