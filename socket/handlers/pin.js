const mongoose = require('mongoose');
const Message = require('../../models/Message');
const Room = require('../../models/Room');
const Pin = require('../../models/Pin');
const { obscure } = require('../../utils/crypto');
const { st, detectLang } = require('../../constants/translations');
const { broadcastSystemAction } = require('../../services/notification');
const { getIO } = require('../io');

const normalizePinType = (type) => (type === 'both' ? 'both' : 'me');

const handlePinRequest = async (socket, { messageId, chatId, type, textPreview }) => {
    const pinnerId = socket.username.toLowerCase();
    const r = chatId.toLowerCase();
    try {
        const query = mongoose.Types.ObjectId.isValid(messageId) ? { _id: messageId } : { tempId: messageId };
        const msg = await Message.findOne(query).lean();
        if (!msg) return;
        const realMsgId = msg._id.toString();

        let room = null;
        if (r.startsWith('room_')) {
            room = await Room.findOne({ roomId: r }).lean();
            if (!room || !room.members.includes(pinnerId)) return;
            if (room.type === 'channel' && room.owner !== pinnerId) return;
        }
        const pinType = normalizePinType(type);
        const hiddenPreview = obscure(textPreview);
        await Pin.updateOne(
            { message_id: realMsgId, chat_id: r, pinner_id: pinnerId },
            { $set: { pin_type: pinType, text_preview: hiddenPreview, timestamp: new Date() } },
            { upsert: true }
        );

        const io = getIO();
        const updateData = { messageId: realMsgId, text: textPreview, action: 'add', chatId: r, pinnerId, type: pinType };
        socket.emit('pin_update', updateData);
        if (pinType === 'both' && pinnerId !== r) {
            if (r.startsWith('room_')) {
                if (room) room.members.forEach(m => io.to(m).emit('pin_update', updateData));
            } else {
                io.to(r).emit('pin_update', { ...updateData, chatId: pinnerId });
            }
        }

        if (pinType === 'both') {
            let preview = textPreview.length > 20 ? textPreview.substring(0, 20) + '...' : textPreview;
            await broadcastSystemAction(pinnerId, r, `${st('закрепил(а)', detectLang(socket))} «${preview}»`);
        }
    } catch {}
};

const handleUnpinRequest = async (socket, { messageId, chatId }) => {
    const pinnerId = socket.username.toLowerCase();
    const r = chatId.toLowerCase();
    try {
        const query = mongoose.Types.ObjectId.isValid(messageId) ? { _id: messageId } : { tempId: messageId };
        const msg = await Message.findOne(query).lean();
        const realMsgId = msg ? msg._id.toString() : messageId;

        let room = null;
        if (r.startsWith('room_')) {
            room = await Room.findOne({ roomId: r }).lean();
            if (!room || !room.members.includes(pinnerId)) return;
            if (room.type === 'channel' && room.owner !== pinnerId) return;
        }

        const docs = await Pin.find({
            message_id: realMsgId,
            $or: [{ chat_id: r }, { chat_id: pinnerId }],
            $and: [{ $or: [{ pinner_id: pinnerId }, { pin_type: { $in: ['both', 'self'] } }] }]
        }).lean();
        if (docs.length) {
            await Pin.deleteMany({ _id: { $in: docs.map(d => d._id) } });
        }

        const io = getIO();
        socket.emit('pin_update', { messageId: realMsgId, action: 'remove', chatId: r });
        const affectedShared = docs.some(d => d.pin_type === 'both' || d.pin_type === 'self');
        if (affectedShared) {
            if (r.startsWith('room_')) {
                if (room) room.members.forEach(m => io.to(m).emit('pin_update', { messageId: realMsgId, action: 'remove', chatId: r }));
            } else {
                io.to(r).emit('pin_update', { messageId: realMsgId, action: 'remove', chatId: pinnerId });
            }
        }

        if (affectedShared) {
            await broadcastSystemAction(pinnerId, r, `${st('открепил(а) сообщение', detectLang(socket))}`);
        }
    } catch {}
};

module.exports = { handlePinRequest, handleUnpinRequest };
