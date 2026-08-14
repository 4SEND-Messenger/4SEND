const Room = require('../../models/Room');
const { getIO } = require('../io');

const handleTyping = async (socket, data) => {
    if (!data.receiver) return;
    data.sender = socket.username;
    const io = getIO();
    if (data.receiver.startsWith('room_')) {
        try {
            const room = await Room.findOne({ roomId: data.receiver }).lean();
            if (room) {
                room.members.forEach(m => {
                    if (m !== data.sender) {
                        io.to(m).emit('is_typing', { sender: data.sender, receiver: data.receiver, isVoice: data.isVoice || false, isVideo: data.isVideo || false, stop: data.stop });
                    }
                });
            }
        } catch {}
    } else {
        socket.to(data.receiver).emit('is_typing', { sender: data.sender, isVoice: data.isVoice || false, isVideo: data.isVideo || false, stop: data.stop });
    }
};

module.exports = { handleTyping };
