const mongoose = require('mongoose');
const Message = require('../../models/Message');
const Dialog = require('../../models/Dialog');
const User = require('../../models/User');
const Room = require('../../models/Room');
const { getDialogId, updateDialogLastMessage } = require('../../utils/dialog');
const { clarify, obscure } = require('../../utils/crypto');
const { extractCloudinaryId } = require('../../utils/file');
const { st, detectLang } = require('../../constants/translations');
const cloudinary = require('../../config/cloudinary');
const { getIO } = require('../io');

const handleDeleteMsg = async (socket, id) => {
    try {
        const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { tempId: id, sender: socket.username };
        const msg = await Message.findOne(query).lean();

        if (!msg || msg.sender !== socket.username) return;

        const urlsToCheck = [];
        if (msg.fileUrl && msg.fileUrl.includes('cloudinary.com')) urlsToCheck.push(msg.fileUrl);
        if (msg.fileUrls && msg.fileUrls.length > 0) {
            msg.fileUrls.forEach(u => { if (u.includes('cloudinary.com')) urlsToCheck.push(u); });
        }

        for (const url of urlsToCheck) {
            const count = await Message.countDocuments({ $or: [{ fileUrl: url }, { fileUrls: url }] });
            const userCount = await User.countDocuments({ avatar: url });
            const roomCount = await Room.countDocuments({ avatar: url });

            if (count <= 1 && userCount === 0 && roomCount === 0) {
                const publicId = extractCloudinaryId(url);
                if (publicId) {
                    const resourceType = msg.isVideoNote || msg.isMusic || msg.isAudio || url.match(/\.(mp4|webm|mov|mp3|wav|ogg|m4a)$/i) ? 'video' : 'image';
                    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }).catch(() => {});
                }
            }
        }

        const result = await Message.deleteOne(query);
        if (result?.deletedCount > 0) {
            if (!msg.receiver.startsWith('room_')) {
                await updateDialogLastMessage(getDialogId(msg.sender, msg.receiver));
            }

            const io = getIO();
            if (msg.receiver.startsWith('room_')) {
                io.to(msg.receiver).emit('msg_deleted', msg._id.toString());
            } else {
                io.to(msg.sender).to(msg.receiver).emit('msg_deleted', msg._id.toString());
            }
        }
    } catch {}
};

const handleEditMsg = async (socket, { id, newText }) => {
    try {
        const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { tempId: id, sender: socket.username };
        const msg = await Message.findOne(query).lean();
        if (!msg || msg.sender !== socket.username) return;

        const currentText = clarify(msg.text);
        if (currentText.includes(st('Переслано от', detectLang(socket))) || currentText === newText) return;

        const hiddenText = obscure(newText);
        await Message.updateOne({ _id: msg._id }, { $set: { text: hiddenText, is_edited: true } });

        if (!msg.receiver.startsWith('room_')) {
            const dialogId = getDialogId(msg.sender, msg.receiver);
            const lastMsg = await Message.findOne({ dialog_id: dialogId }).sort({ timestamp: -1 }).lean();
            if (lastMsg && lastMsg._id.toString() === msg._id.toString()) {
                await Dialog.updateOne(
                    { dialog_id: dialogId },
                    { $set: { lastMessageText: hiddenText } }
                );
            }
        }

        const io = getIO();
        if (msg.receiver.startsWith('room_')) {
            io.to(msg.receiver).emit('msg_updated', { id: msg._id.toString(), text: newText });
        } else {
            io.to(msg.sender).to(msg.receiver).emit('msg_updated', { id: msg._id.toString(), text: newText });
        }
    } catch {}
};

module.exports = { handleDeleteMsg, handleEditMsg };
