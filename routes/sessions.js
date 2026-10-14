const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authenticateToken');
const User = require('../models/User');
const { kickSessions } = require('../socket/kick');

router.get('/api/sessions', authenticateToken, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.user.username }).lean();
        const sessions = (user.sessions || []).map(s => ({
            token: s.token,
            device: s.device,
            ip: s.ip ? s.ip.replace(/\d+$/, 'xxx') : null,
            lastActive: s.lastActive,
            isCurrent: s.token === req.token
        }));
        res.json(sessions);
    } catch { res.status(500).json([]); }
});

router.post('/api/sessions/revoke', authenticateToken, async (req, res) => {
    try {
        const token = req.body && req.body.token;
        if (!token) return res.status(400).json({ error: 'Invalid token' });
        await User.updateOne({ username: req.user.username }, { $pull: { sessions: { token } } });
        kickSessions(req.user.username, t => t === token);
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/api/sessions/revoke-all', authenticateToken, async (req, res) => {
    try {
        const currentToken = req.token;
        await User.updateOne(
            { username: req.user.username },
            { $pull: { sessions: { token: { $ne: currentToken } } } }
        );
        kickSessions(req.user.username, t => t !== currentToken);
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
