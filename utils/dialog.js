const Message = require('../models/Message');
const Dialog = require('../models/Dialog');

const getDialogId = (u1, u2) => [String(u1).toLowerCase(), String(u2).toLowerCase()].sort().join('_');

const updateDialogLastMessage = async (dialogId) => {
    try {
        const lastMsg = await Message.findOne({ dialog_id: dialogId, isService: { $ne: true } }).sort({ timestamp: -1 }).lean();
        if (lastMsg) {
            await Dialog.updateOne(
                { dialog_id: dialogId },
                {
                    $set: {
                        lastMessageText: lastMsg.is_encrypted ? '🔒' : lastMsg.text,
                        lastSender: lastMsg.sender,
                        lastMessageTimestamp: lastMsg.timestamp,
                        lastIsAudio: lastMsg.isAudio || false,
                        lastIsMusic: lastMsg.isMusic || false,
                        lastIsVideoNote: lastMsg.isVideoNote || false,
                        lastIsEncrypted: lastMsg.is_encrypted || false,
                        lastFileUrl: lastMsg.fileUrls && lastMsg.fileUrls.length > 0 ? lastMsg.fileUrls[0] : (lastMsg.fileUrl || null),
                        lastFileName: lastMsg.fileName || null
                    },
                    $unset: { lastCallType: '', lastCallDuration: '', lastCallWithVideo: '' }
                }
            );
        } else {
            await Dialog.updateOne(
                { dialog_id: dialogId },
                {
                    $set: {
                        lastMessageText: '',
                        lastSender: null,
                        lastMessageTimestamp: new Date(0),
                        lastIsAudio: false,
                        lastIsMusic: false,
                        lastIsVideoNote: false,
                        lastIsEncrypted: false,
                        lastFileUrl: null,
                        lastFileName: null
                    },
                    $unset: { lastCallType: '', lastCallDuration: '', lastCallWithVideo: '' }
                }
            );
        }
    } catch {}
};

module.exports = { getDialogId, updateDialogLastMessage };
