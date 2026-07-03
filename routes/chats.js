const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticateToken } = require('../middleware/authenticateToken');
const User = require('../models/User');
const Message = require('../models/Message');
const Dialog = require('../models/Dialog');
const Room = require('../models/Room');
const { getDialogId } = require('../utils/dialog');
const { clarify } = require('../utils/crypto');
const { escapeRegex } = require('../utils/escapeRegex');
const { checkServerPrivacy } = require('../middleware/privacyWrapper');
const { st, detectLangReq } = require('../constants/translations');

router.get('/history/:u1/:u2', authenticateToken, async (req, res) => {
    const { u1, u2 } = req.params;
    const requester = req.user.username.toLowerCase();

    if (requester !== u1.toLowerCase() && requester !== u2.toLowerCase()) {
        return res.status(403).json({ error: st('Нет доступа к чужой переписке', detectLangReq(req)) });
    }

    if (u2.toLowerCase().startsWith('room_')) {
        const room = await Room.findOne({ roomId: u2.toLowerCase() }).lean();
        if (!room || !room.members.includes(requester)) {
            return res.status(403).json({ error: st('Нет доступа к этой группе', detectLangReq(req)) });
        }
    }

    const lastId = req.query.lastId;
    const sinceId = req.query.sinceId;
    const limit = 50;
    try {
        let query;
        if (u2.toLowerCase().startsWith('room_')) {
            query = { receiver: u2.toLowerCase() };
        } else {
            query = { dialog_id: getDialogId(u1, u2) };
        }

        if (lastId && lastId !== 'null' && mongoose.Types.ObjectId.isValid(lastId)) {
            query._id = { $lt: new mongoose.Types.ObjectId(lastId) };
        }

        if (sinceId && sinceId !== 'null' && mongoose.Types.ObjectId.isValid(sinceId)) {
            query._id = query._id || {};
            query._id.$gt = new mongoose.Types.ObjectId(sinceId);
        }

        const pipeline = [
            { $match: query },
            { $sort: { _id: -1 } },
            { $limit: limit },
            { $sort: { _id: 1 } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'sender',
                    foreignField: 'username',
                    as: 'senderInfo'
                }
            },
            {
                $unwind: {
                    path: '$senderInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'reactions',
                    let: { msgId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$message_id', '$$msgId'] } } },
                        { $group: { _id: '$emoji', count: { $sum: 1 } } },
                        { $project: { _id: 0, emoji: '$_id', count: 1 } }
                    ],
                    as: 'reactions'
                }
            }
        ];

        const history = await Message.aggregate(pipeline);

        if (history.length === 0) return res.json([]);

        const decodedHistory = history.map(m => {
            const isRoomMsg = m.receiver.startsWith('room_');
            const isRead = isRoomMsg ? (m.read_by && m.read_by.length > 1) : m.is_read;

            let isVer = m.senderInfo?.isVerified || false;
            let dName = m.senderInfo?.displayName || m.sender;
            let sAvatar = m.senderInfo?.avatar || null;

            if (m.sender === '4send_system') {
                isVer = true;
                dName = st('Системные уведомления', detectLangReq(req));
                sAvatar = '/ico.png';
            }
            if (m.sender === '4send_help') {
                isVer = true;
                dName = st('Поддержка 4SEND', detectLangReq(req));
                sAvatar = '/ico.png';
            }

            const formattedMsg = {
                ...m,
                id: m._id.toString(),
                text: clarify(m.text || ""),
                isVerified: isVer,
                senderAvatar: sAvatar,
                is_read: isRead,
                displayName: dName,
                isService: m.isService || false
            };

            delete formattedMsg._id;
            delete formattedMsg.senderInfo;

            return formattedMsg;
        });

        res.json(decodedHistory);
    } catch {
        res.json([]);
    }
});

router.get('/chats-extended/:username', authenticateToken, async (req, res) => {
    const { username } = req.params;
    if (req.user.username !== username) {
        return res.status(403).json({ error: st('Нет доступа', detectLangReq(req)) });
    }

    try {
        const lang = detectLangReq(req);
        const dialogsPipeline = [
            { $match: { participants: username } },
            {
                $addFields: {
                    contact: {
                        $let: {
                            vars: {
                                other: { $filter: { input: "$participants", as: "p", cond: { $ne: ["$$p", username] } } }
                            },
                            in: {
                                $cond: {
                                    if: { $gt: [{ $size: "$$other" }, 0] },
                                    then: { $arrayElemAt: ["$$other", 0] },
                                    else: username
                                }
                            }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "contact",
                    foreignField: "username",
                    as: "contactUser"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "lastSender",
                    foreignField: "username",
                    as: "lastSenderUser"
                }
            },
            {
                $lookup: {
                    from: "chatactions",
                    let: { contact: "$contact" },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ["$user", username] }, { $eq: ["$contact", "$$contact"] }] } } }
                    ],
                    as: "actions"
                }
            },
            {
                $lookup: {
                    from: "blacklists",
                    let: { contact: "$contact" },
                    pipeline: [
                        { $match: { $expr: { $or: [
                            { $and: [{ $eq: ["$user_id", "$$contact"] }, { $eq: ["$blocked_id", username] }] },
                            { $and: [{ $eq: ["$user_id", username] }, { $eq: ["$blocked_id", "$$contact"] }] }
                        ] } } }
                    ],
                    as: "blockData"
                }
            },
            {
                $addFields: {
                    is_blocked_me: {
                        $gt: [
                            {
                                $size: {
                                    $filter: {
                                        input: "$blockData",
                                        cond: { $and: [
                                            { $eq: ["$$this.user_id", "$contact"] },
                                            { $eq: ["$$this.blocked_id", username] }
                                        ]}
                                    }
                                }
                            },
                            0
                        ]
                    },
                    i_blocked_him: {
                        $gt: [
                            {
                                $size: {
                                    $filter: {
                                        input: "$blockData",
                                        cond: { $and: [
                                            { $eq: ["$$this.user_id", username] },
                                            { $eq: ["$$this.blocked_id", "$contact"] }
                                        ]}
                                    }
                                }
                            },
                            0
                        ]
                    }
                }
            },
            {
                $project: {
                    username: "$contact",
                    userFound: { $gt: [{ $size: "$contactUser" }, 0] },
                    contactUser: { $arrayElemAt: ["$contactUser", 0] },
                    lastSenderUser: { $arrayElemAt: ["$lastSenderUser", 0] },
                    actions: "$actions.type",
                    is_blocked_me: 1,
                    i_blocked_him: 1,
                    lastTextRaw: "$lastMessageText",
                    lastSender: 1,
                    timestamp: "$lastMessageTimestamp",
                    unreadCounts: 1,
                    lastIsAudio: 1,
                    lastIsMusic: 1,
                    lastIsVideoNote: 1,
                    lastFileUrl: 1,
                    lastFileName: 1,
                    copyRestriction: 1,
                    forwardRestriction: 1,
                    screenshotNotification: 1,
                    autoDeleteTimer: 1,
                    lastCallType: 1,
                    lastCallDuration: 1,
                    lastCallWithVideo: 1
                }
            }
        ];

        const roomsPipeline = [
            { $match: { members: username } },
            {
                $lookup: {
                    from: "messages",
                    let: { roomId: "$roomId" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$receiver", "$$roomId"] }, isService: { $ne: true } } },
                        { $sort: { timestamp: -1 } },
                        { $limit: 1 }
                    ],
                    as: "lastMsg"
                }
            },
            {
                $lookup: {
                    from: "messages",
                    let: { roomId: "$roomId" },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ["$receiver", "$$roomId"] }, { $not: { $in: [username, "$read_by"] } }] } } },
                        { $count: "unread" }
                    ],
                    as: "unreadData"
                }
            },
            {
                $lookup: {
                    from: "chatactions",
                    let: { roomId: "$roomId" },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ["$user", username] }, { $eq: ["$contact", "$$roomId"] }] } } }
                    ],
                    as: "actions"
                }
            },
            {
                $addFields: {
                    lastMsgObj: { $arrayElemAt: ["$lastMsg", 0] }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "lastMsgObj.sender",
                    foreignField: "username",
                    as: "lastSenderUser"
                }
            },
            {
                $project: {
                    roomId: 1,
                    name: 1,
                    avatar: 1,
                    isVerified: 1,
                    type: 1,
                    owner: 1,
                    timestamp: 1,
                    copyRestriction: 1,
                    forwardRestriction: 1,
                    screenshotNotification: 1,
                    autoDeleteTimer: 1,
                    lastMsgObj: 1,
                    lastSenderUser: { $arrayElemAt: ["$lastSenderUser", 0] },
                    actions: "$actions.type",
                    unreadCount: {
                        $let: {
                            vars: { unreadObj: { $arrayElemAt: ["$unreadData", 0] } },
                            in: { $ifNull: ["$$unreadObj.unread", 0] }
                        }
                    }
                }
            }
        ];

        const [dialogsRaw, roomsRaw] = await Promise.all([
            Dialog.aggregate(dialogsPipeline),
            Room.aggregate(roomsPipeline)
        ]);

        const dialogs = dialogsRaw.map(d => {
            let user = d.contactUser;
            if (!user) {
                if (d.username === '4send_system') {
                    user = { username: '4send_system', avatar: '/ico.png', isVerified: true, displayName: st('Системные уведомления', detectLangReq(req)) };
                } else if (d.username === '4send_help') {
                    user = { username: '4send_help', avatar: '/ico.png', isVerified: true, displayName: st('Поддержка 4SEND', detectLangReq(req)) };
                } else {
                    return null;
                }
            }

            const unreadCount = d.unreadCounts ? (d.unreadCounts[username] || 0) : 0;
            const amIBlocked = d.is_blocked_me;
            const iBlockedHim = d.i_blocked_him;
            const contactActions = d.actions || [];

            let previewText = "";
            if (d.lastCallType) {
                previewText = "";
            } else if (d.lastFileUrl) {
                const isMp3 = d.lastFileUrl.toLowerCase().split('?')[0].endsWith('.mp3');
                const extMatch = d.lastFileUrl.match(/\.([^.?#]+)(?:[?#]|$)/i);
                const ext = extMatch ? extMatch[1].toLowerCase() : '';
                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);

                if (d.lastIsVideoNote) previewText = st("📹 Видеосообщение", lang);
                else if (d.lastIsAudio) previewText = st("🎤 Голосовое сообщение", lang);
                else if (isMp3 || d.lastIsMusic) previewText = st("🎵 Аудиозапись", lang);
                else if (isImage) previewText = st("📷 Фотография", lang);
                else previewText = d.lastFileName ? `📁 ${d.lastFileName}` : st("📁 Файл", lang);
            } else if (d.lastTextRaw) {
                const decodedText = clarify(d.lastTextRaw);
                previewText = (decodedText.includes('Переслано от') || decodedText.includes('📂')) ? st("📂 Пересланное", lang) : decodedText;
            } else {
                previewText = d.username === username ? st('Сохраненные сообщения', lang) : '';
            }

            const lastSenderDisplay = d.lastSenderUser ? (d.lastSenderUser.displayName || d.lastSenderUser.username) : d.lastSender;

            return {
                username: user.username,
                displayName: user.displayName || user.username,
                avatar: amIBlocked ? null : user.avatar,
                isVerified: user.isVerified || false,
                lastText: amIBlocked ? st("был(а) давно", lang) : previewText,
                lastSender: amIBlocked ? null : d.lastSender,
                lastSenderDisplay: amIBlocked ? null : lastSenderDisplay,
                timestamp: amIBlocked ? null : d.timestamp,
                is_pinned: contactActions.includes('pin') ? 1 : 0,
                is_muted: contactActions.includes('mute') ? 1 : 0,
                is_archived: contactActions.includes('archive') ? 1 : 0,
                unreadCount: amIBlocked ? 0 : unreadCount,
                is_blocked_me: amIBlocked,
                i_blocked_him: iBlockedHim ? 1 : 0,
                lastIsAudio: d.lastIsAudio || false,
                lastIsMusic: d.lastIsMusic || false,
                lastIsVideoNote: d.lastIsVideoNote || false,
                lastFileUrl: d.lastFileUrl || null,
                lastFileName: d.lastFileName || null,
                copyRestriction: d.copyRestriction || false,
                forwardRestriction: d.forwardRestriction || false,
                screenshotNotification: d.screenshotNotification || false,
                autoDeleteTimer: d.autoDeleteTimer || 0,
                lastCallType: d.lastCallType || null,
                lastCallDuration: d.lastCallDuration || 0,
                lastCallWithVideo: d.lastCallWithVideo || false,
                isLastMessageRead: d.unreadCounts ? (d.unreadCounts[user.username] || 0) === 0 : true,
                isRoom: false
            };
        }).filter(Boolean);

        const roomResults = roomsRaw.map(r => {
            const contactActions = r.actions || [];
            let previewText = r.type === 'channel' ? st('Канал', lang) : st('Группа', lang);
            let lastSender = null;
            let lastSenderDisplay = null;
            let lastTime = r.timestamp;
            let lastIsAudio = 0, lastIsMusic = 0, lastIsVideoNote = 0, lastFileUrl = null, lastFileName = null;

            if (r.lastMsgObj) {
                const roomMsg = r.lastMsgObj;
                lastSender = r.type === 'channel' ? null : roomMsg.sender;
                if (lastSender) {
                    lastSenderDisplay = r.lastSenderUser ? (r.lastSenderUser.displayName || r.lastSenderUser.username) : lastSender;
                }
                lastTime = roomMsg.timestamp;
                lastIsAudio = roomMsg.isAudio;
                lastIsVideoNote = roomMsg.isVideoNote;
                lastIsMusic = roomMsg.isMusic || (roomMsg.fileUrl && roomMsg.fileUrl.toLowerCase().includes('.mp3'));
                lastFileUrl = roomMsg.fileUrl;
                lastFileName = roomMsg.fileName;

                if (roomMsg.fileUrl) {
                    const isMp3 = roomMsg.fileUrl.toLowerCase().split('?')[0].endsWith('.mp3');
                    const extMatch = roomMsg.fileUrl.match(/\.([^.?#]+)(?:[?#]|$)/i);
                    const ext = extMatch ? extMatch[1].toLowerCase() : '';
                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                    if (roomMsg.isVideoNote) previewText = st("📹 Видеосообщение", lang);
                    else if (roomMsg.isAudio) previewText = st("🎤 Голосовое сообщение", lang);
                    else if (isMp3 || roomMsg.isMusic) previewText = st("🎵 Аудиозапись", lang);
                    else if (isImage) previewText = st("📷 Фотография", lang);
                    else previewText = roomMsg.fileName ? `📁 ${roomMsg.fileName}` : st("📁 Файл", lang);
                } else {
                    previewText = clarify(roomMsg.text || "");
                }
            }

            return {
                username: r.roomId,
                displayName: r.name,
                avatar: r.avatar,
                isVerified: r.isVerified || false,
                lastText: previewText,
                lastSender: lastSender,
                lastSenderDisplay: lastSenderDisplay,
                timestamp: lastTime,
                is_pinned: contactActions.includes('pin') ? 1 : 0,
                is_muted: contactActions.includes('mute') ? 1 : 0,
                is_archived: contactActions.includes('archive') ? 1 : 0,
                unreadCount: r.unreadCount || 0,
                is_blocked_me: false,
                i_blocked_him: 0,
                isRoom: true,
                roomType: r.type,
                roomOwner: r.owner,
                lastIsAudio,
                lastIsMusic,
                lastIsVideoNote,
                lastFileUrl,
                lastFileName,
                copyRestriction: r.copyRestriction || false,
                forwardRestriction: r.forwardRestriction || false,
                screenshotNotification: r.screenshotNotification || false,
                autoDeleteTimer: r.autoDeleteTimer || 0,
                isLastMessageRead: r.lastMsgObj && r.lastMsgObj.read_by && r.lastMsgObj.read_by.length > 1 ? true : false
            };
        });

        let result = [...dialogs, ...roomResults];
        result.sort((a, b) => b.is_pinned - a.is_pinned || new Date(b.timestamp) - new Date(a.timestamp));
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/api/last-messages/:username', authenticateToken, async (req, res) => {
    const { username } = req.params;
    if (req.user.username !== username) {
        return res.status(403).json({ error: st('Нет доступа', detectLangReq(req)) });
    }
    try {
        const lastMsgs = await Message.aggregate([
            { $match: { $or: [{ sender: username }, { receiver: username }] } },
            { $sort: { timestamp: -1 } },
            { $group: {
                _id: { $cond: [{ $eq: ["$sender", username] }, "$receiver", "$sender"] },
                last_msg: { $first: "$$ROOT" }
            }}
        ]);
        res.json(lastMsgs.map(m => ({ ...m.last_msg, id: m.last_msg._id, text: clarify(m.last_msg.text || "") })));
    } catch { res.json([]); }
});

router.get('/api/chat-stats/:target', authenticateToken, async (req, res) => {
    try {
        const me = req.user.username;
        const target = req.params.target;
        let createdAt, messageCount;

        if (target.startsWith('room_')) {
            const room = await Room.findOne({ roomId: target }).lean();
            if (!room || !room.members.includes(me)) return res.status(403).json({ error: 'Access denied' });
            createdAt = room.timestamp;
            messageCount = await Message.countDocuments({ receiver: target });
        } else {
            const dialogId = getDialogId(me, target);
            const dialog = await Dialog.findOne({ dialog_id: dialogId }).lean();
            if (!dialog) return res.status(404).json({ error: 'Not found' });
            const firstMsg = await Message.findOne({ dialog_id: dialogId }).sort({ timestamp: 1 }).lean();
            createdAt = firstMsg ? firstMsg.timestamp : new Date();
            messageCount = await Message.countDocuments({ dialog_id: dialogId });
        }
        res.json({ createdAt, messageCount });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
