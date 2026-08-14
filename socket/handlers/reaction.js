const mongoose = require('mongoose');
const Message = require('../../models/Message');
const Room = require('../../models/Room');
const Reaction = require('../../models/Reaction');
const { getIO } = require('../io');

const handleSetReaction = async (socket, { msgId, emoji, receiver }) => {
    try {
        const myId = socket.username;
        if (!myId || !msgId) return;

        const query = mongoose.Types.ObjectId.isValid(msgId) ? { _id: msgId } : { tempId: msgId };
        const msg = await Message.findOne(query).lean();
        if (!msg) return;

        const realMsgId = msg._id.toString();

        let hasAccess = false;
        if (msg.sender === myId || msg.receiver === myId) {
            hasAccess = true;
        } else if (msg.receiver.startsWith('room_')) {
            const room = await Room.findOne({ roomId: msg.receiver }).lean();
            if (room && room.members.includes(myId)) hasAccess = true;
        }
        if (!hasAccess) return;

        const safeEmoji = String(emoji).substring(0, 10);

        const existing = await Reaction.findOne({ message_id: realMsgId, user: myId }).lean();
        if (existing && existing.emoji === safeEmoji) await Reaction.deleteOne({ _id: existing._id });
        else if (existing) await Reaction.updateOne({ _id: existing._id }, { $set: { emoji: safeEmoji } });
        else await Reaction.create({ message_id: realMsgId, user: myId, emoji: safeEmoji });

        const reactions = await Reaction.aggregate([
            { $match: { message_id: new mongoose.Types.ObjectId(realMsgId) } },
            { $group: { _id: "$emoji", count: { $sum: 1 } } }
        ]);
        const formattedReactions = reactions.map(r => ({ emoji: r._id, count: r.count }));

        const io = getIO();
        io.to(myId).to(receiver).emit('update_msg_reactions', { msgId: realMsgId, reactions: formattedReactions });
    } catch {}
};

module.exports = { handleSetReaction };
