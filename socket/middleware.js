const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../config/env');
const { checkServerPrivacy } = require('../middleware/privacyWrapper');
const { st, detectLang } = require('../constants/translations');
const { shouldUpdateLastActive } = require('../utils/lastActive');

const socketAuthMiddleware = (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || !JWT_SECRET) return next(new Error('Authentication error'));
    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err || !decoded || typeof decoded.username !== 'string') return next(new Error('Authentication error'));
        try {
            const username = decoded.username.trim().toLowerCase();
            if (!/^[a-z]{4,20}$/.test(username)) return next(new Error('Authentication error'));
            const user = await User.findOne({ username }).lean();
            if (!user || user.role === 'banned') return next(new Error('Banned'));
            const isValid = Array.isArray(user.sessions) && user.sessions.some(s => s && s.token === token);
            if (!isValid) return next(new Error('Authentication error'));
            socket.username = username;
            socket.userTokenData = { ...decoded, username, role: user.role };
            socket.authToken = token;
            if (shouldUpdateLastActive(username, token)) {
                await User.updateOne(
                    { username, "sessions.token": token },
                    { $set: { "sessions.$.lastActive": new Date() } }
                );
            }
            next();
        } catch {
            next(new Error('Server error'));
        }
    });
};

const socketPrivacyMiddleware = (socket, next) => {
    socket.on('request_privacy_sync', () => {
        const own = global.privacyMap.get(socket.username);
        socket.emit('privacy_sync', own ? { [socket.username]: own } : {});
    });

    socket.use((packet, nextEvent) => {
        const eventName = packet[0];
        const data = packet[1];

        if (data && typeof data === 'object' && socket.username && eventName !== 'mark_read') {
            data.sender = socket.username;
        }

        if (eventName === 'chat_message' && data && data.receiver && !String(data.receiver).startsWith('room_')) {
            const canMessage = checkServerPrivacy(data.receiver, socket.username, 'messages');
            const isMedia = data.isAudio || data.isVideoNote;
            const canMedia = checkServerPrivacy(data.receiver, socket.username, 'voice_video');

            if (!canMessage) return socket.emit('error_message', { text: st('Отправка сообщений ограничена настройками приватности.', detectLang(socket)), tempId: data.tempId || null });
            if (isMedia && !canMedia) return socket.emit('error_message', { text: st('Отправка медиа ограничена настройками приватности.', detectLang(socket)), tempId: data.tempId || null });
        }

        if (eventName === 'typing' && data && data.receiver && !String(data.receiver).startsWith('room_')) {
            if (!checkServerPrivacy(data.receiver, socket.username, 'status')) return nextEvent(new Error('Privacy: Status disabled'));
        }

        nextEvent();
    });

    const origEmit = socket.emit;
    socket.emit = function(event, ...args) {
        if (event === 'online_list' && socket.username) {
            let list = args[0];
            if (Array.isArray(list)) {
                list = list.filter(u => checkServerPrivacy(u, socket.username, 'status'));
                args[0] = list;
            }
        }
        return origEmit.apply(socket, [event, ...args]);
    };

    next();
};

module.exports = { socketAuthMiddleware, socketPrivacyMiddleware };
