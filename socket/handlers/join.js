const User = require('../../models/User');
const { getIO, onlineUsers } = require('../io');

const handleJoin = async (socket, clientUser) => {
    const user = socket.userTokenData?.username;
    if (!user) return;

    socket.username = user;
    socket.join(user);
    onlineUsers.add(user);
    try {
        const dbUser = await User.findOneAndUpdate({ username: user }, { $set: { last_seen: new Date() } }, { new: true }).lean();
        if (!dbUser) return;
        socket.emit('auth_success', { username: dbUser.username, avatar: dbUser.avatar, isVerified: dbUser.isVerified, displayName: dbUser.displayName, notificationRepeat: dbUser.notificationRepeat });
        socket.emit('update_chat_list');
        const io = getIO();
        io.emit('online_list', Array.from(onlineUsers));
    } catch {}
};

const handleDisconnect = async (socket) => {
    if (socket.username) {
        try {
            await User.updateOne({ username: socket.username }, { $set: { last_seen: new Date() } });
            const io = getIO();
            io.emit('user_status_update', { username: socket.username });
            onlineUsers.delete(socket.username);
            io.emit('online_list', Array.from(onlineUsers));
        } catch {}
    }
};

module.exports = { handleJoin, handleDisconnect };
