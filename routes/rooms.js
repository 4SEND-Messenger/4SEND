const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authenticateToken');
const Room = require('../models/Room');
const User = require('../models/User');
const Message = require('../models/Message');
const Pin = require('../models/Pin');
const { extractCloudinaryId } = require('../utils/file');
const cloudinary = require('../config/cloudinary');
const { getIO } = require('../socket/io');

router.get('/api/room/:id', authenticateToken, async (req, res) => {
    try {
        const room = await Room.findOne({ $or: [{ roomId: req.params.id }, { publicLink: req.params.id }] }).lean();
        if (!room) return res.status(404).json({ error: 'Not found' });
        if (!room.isPublic && !room.members.includes(req.user.username)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const users = await User.find({ username: { $in: room.members } }).select('username displayName avatar isVerified').lean();
        room.memberDetails = users;
        delete room.joinRequests;
        res.json(room);
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.get('/api/admin/rooms', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const rooms = await Room.find({}).select('roomId name type isVerified owner').lean();
        res.json(rooms);
    } catch { res.status(500).json([]); }
});

router.get('/api/admin/room/:roomId', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const room = await Room.findOne({ roomId: req.params.roomId }).lean();
        if (!room) return res.status(404).json({ error: 'Not found' });

        const users = await User.find({ username: { $in: room.members } }).select('username avatar isVerified role').lean();
        res.json({ ...room, memberDetails: users });
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/api/admin/toggle-room-verify', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const { roomId, verify } = req.body;
        await Room.updateOne({ roomId }, { $set: { isVerified: verify } });
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/api/admin/delete-room', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const { roomId } = req.body;

        const room = await Room.findOne({ roomId }).lean();
        if (room) {
            if (room.avatar && room.avatar.includes('cloudinary.com')) {
                const publicId = extractCloudinaryId(room.avatar);
                if (publicId) {
                    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => {});
                }
            }
        }

        await Room.deleteOne({ roomId });
        await Message.deleteMany({ receiver: roomId });
        await Pin.deleteMany({ chat_id: roomId });

        if (room && room.members) {
            const io = getIO();
            room.members.forEach(m => io.to(m).emit('update_chat_list'));
        }

        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/api/rooms/:id/avatar', authenticateToken, async (req, res) => {
    try {
        const { avatar } = req.body;
        const room = await Room.findOne({ roomId: req.params.id });

        if (!room) return res.status(404).json({ error: 'Room not found' });
        if (room.owner !== req.user.username) return res.status(403).json({ error: 'Forbidden' });
        if (!avatar || typeof avatar !== 'string') return res.status(400).json({ error: 'Invalid avatar' });

        room.avatar = avatar;
        await room.save();

        const io = getIO();
        if (room.members?.length) {
            room.members.forEach(m => io.to(m).emit('update_chat_list'));
        }
        io.emit('room_updated', { roomId: room.roomId, avatar: room.avatar });

        res.json({ success: true, avatar: room.avatar });
    } catch (err) {
        console.error('[ROOM AVATAR UPDATE]', err);
        res.status(500).json({ error: err?.message || 'Server error' });
    }
});


module.exports = router;
