const mongoose = require('mongoose');
const Message = require('../../models/Message');
const Room = require('../../models/Room');
const Pin = require('../../models/Pin');
const { obscure } = require('../../utils/crypto');
const { st, detectLang } = require('../../constants/translations');
const { broadcastSystemAction } = require('../../services/notification');
const { getIO } = require('../io');

const handlePinRequest = async (socket, { messageId, chatId, type, textPreview }) => {
    const pinnerId = socket.username.toLowerCase();
    const r = chatId.toLowerCase();
    try {
        const query = mongoose.Types.ObjectId.isValid(messageId) ? { _id: messageId } : { tempId: messageId };
        const msg = await Message.findOne(query).lean();
        if (!msg) return;
        const realMsgId = msg._id.toString();

        if (r.startsWith('room_')) {
            const room = await Room.findOne({ roomId: r }).lean();
            if (!room || !room.members.includes(pinnerId)) return;
            if (room.type === 'channel' && room.owner !== pinnerId) return;
        }
        const hiddenPreview = obscure(textPreview);
        await Pin.create({ message_id: realMsgId, chat_id: r, pinner_id: pinnerId, pin_type: type, text_preview: hiddenPreview, timestamp: new Date() });

        const io = getIO();
        const updateData = { messageId: realMsgId, text: textPreview, action: 'add', chatId: r, pinnerId, type };
        socket.emit('pin_update', updateData);
        if (type === 'both' && pinnerId !== r) io.to(r).emit('pin_update', { ...updateData, chatId: pinnerId });

        if (type === 'both') {
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

        if (r.startsWith('room_')) {
            const room = await Room.findOne({ roomId: r }).lean();
            if (!room || !room.members.includes(pinnerId)) return;
            if (room.type === 'channel' && room.owner !== pinnerId) return;
        }
        const pin = await Pin.findOne({ message_id: realMsgId, chat_id: r }).lean();
        await Pin.deleteOne({ message_id: realMsgId, chat_id: r });

        const io = getIO();
        socket.emit('pin_update', { messageId: realMsgId, action: 'remove', chatId: r });
        io.to(r).emit('pin_update', { messageId: realMsgId, action: 'remove', chatId: pinnerId });

        if (pin && pin.pin_type === 'both') {
            await broadcastSystemAction(pinnerId, r, `${st('открепил(а) сообщение', detectLang(socket))}`);
        }
    } catch {}
};

module.exports = { handlePinRequest, handleUnpinRequest };
