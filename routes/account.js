const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../middleware/authenticateToken');
const User = require('../models/User');
const { nukeUserAccount } = require('../services/auth');
const { st, detectLangReq } = require('../constants/translations');

router.post('/api/delete-account', authenticateToken, async (req, res) => {
    const username = req.user.username;
    const { password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: st('Требуется пароль', detectLangReq(req)) });
    try {
        const user = await User.findOne({ username }).lean();
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ success: false, error: st('Неверный пароль', detectLangReq(req)) });
        }
        const deleted = await nukeUserAccount(username);
        if (!deleted) return res.status(404).json({ success: false });
        res.json({ success: true });
    } catch { res.status(500).json({ success: false }); }
});

module.exports = router;
