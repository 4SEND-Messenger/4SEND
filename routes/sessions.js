const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authenticateToken');
const User = require('../models/User');

router.get('/api/sessions', authenticateToken, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.user.username }).lean();
        const sessions = (user.sessions || []).map(s => ({
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
        await User.updateOne({ username: req.user.username }, { $pull: { sessions: { token: req.body.token } } });
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
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
