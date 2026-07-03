const mongoose = require('mongoose');
const User = require('../../models/User');
const Message = require('../../models/Message');
const Dialog = require('../../models/Dialog');
const Room = require('../../models/Room');
const { getDialogId } = require('../../utils/dialog');
const { clarify, obscure } = require('../../utils/crypto');
const { checkServerPrivacy } = require('../../middleware/privacyWrapper');
const { st, detectLang } = require('../../constants/translations');
const { ENCRYPTION_KEY } = require('../../config/env');
const { broadcastSystemAction } = require('../../services/notification');
const { getIO } = require('../io');

const handleForwardMessage = async (socket, { msgId, toUser }) => {
    const fromUser = socket.username;
    if (!mongoose.Types.ObjectId.isValid(msgId)) return;
    try {
        const original = await Message.findById(msgId).lean();
        if (!original) return;

        let hasAccess = false;
        let forwardFromName = original.sender;
        const origSenderUser = await User.findOne({ username: original.sender }).lean();
        if (origSenderUser && origSenderUser.displayName) {
            forwardFromName = origSenderUser.displayName;
        }
        let sourceChatId = null;

        if (original.sender === fromUser || original.receiver === fromUser) {
            hasAccess = true;
            sourceChatId = original.sender === fromUser ? original.receiver : original.sender;
        } else if (original.receiver.startsWith('room_')) {
            const room = await Room.findOne({ roomId: original.receiver }).lean();
            if (room && room.members.includes(fromUser)) {
                hasAccess = true;
                forwardFromName = room.name;
                sourceChatId = original.receiver;
            }
        }
        if (!hasAccess) return;

        let isForwardRestricted = false;
        if (!original.receiver.startsWith('room_')) {
            const sourceDialog = await Dialog.findOne({ dialog_id: original.dialog_id }).lean();
            if (sourceDialog && sourceDialog.forwardRestriction) isForwardRestricted = true;
        } else {
            const sourceRoom = await Room.findOne({ roomId: original.receiver }).lean();
            if (sourceRoom && sourceRoom.forwardRestriction) isForwardRestricted = true;
        }

        if (original.sender !== fromUser && !original.receiver.startsWith('room_')) {
            const canSeeForward = checkServerPrivacy(original.sender, toUser, 'forwards');
            if (!canSeeForward || isForwardRestricted) forwardFromName = st('скрыто', detectLang(socket));
        } else if (isForwardRestricted) {
            forwardFromName = st('скрыто', detectLang(socket));
        }

        const clearText = clarify(original.text);
        const forwardText = `📂 ${st('Переслано от', detectLang(socket))} ${forwardFromName}:\n${clearText}`;
        const hiddenText = obscure(forwardText);

        const dialogId = getDialogId(fromUser, toUser);

        const newMsgDoc = await Message.create({
            dialog_id: dialogId,
            sender: fromUser, receiver: toUser, text: hiddenText,
            fileUrl: original.fileUrl, fileUrls: original.fileUrls || [],
            isAudio: original.isAudio, isMusic: original.isMusic,
            is_read: false, timestamp: new Date()
        });

        await Dialog.findOneAndUpdate(
            { dialog_id: dialogId },
            {
                $set: {
                    participants: [fromUser, toUser],
                    lastMessageText: hiddenText,
                    lastSender: fromUser,
                    lastMessageTimestamp: newMsgDoc.timestamp,
                    lastIsAudio: newMsgDoc.isAudio,
                    lastIsMusic: newMsgDoc.isMusic,
                    lastIsVideoNote: newMsgDoc.isVideoNote,
                    lastFileUrl: newMsgDoc.fileUrls && newMsgDoc.fileUrls.length > 0 ? newMsgDoc.fileUrls[0] : newMsgDoc.fileUrl,
                    lastFileName: newMsgDoc.fileName
                },
                $inc: { [`unreadCounts.${toUser}`]: 1 }
            },
            { upsert: true, new: true }
        );

        const io = getIO();
        const newMsg = {
            id: newMsgDoc._id.toString(), sender: fromUser, receiver: toUser,
            text: forwardText, fileUrl: original.fileUrl, fileUrls: original.fileUrls || [],
            isAudio: original.isAudio, isMusic: original.isMusic,
            timestamp: newMsgDoc.timestamp
        };

        socket.to(toUser).emit('new_message', newMsg);
        socket.emit('message_sent_confirm', { id: newMsg.id });
        io.to(toUser).to(fromUser).emit('update_chat_list');

        if (!isForwardRestricted && sourceChatId) {
            await broadcastSystemAction(fromUser, sourceChatId, st('переслал(а) сообщение', detectLang(socket)));
        }
    } catch (e) { }
};

module.exports = { handleForwardMessage };
