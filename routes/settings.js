const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authenticateToken');
const User = require('../models/User');
const Room = require('../models/Room');
const Dialog = require('../models/Dialog');
const { getDialogId } = require('../utils/dialog');
const { broadcastSystemAction } = require('../services/notification');
const { st, detectLangReq } = require('../constants/translations');
const { getIO } = require('../socket/io');

router.post('/api/privacy', authenticateToken, async (req, res) => {
    try {
        const p = req.body;
        await User.updateOne({ username: req.user.username }, { $set: { privacy: JSON.stringify(p) } });
        global.privacyMap.set(req.user.username.toLowerCase(), p);
        const io = getIO();
        io.emit('privacy_sync', Object.fromEntries(global.privacyMap));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "DB Error" });
    }
});

router.post('/api/auto-delete', authenticateToken, async (req, res) => {
    try {
        const { months } = req.body;
        if (![3, 6, 12].includes(months)) return res.status(400).json({ error: "Invalid value" });
        await User.updateOne({ username: req.user.username }, { $set: { autoDeleteMonths: months } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "DB Error" });
    }
});

router.post('/api/auto-logout', authenticateToken, async (req, res) => {
    try {
        const { days } = req.body;
        if (![1, 7, 30, 180].includes(days)) return res.status(400).json({ error: "Invalid value" });
        await User.updateOne({ username: req.user.username }, { $set: { autoLogoutDays: days } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "DB Error" });
    }
});

router.get('/api/security-settings', authenticateToken, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.user.username }).lean();
        if (!user) return res.status(404).json({ error: 'Not found' });
        const repeat = Number(user.notificationRepeat);
        res.json({
            autoLogoutDays: user.autoLogoutDays || 7,
            autoDeleteMonths: user.autoDeleteMonths || 6,
            notificationRepeat: Number.isFinite(repeat) ? repeat : 5
        });
    } catch (err) {
        res.status(500).json({ error: "DB Error" });
    }
});

router.post('/api/notification-repeat', authenticateToken, async (req, res) => {
    try {
        const minutes = parseInt(req.body.minutes);
        if (isNaN(minutes) || minutes < 0 || minutes > 1440) return res.status(400).json({ error: 'Invalid' });
        await User.updateOne({ username: req.user.username }, { $set: { notificationRepeat: minutes } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "DB Error" });
    }
});

router.post('/api/toggle-chat-auto-delete', authenticateToken, async (req, res) => {
    try {
        const { target, timer } = req.body;
        const me = req.user.username;
        const actionText = timer > 0 ? st('установил(а) таймер автоудаления сообщений', detectLangReq(req)) : st('отключил(а) автоудаление сообщений', detectLangReq(req));

        if (target.startsWith('room_')) {
            const room = await Room.findOne({ roomId: target }).lean();
            if (!room || room.owner !== me) return res.status(403).json({ error: 'Not owner' });
            await Room.updateOne({ roomId: target }, { $set: { autoDeleteTimer: timer } });
        } else {
            const dialogId = getDialogId(me, target);
            await Dialog.updateOne({ dialog_id: dialogId }, { $set: { autoDeleteTimer: timer } });
        }

        await broadcastSystemAction(me, target, actionText);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.post('/api/toggle-chat-privacy', authenticateToken, async (req, res) => {
    try {
        const { target, type, state } = req.body;
        const me = req.user.username;
        let updateField = {};
        let actionText = '';

        if (type === 'copy') {
            updateField = { copyRestriction: state };
            actionText = state ? st('включил(а) запрет копирования', detectLangReq(req)) : st('выключил(а) запрет копирования', detectLangReq(req));
        } else if (type === 'forward') {
            updateField = { forwardRestriction: state };
            actionText = state ? st('скрыл(а) информацию о пересылке', detectLangReq(req)) : st('открыл(а) информацию о пересылке', detectLangReq(req));
        } else if (type === 'screenshot') {
            updateField = { screenshotNotification: state };
            actionText = state ? st('включил(а) уведомления о скриншотах', detectLangReq(req)) : st('выключил(а) уведомления о скриншотах', detectLangReq(req));
        }

        if (target.startsWith('room_')) {
            const room = await Room.findOne({ roomId: target }).lean();
            if (!room || room.owner !== me) return res.status(403).json({ error: 'Not owner' });
            await Room.updateOne({ roomId: target }, { $set: updateField });
        } else {
            const dialogId = getDialogId(me, target);
            await Dialog.updateOne({ dialog_id: dialogId }, { $set: updateField });
        }

        await broadcastSystemAction(me, target, actionText);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.post('/api/screenshot-notify', authenticateToken, async (req, res) => {
    try {
        const { target } = req.body;
        const me = req.user.username;

        let isEnabled = false;
        if (target.startsWith('room_')) {
            const room = await Room.findOne({ roomId: target }).lean();
            if (room && room.screenshotNotification) isEnabled = true;
        } else {
            const dialogId = getDialogId(me, target);
            const dialog = await Dialog.findOne({ dialog_id: dialogId }).lean();
            if (dialog && dialog.screenshotNotification) isEnabled = true;
        }

        if (isEnabled) {
            await broadcastSystemAction(me, target, st('сделал(а) скриншот', detectLangReq(req)));
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
