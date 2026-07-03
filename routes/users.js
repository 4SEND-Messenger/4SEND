const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticateToken } = require('../middleware/authenticateToken');
const User = require('../models/User');
const Message = require('../models/Message');
const Room = require('../models/Room');
const Dialog = require('../models/Dialog');
const { checkServerPrivacy } = require('../middleware/privacyWrapper');
const { st, detectLangReq } = require('../constants/translations');
const { escapeRegex } = require('../utils/escapeRegex');
const { getDialogId } = require('../utils/dialog');

router.get('/users', authenticateToken, async (req, res) => {
    try {
        const q = (req.query.q || '').toString().trim();
        const query = q ? { username: { $regex: escapeRegex(q), $options: 'i' } } : {};
        let users = await User.find(query).select('username avatar isVerified displayName').limit(50).lean();

        const requester = req.user.username.toLowerCase();

        users = users.filter(u => checkServerPrivacy(u.username, requester, 'search')).slice(0, 20);
        res.json(users);
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.get('/api/status/:username', authenticateToken, async (req, res) => {
    try {
        const target = req.params.username.toLowerCase();
        const requester = req.user.username.toLowerCase();

        if (target === '4send_system') {
            return res.json({
                last_seen: null, avatar: '/ico.png', is_blocked: false, isVerified: true,
                displayName: st('Системные уведомления', detectLangReq(req)), bio: st('Уведомления от системы.', detectLangReq(req)), copyRestriction: false, forwardRestriction: false, screenshotNotification: false
            });
        }
        if (target === '4send_help') {
            return res.json({
                last_seen: new Date(), avatar: '/ico.png', is_blocked: false, isVerified: true,
                displayName: st('Поддержка 4SEND', detectLangReq(req)), bio: st('Решу вашу проблему за минуту, уверяю.', detectLangReq(req)), copyRestriction: false, forwardRestriction: false, screenshotNotification: false
            });
        }

        const BlackList = mongoose.model('BlackList');

        const [heBlockedMe, iBlockedHim, user, hasDirectMsg, commonRoom, dialog] = await Promise.all([
            BlackList.findOne({ user_id: target, blocked_id: requester }).lean(),
            BlackList.findOne({ user_id: requester, blocked_id: target }).lean(),
            User.findOne({ username: target }).select('last_seen avatar isVerified displayName bio').lean(),
            Message.findOne({
                $or: [
                    { sender: requester, receiver: target },
                    { sender: target, receiver: requester }
                ]
            }).select('_id').lean(),
            Room.findOne({ members: { $all: [requester, target] } }).select('_id').lean(),
            Dialog.findOne({ dialog_id: getDialogId(requester, target) }).lean()
        ]);

        if (!user) return res.status(404).json({ error: 'Not found' });

        if (heBlockedMe) return res.json({ last_seen: null, avatar: null, is_blocked: true, is_invisible: true, isVerified: false, displayName: user.displayName, bio: '', copyRestriction: false, forwardRestriction: false, screenshotNotification: false });

        let finalLastSeen = user.last_seen;
        if (target !== requester && !hasDirectMsg && !commonRoom) {
            finalLastSeen = null;
        }

        res.json({
            last_seen: finalLastSeen,
            avatar: user.avatar,
            is_blocked: false,
            isVerified: user.isVerified || false,
            displayName: user.displayName || '',
            bio: checkServerPrivacy(target, requester, 'bio') ? (user.bio || '') : '',
            copyRestriction: dialog ? dialog.copyRestriction : false,
            forwardRestriction: dialog ? dialog.forwardRestriction : false,
            screenshotNotification: dialog ? dialog.screenshotNotification : false
        });
    } catch {
        res.status(500).json({ last_seen: null, avatar: null, isVerified: false, displayName: '', bio: '', copyRestriction: false, forwardRestriction: false, screenshotNotification: false });
    }
});

router.get('/api/check-username', authenticateToken, async (req, res) => {
    try {
        const { username } = req.query;
        if (!username || username.length < 4 || !/^[a-z]+$/.test(username)) {
            return res.json({ available: false });
        }
        if (username === req.user.username) {
            return res.json({ available: true });
        }
        const exists = await User.findOne({ username }).lean();
        res.json({ available: !exists });
    } catch {
        res.json({ available: false });
    }
});

module.exports = router;
