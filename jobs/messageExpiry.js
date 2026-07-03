const fs = require('fs');
const path = require('path');
const Message = require('../models/Message');
const Reaction = require('../models/Reaction');
const { getIO } = require('../socket/io');

const startMessageExpiryJob = () => {
    setInterval(async () => {
        try {
            const expired = await Message.find({
                expires_at: { $ne: null, $lte: new Date() }
            }).lean();

            if (expired?.length > 0) {
                const io = getIO();
                for (const msg of expired) {
                    if (msg.fileUrl) {
                        const cleanPath = msg.fileUrl.startsWith('/') ? msg.fileUrl.substring(1) : msg.fileUrl;
                        const filePath = path.join(process.cwd(), cleanPath);
                        if (fs.existsSync(filePath)) {
                            try { fs.unlinkSync(filePath); } catch {}
                        }
                    }

                    const msgIdStr = msg._id.toString();
                    await Message.deleteOne({ _id: msg._id });
                    await Reaction.deleteMany({ message_id: msg._id });
                    io.to(msg.sender).to(msg.receiver).emit('msg_deleted', msgIdStr);
                }
            }
        } catch (err) {
            if (err.name === 'MissingSchemaError') return;
        }
    }, 10000);
};

module.exports = { startMessageExpiryJob };
