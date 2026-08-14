const Room = require('../../models/Room');
const Message = require('../../models/Message');
const Pin = require('../../models/Pin');
const { st, detectLang } = require('../../constants/translations');
const { getIO } = require('../io');

const handleCreateRoom = async (socket, data) => {
    try {
        const { name, type, isPublic, publicLink, description, avatar } = data;
        if (!name || typeof name !== 'string' || !/^[a-zA-Z]{4,20}$/.test(name.trim())) {
            return socket.emit('error_message', { text: st("Название: только латиница, 4-20 символов", detectLang(socket)) });
        }
        if (description && (typeof description !== 'string' || description.length > 500)) {
            return socket.emit('error_message', { text: st("Описание не более 500 символов", detectLang(socket)) });
        }
        if (publicLink && isPublic) {
            if (typeof publicLink !== 'string' || !/^[a-z0-9-]{3,30}$/i.test(publicLink)) {
                return socket.emit('error_message', { text: st("Некорректная публичная ссылка", detectLang(socket)) });
            }
            const exists = await Room.findOne({ publicLink }).lean();
            if (exists) return socket.emit('error_message', { text: st("Ссылка уже занята", detectLang(socket)) });
        }
        const roomId = 'room_' + Date.now() + Math.random().toString(36).substr(2, 5);
        await Room.create({
            roomId,
            name: name.trim(),
            type,
            isPublic,
            publicLink: publicLink || null,
            description: description ? description.trim() : '',
            avatar: avatar || null,
            owner: socket.username,
            members: [socket.username]
        });
        const io = getIO();
        io.to(socket.username).emit('update_chat_list');
    } catch {}
};

const handleUpdateRoom = async (socket, data) => {
    try {
        const room = await Room.findOne({ roomId: data.roomId }).lean();
        if (!room || room.owner !== socket.username) return;
        if (data.name && (typeof data.name !== 'string' || !/^[a-zA-Z]{4,20}$/.test(data.name))) {
            return socket.emit('error_message', { text: st("Название: только латиница, 4-20 символов", detectLang(socket)) });
        }
        if (data.description && (typeof data.description !== 'string' || data.description.length > 500)) {
            return socket.emit('error_message', { text: st("Описание не более 500 символов", detectLang(socket)) });
        }
        if (data.publicLink) {
            if (data.isPublic && !/^[a-z0-9-]{3,30}$/i.test(data.publicLink)) {
                return socket.emit('error_message', { text: st("Некорректная публичная ссылка", detectLang(socket)) });
            }
        }
        if (data.isPublic && data.publicLink && data.publicLink !== room.publicLink) {
            const exists = await Room.findOne({ publicLink: data.publicLink }).lean();
            if (exists) return socket.emit('error_message', { text: st("Ссылка уже занята", detectLang(socket)) });
        }
        const $set = {};
        if (data.name) $set.name = data.name.trim();
        if (data.description) $set.description = data.description.trim();
        if (typeof data.isPublic === 'boolean') $set.isPublic = data.isPublic;
        if (data.publicLink) $set.publicLink = data.publicLink;
        else if (data.isPublic === false) $set.publicLink = null;
        if (data.avatar) $set.avatar = data.avatar;
        await Room.updateOne({ roomId: data.roomId }, { $set });
        const io = getIO();
        room.members.forEach(m => io.to(m).emit('update_chat_list'));
        socket.emit('room_updated', data.roomId);
    } catch {}
};

const handleJoinPublicRoom = async (socket, id) => {
    try {
        const room = await Room.findOne({ $or: [{ roomId: id }, { publicLink: id }], isPublic: true }).lean();
        if (!room || room.members.includes(socket.username)) return;
        await Room.updateOne({ _id: room._id }, { $push: { members: socket.username } });
        const io = getIO();
        io.to(socket.username).emit('update_chat_list');
        socket.emit('room_joined', room.roomId);
    } catch {}
};

const handleRequestJoinRoom = async (socket, id) => {
    try {
        const room = await Room.findOne({ $or: [{ roomId: id }, { publicLink: id }], isPublic: false }).lean();
        if (!room || room.members.includes(socket.username) || room.joinRequests.includes(socket.username)) return;
        await Room.updateOne({ _id: room._id }, { $push: { joinRequests: socket.username } });
        socket.emit('join_requested', room.roomId);
    } catch {}
};

const handleJoinRequest = async (socket, { roomId, user, approve }) => {
    try {
        const room = await Room.findOne({ roomId }).lean();
        if (!room || room.owner !== socket.username) return;
        if (!room.joinRequests.includes(user)) return;
        await Room.updateOne({ roomId }, { $pull: { joinRequests: user } });
        if (approve) {
            await Room.updateOne({ roomId }, { $push: { members: user } });
            const io = getIO();
            io.to(user).emit('update_chat_list');
            io.to(user).emit('room_joined', roomId);
        }
        socket.emit('request_handled', { roomId, user });
    } catch {}
};

const handleLeaveRoom = async (socket, roomId) => {
    try {
        const room = await Room.findOne({ roomId }).lean();
        if (!room) return;
        const io = getIO();
        if (room.owner === socket.username) {
            await Room.deleteOne({ roomId });
            await Message.deleteMany({ receiver: roomId });
            await Pin.deleteMany({ chat_id: roomId });
            room.members.forEach(m => io.to(m).emit('update_chat_list'));
        } else {
            await Room.updateOne({ roomId }, { $pull: { members: socket.username } });
            io.to(socket.username).emit('update_chat_list');
        }
    } catch {}
};

const handleRemoveMember = async (socket, { roomId, user }) => {
    try {
        const room = await Room.findOne({ roomId }).lean();
        if (!room || room.owner !== socket.username || user === socket.username) return;
        await Room.updateOne({ roomId }, { $pull: { members: user } });
        const io = getIO();
        io.to(user).emit('update_chat_list');
        io.to(socket.username).emit('member_removed', { roomId, user });
    } catch {}
};

module.exports = {
    handleCreateRoom, handleUpdateRoom, handleJoinPublicRoom,
    handleRequestJoinRoom, handleJoinRequest, handleLeaveRoom, handleRemoveMember
};
