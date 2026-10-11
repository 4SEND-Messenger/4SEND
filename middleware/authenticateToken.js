const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../config/env');
const { shouldUpdateLastActive } = require('../utils/lastActive');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token || !JWT_SECRET) return res.status(401).json({ error: 'Unauthorized' });
    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err || !decoded || typeof decoded.username !== 'string') {
            const msg = err && err.name === 'TokenExpiredError' ? 'Session expired' : 'Unauthorized';
            return res.status(401).json({ error: msg });
        }
        try {
            const username = decoded.username.trim().toLowerCase();
            if (!/^[a-z]{4,20}$/.test(username)) return res.status(401).json({ error: 'Unauthorized' });
            const user = await User.findOne({ username }).lean();
            if (!user || user.role === 'banned') return res.status(403).json({ error: 'Banned' });
            const isValid = Array.isArray(user.sessions) && user.sessions.some(s => s && s.token === token);
            if (!isValid) return res.status(401).json({ error: 'Session expired' });
            if (shouldUpdateLastActive(username, token)) {
                await User.updateOne(
                    { username, "sessions.token": token },
                    { $set: { "sessions.$.lastActive": new Date(), last_seen: new Date() } }
                );
            }
            req.user = { ...decoded, username, role: user.role };
            req.token = token;
            next();
        } catch {
            res.status(500).json({ error: 'Server error' });
        }
    });
};

module.exports = { authenticateToken };
