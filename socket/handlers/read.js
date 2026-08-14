const Message = require('../../models/Message');
const Dialog = require('../../models/Dialog');
const Room = require('../../models/Room');
const { getDialogId } = require('../../utils/dialog');
const { escapeRegex } = require('../../utils/escapeRegex');
const { getIO } = require('../io');

const handleMarkRead = async (socket, { sender, receiver, isRoom }) => {
    try {
        const r = socket.username.toLowerCase();
        const s = String(sender).toLowerCase();

        const io = getIO();

        if (isRoom) {
            const room = await Room.findOne({ roomId: s }).lean();
            if (room && room.members.includes(r)) {
                await Message.updateMany(
                    { receiver: s, read_by: { $ne: r } },
                    { $addToSet: { read_by: r } }
                );
                room.members.forEach(m => {
                    if (m !== r) io.to(m).emit('messages_read', { by: r, room: s });
                });
            }
            io.to(r).emit('update_chat_list');
        } else {
            const sRegex = new RegExp('^' + escapeRegex(s) + '$', 'i');

            await Message.updateMany(
                { sender: sRegex, receiver: r, is_read: false },
                { $set: { is_read: true }, $addToSet: { read_by: r } }
            );

            const dialogId = getDialogId(s, r);
            await Dialog.updateOne(
                { dialog_id: dialogId },
                { $set: { [`unreadCounts.${r}`]: 0 } }
            );

            io.to(s).emit('messages_read', { by: r });
            io.to(r).emit('update_chat_list');
        }
    } catch {}
};

const handleClearHistory = async (socket, { user, contact }) => {
    try {
        const me = socket.username;
        if (!me || !contact) return;
        await Message.deleteMany({ $or: [{ sender: me, receiver: contact }, { sender: contact, receiver: me }] });

        const dialogId = getDialogId(me, contact);
        await Dialog.deleteOne({ dialog_id: dialogId });

        const io = getIO();
        io.to(me).to(contact).emit('update_chat_list');
    } catch {}
};

module.exports = { handleMarkRead, handleClearHistory };
