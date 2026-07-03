const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authenticateToken');
const User = require('../models/User');

router.post('/api/save-push-token', authenticateToken, async (req, res) => {
    try {
        const token = req.body.token;
        if (token !== null && token !== '' && (typeof token !== 'string' || token.length > 500 || token.length < 10)) {
            return res.status(400).json({ error: 'Invalid token' });
        }
        const user = await User.findOne({ username: req.user.username }).lean();
        if (!user) return res.status(404).json({ error: 'Not found' });
        if (user.pushToken && user.pushToken !== token) {
            const { sendPushNotification } = require('../services/push');
            await sendPushNotification(req.user.username, {
                notification: { title: 'Push Token Changed', body: 'Your notification device was changed. If this was not you, check your account security.' }
            });
        }
        await User.updateOne({ username: req.user.username }, { $set: { pushToken: token || null } });
        res.json({ success: true });
    } catch { res.status(500).send(''); }
});

module.exports = router;
