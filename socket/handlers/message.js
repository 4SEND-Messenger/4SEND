const User = require('../../models/User');
const Message = require('../../models/Message');
const Dialog = require('../../models/Dialog');
const Room = require('../../models/Room');
const { getDialogId, updateDialogLastMessage } = require('../../utils/dialog');
const { obscure } = require('../../utils/crypto');
const { st, detectLang } = require('../../constants/translations');
const { getIO } = require('../io');
const { sendPushNotification } = require('../../services/push');
const { handleHelpBotReply } = require('./help');

const handleChatMessage = async (socket, data) => {
    try {
        const s = socket.username;
        const r = data.receiver ? String(data.receiver).trim().toLowerCase() : null;
        if (!s || !r) return socket.emit('error_message', { text: st('Некорректные данные получателя.', detectLang(socket)), tempId: data.tempId || null });

        const txt = data.text || '';
        if (txt.length > 1000) return socket.emit('error_message', { text: st("Превышен лимит символов (1000).", detectLang(socket)) });

        let safeFileUrl = data.fileUrl || '';
        if (safeFileUrl && !safeFileUrl.startsWith('http://') && !safeFileUrl.startsWith('https://') && safeFileUrl !== 'dummy') {
            safeFileUrl = '';
        }
        data.fileUrl = safeFileUrl;

        const hiddenText = obscure(txt);

        let chatAutoDeleteTimer = 0;
        if (r.startsWith('room_')) {
            const room = await Room.findOne({ roomId: r }).lean();
            if (room) chatAutoDeleteTimer = room.autoDeleteTimer || 0;
        } else {
            const dialogId = getDialogId(s, r);
            const dialog = await Dialog.findOne({ dialog_id: dialogId }).lean();
            if (dialog) chatAutoDeleteTimer = dialog.autoDeleteTimer || 0;
        }

        let expiryDate = null;
        const parsedExpiresAt = parseInt(data.expires_at);
        let finalExpirySeconds = 0;
        if (!isNaN(parsedExpiresAt) && parsedExpiresAt > 0) {
            finalExpirySeconds = parsedExpiresAt;
        } else if (chatAutoDeleteTimer > 0) {
            finalExpirySeconds = chatAutoDeleteTimer;
        }

        if (finalExpirySeconds > 0) {
            const maxExpiry = 365 * 24 * 60 * 60;
            const safeExpiry = Math.min(finalExpirySeconds, maxExpiry);
            expiryDate = new Date(Date.now() + safeExpiry * 1000);
        }

        const safeReplyId = data.reply_to_id?.startsWith('4S_') ? null : data.reply_to_id;

        const io = getIO();

        if (r.startsWith('room_')) {
            const room = await Room.findOne({ roomId: r }).lean();
            if (!room || !room.members.includes(s)) return socket.emit('error_message', { text: st('Комната недоступна.', detectLang(socket)), tempId: data.tempId || null });
            if (room.type === 'channel' && room.owner !== s) return socket.emit('error_message', { text: st("Только создатель может писать в канал.", detectLang(socket)) });

            const newMsgDoc = await Message.create({
                sender: s, receiver: r, text: hiddenText, fileUrl: data.fileUrl || '',
                fileUrls: data.fileUrls || [],
                fileName: data.fileName || null,
                isAudio: data.isAudio || false, isMusic: data.isMusic || false, isVideoNote: data.isVideoNote || false,
                reply_to: data.reply_to || null, reply_to_id: safeReplyId,
                expires_at: expiryDate, is_read: false, read_by: [s],
                tempId: data.tempId || null,
                timestamp: new Date()
            });

            await Room.updateOne({ roomId: r }, { $set: { timestamp: newMsgDoc.timestamp } });

            const senderUser = await User.findOne({ username: s }).lean();
            const finalData = {
                ...data, id: newMsgDoc._id.toString(), sender: s, receiver: r, text: txt,
                fileUrl: newMsgDoc.fileUrl, fileUrls: newMsgDoc.fileUrls, isAudio: newMsgDoc.isAudio, isMusic: newMsgDoc.isMusic, isVideoNote: newMsgDoc.isVideoNote,
                reply_to_id: safeReplyId, timestamp: newMsgDoc.timestamp, isVerified: senderUser?.isVerified || false,
                expires_at: newMsgDoc.expires_at, senderAvatar: senderUser?.avatar || null, is_read: false,
                displayName: senderUser?.displayName || s
            };

            room.members.forEach(member => {
                if (member !== s) {
                    socket.to(member).emit('new_message', finalData);
                    io.to(member).emit('update_chat_list');
                }
            });
            socket.emit('new_message', { ...finalData, isSelf: true });
            io.to(s).emit('update_chat_list');

            if (expiryDate) {
                const delay = expiryDate.getTime() - Date.now();
                if (delay > 0 && delay <= 2147483647) {
                    setTimeout(async () => {
                        await Message.deleteOne({ _id: newMsgDoc._id });
                        room.members.forEach(m => io.to(m).emit('msg_deleted', newMsgDoc._id.toString()));
                    }, delay);
                }
            }
            return;
        }

        const BlackList = require('../../models/BlackList');
        const isBlocked = await BlackList.findOne({ $or: [{ user_id: r, blocked_id: s }, { user_id: s, blocked_id: r }] }).lean();
        if (isBlocked) return socket.emit('error_message', { text: st("Отправка сообщений ограничена.", detectLang(socket)) });

        const targetExists = await User.findOne({ username: r }).lean();
        if (!targetExists) return socket.emit('error_message', { text: st("Пользователь не найден.", detectLang(socket)) });

        const dialogId = getDialogId(s, r);

        const newMsgDoc = await Message.create({
            dialog_id: dialogId,
            sender: s, receiver: r, text: hiddenText, fileUrl: data.fileUrl || '',
            fileUrls: data.fileUrls || [],
            fileName: data.fileName || null,
            isAudio: data.isAudio || false, isMusic: data.isMusic || false, isVideoNote: data.isVideoNote || false,
            reply_to: data.reply_to || null, reply_to_id: safeReplyId,
            expires_at: expiryDate, is_read: false, read_by: [s],
            tempId: data.tempId || null,
            timestamp: new Date()
        });

        await Dialog.findOneAndUpdate(
            { dialog_id: dialogId },
            {
                $set: {
                    participants: [s, r],
                    lastMessageText: hiddenText,
                    lastSender: s,
                    lastMessageTimestamp: newMsgDoc.timestamp,
                    lastIsAudio: newMsgDoc.isAudio,
                    lastIsMusic: newMsgDoc.isMusic,
                    lastIsVideoNote: newMsgDoc.isVideoNote,
                    lastFileUrl: newMsgDoc.fileUrls && newMsgDoc.fileUrls.length > 0 ? newMsgDoc.fileUrls[0] : newMsgDoc.fileUrl,
                    lastFileName: newMsgDoc.fileName
                },
                $unset: { lastCallType: '', lastCallDuration: '', lastCallWithVideo: '' },
                $inc: { [`unreadCounts.${r}`]: 1 }
            },
            { upsert: true, new: true }
        );

        const senderUser = await User.findOne({ username: s }).lean();
        const finalData = {
            ...data, id: newMsgDoc._id.toString(), sender: s, receiver: r, text: txt,
            fileUrl: newMsgDoc.fileUrl, fileUrls: newMsgDoc.fileUrls, isAudio: newMsgDoc.isAudio, isMusic: newMsgDoc.isMusic, isVideoNote: newMsgDoc.isVideoNote,
            reply_to_id: safeReplyId, timestamp: newMsgDoc.timestamp, isVerified: senderUser?.isVerified || false,
            expires_at: newMsgDoc.expires_at, senderAvatar: senderUser?.avatar || null, is_read: false,
            displayName: senderUser?.displayName || s
        };

        socket.to(r).emit('new_message', finalData);
        socket.emit('new_message', { ...finalData, isSelf: true });
        io.to(r).to(s).emit('update_chat_list');

        if (r === '4send_help') {
            handleHelpBotReply(s, txt, dialogId, detectLang(socket));
        }

        if (expiryDate) {
            const delay = expiryDate.getTime() - Date.now();
            if (delay > 0 && delay <= 2147483647) {
                setTimeout(async () => {
                    await Message.deleteOne({ _id: newMsgDoc._id });
                    await updateDialogLastMessage(dialogId);
                    io.to(r).to(s).emit('msg_deleted', newMsgDoc._id.toString());
                }, delay);
            }
        }

        const targetUser = await User.findOne({ username: r }).lean();
        if (targetUser?.pushToken && s !== r) {
            let pushBody = txt;
            if (data.fileUrl || (data.fileUrls && data.fileUrls.length > 0)) {
                let mediaType = st("📁 Файл", detectLang(socket));
                if (data.isVideoNote) mediaType = st("📹 Видеосообщение", detectLang(socket));
                else if (data.isAudio) mediaType = st("🎤 Голосовое сообщение", detectLang(socket));
                else if (data.isMusic || (data.fileUrl && data.fileUrl.toLowerCase().includes('.mp3'))) mediaType = st("🎵 Аудиозапись", detectLang(socket));
                else if (data.fileUrls && data.fileUrls.length > 1) mediaType = st("📷 Фотографии", detectLang(socket));
                else {
                    const extMatch = data.fileUrl.match(/\.([^.?#]+)(?:[?#]|$)/i);
                    const ext = extMatch ? extMatch[1].toLowerCase() : '';
                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) mediaType = st("📷 Фотография", detectLang(socket));
                    else if (['mp4', 'webm', 'mov'].includes(ext)) mediaType = st("📹 Видео", detectLang(socket));
                }

                if (!txt || txt === data.fileName || txt === "📹 Видеосообщение" || txt === "🎤 Голосовое сообщение" || txt === "Video message" || txt === "Voice message") {
                    pushBody = mediaType;
                } else {
                    pushBody = `${mediaType}: ${txt}`;
                }
            }
            pushBody = pushBody.length > 60 ? pushBody.substring(0, 60) + '...' : pushBody;

            const message = {
                notification: {
                    title: senderUser?.displayName || s,
                    body: pushBody
                },
                android: {
                    notification: { channelId: '4send_channel', priority: 'high', sound: 'default', icon: '/ico.png' }
                },
                apns: {
                    payload: {
                        aps: { sound: 'default', badge: 1 }
                    }
                },
                webpush: {
                    notification: {
                        icon: '/ico.png',
                        badge: '/ico.png'
                    }
                }
            };

            await sendPushNotification(r, message);
        }
    } catch (e) {
        try { socket.emit('error_message', { text: st('Ошибка отправки сообщения.', detectLang(socket)), tempId: data.tempId || null }); } catch {}
    }
};

module.exports = { handleChatMessage };
