const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticateToken } = require('../middleware/authenticateToken');
const User = require('../models/User');
const Message = require('../models/Message');
const Room = require('../models/Room');
const { nukeUserAccount } = require('../services/auth');
const { getIO, onlineUsers } = require('../socket/io');

router.get('/api/admin/stats', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const objectIdFromDate = (date) => {
            return Math.floor(date.getTime() / 1000).toString(16) + "0000000000000000";
        };
        const todayId = new mongoose.Types.ObjectId(objectIdFromDate(startOfDay));
        const thirtyDaysId = new mongoose.Types.ObjectId(objectIdFromDate(thirtyDaysAgo));

        const [usersCount, roomsCount, usersToday, roomsToday, messagesTotal, messagesToday] = await Promise.all([
            User.countDocuments(),
            Room.countDocuments(),
            User.countDocuments({ _id: { $gte: todayId } }),
            Room.countDocuments({ timestamp: { $gte: startOfDay } }),
            Message.countDocuments(),
            Message.countDocuments({ timestamp: { $gte: startOfDay } })
        ]);

        const onlineCount = onlineUsers.size;

        const usersChart = await User.aggregate([
            { $match: { _id: { $gte: thirtyDaysId } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$_id" } } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const roomsChart = await Room.aggregate([
            { $match: { timestamp: { $gte: thirtyDaysAgo } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const msgsChart = await Message.aggregate([
            { $match: { timestamp: { $gte: thirtyDaysAgo } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            users: usersCount, rooms: roomsCount, messagesToday, onlineCount,
            usersToday, roomsToday, messagesTotal,
            charts: { users: usersChart, rooms: roomsChart, messages: msgsChart }
        });
    } catch {
        res.status(500).json({ users: 0, rooms: 0, messagesToday: 0, onlineCount: 0, usersToday: 0, roomsToday: 0, messagesTotal: 0 });
    }
});

router.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const users = await User.find({}).select('username avatar isVerified role last_seen').lean();
        const usersWithOnline = users.map(u => ({
            ...u,
            isOnline: onlineUsers.has(u.username.toLowerCase())
        }));
        res.json(usersWithOnline);
    } catch { res.status(500).json([]); }
});

router.get('/api/admin/user/:username', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const target = req.params.username;
        const user = await User.findOne({ username: target }).select('-password -panicPassword -twoFactorPassword -sessions -pushToken').lean();
        if (!user) return res.status(404).json({ error: 'Not found' });

        const msgCount = await Message.countDocuments({ sender: target });
        const roomCount = await Room.countDocuments({ owner: target });

        res.json({ ...user, msgCount, roomCount });
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/api/admin/toggle-verify', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const { targetUsername, verify } = req.body;
        await User.updateOne({ username: targetUsername }, { $set: { isVerified: verify } });
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/api/admin/delete-user', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const { targetUsername } = req.body;
        await nukeUserAccount(targetUsername);
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/api/admin/ban-user', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const { targetUsername, ban } = req.body;
        const newRole = ban ? 'banned' : 'user';
        await User.updateOne({ username: targetUsername }, { $set: { role: newRole } });
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
