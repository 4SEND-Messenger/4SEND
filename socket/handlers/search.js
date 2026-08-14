const User = require('../../models/User');
const Room = require('../../models/Room');
const { checkServerPrivacy } = require('../../middleware/privacyWrapper');
const { escapeRegex } = require('../../utils/escapeRegex');

const handleSearchUser = async (socket, query) => {
    try {
        const q = (query || '').toString().trim();
        if (!q) return socket.emit('search_results', { users: [], rooms: [] });
        const myName = (socket.username || "").toLowerCase();

        let users = await User.find({
            $and: [
                { username: { $regex: `^${escapeRegex(q)}$`, $options: 'i' } },
                { username: { $ne: myName } }
            ]
        }).select('username avatar isVerified displayName').limit(20).lean();

        users = users.filter(u => checkServerPrivacy(u.username, myName, 'search')).slice(0, 5);

        const rooms = await Room.find({
            isPublic: true,
            $or: [
                { publicLink: { $regex: `^${escapeRegex(q)}$`, $options: 'i' } },
                { name: { $regex: `^${escapeRegex(q)}$`, $options: 'i' } }
            ]
        }).limit(5).lean();

        socket.emit('search_results', { users, rooms });
    } catch {
        socket.emit('search_results', { users: [], rooms: [] });
    }
};

module.exports = { handleSearchUser };
