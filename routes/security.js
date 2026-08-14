const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../middleware/authenticateToken');
const { securityLimiter } = require('../constants/limits');
const User = require('../models/User');
const { st, detectLangReq } = require('../constants/translations');

router.post('/api/panic-password/setup', authenticateToken, securityLimiter, async (req, res) => {
    const { password, panicPassword } = req.body;
    if (!password || !panicPassword) return res.status(400).json({ error: st('Заполните все поля', detectLangReq(req)) });
    if (panicPassword.length < 8 || panicPassword.length > 30) return res.status(400).json({ error: st('Тревожный пароль должен быть от 8 до 30 символов', detectLangReq(req)) });
    try {
        const user = await User.findOne({ username: req.user.username }).lean();
        if (!(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: st('Неверный основной пароль', detectLangReq(req)) });
        }
        if (await bcrypt.compare(panicPassword, user.password)) {
            return res.status(400).json({ error: st('Тревожный пароль не должен совпадать с основным', detectLangReq(req)) });
        }
        const hashed = await bcrypt.hash(panicPassword, 10);
        await User.updateOne({ username: req.user.username }, { $set: { panicPassword: hashed } });
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.get('/api/2fa/status', authenticateToken, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.user.username }).lean();
        res.json({ enabled: !!user.twoFactorPassword });
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/api/2fa/setup', authenticateToken, securityLimiter, async (req, res) => {
    const { password, twoFactorPassword } = req.body;
    if (!password || !twoFactorPassword) return res.status(400).json({ error: st('Заполните все поля', detectLangReq(req)) });
    if (twoFactorPassword.length < 4 || twoFactorPassword.length > 30) return res.status(400).json({ error: st('2FA пароль должен быть от 4 до 30 символов', detectLangReq(req)) });
    try {
        const user = await User.findOne({ username: req.user.username }).lean();
        if (!(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: st('Неверный основной пароль', detectLangReq(req)) });
        }
        const hashed = await bcrypt.hash(twoFactorPassword, 10);
        await User.updateOne({ username: req.user.username }, { $set: { twoFactorPassword: hashed } });
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/api/2fa/disable', authenticateToken, securityLimiter, async (req, res) => {
    const { password, twoFactorPassword } = req.body;
    if (!password || !twoFactorPassword) return res.status(400).json({ error: st('Заполните все поля', detectLangReq(req)) });
    try {
        const user = await User.findOne({ username: req.user.username }).lean();
        if (!(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: st('Неверный основной пароль', detectLangReq(req)) });
        }
        if (!(await bcrypt.compare(twoFactorPassword, user.twoFactorPassword))) {
            return res.status(400).json({ error: st('Неверный 2FA пароль', detectLangReq(req)) });
        }
        await User.updateOne({ username: req.user.username }, { $set: { twoFactorPassword: null } });
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.get('/api/archive/password/status', authenticateToken, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.user.username }).lean();
        res.json({ hasPassword: !!user.archivePassword });
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/api/archive/password/setup', authenticateToken, securityLimiter, async (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 4 || password.length > 30) return res.status(400).json({ error: st('Пароль должен быть от 4 до 30 символов', detectLangReq(req)) });
    try {
        const hashed = await bcrypt.hash(password, 10);
        await User.updateOne({ username: req.user.username }, { $set: { archivePassword: hashed } });
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/api/archive/password/remove', authenticateToken, async (req, res) => {
    const { password } = req.body;
    try {
        const user = await User.findOne({ username: req.user.username }).lean();
        if (!user.archivePassword) return res.status(400).json({ error: st('Пароль не установлен', detectLangReq(req)) });
        if (!(await bcrypt.compare(password, user.archivePassword))) return res.status(400).json({ error: st('Неверный пароль', detectLangReq(req)) });
        await User.updateOne({ username: req.user.username }, { $set: { archivePassword: null } });
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/api/archive/password/change', authenticateToken, securityLimiter, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: st('Введите старый и новый пароль', detectLangReq(req)) });
    if (newPassword.length < 4 || newPassword.length > 30) return res.status(400).json({ error: st('Пароль должен быть от 4 до 30 символов', detectLangReq(req)) });
    try {
        const user = await User.findOne({ username: req.user.username }).lean();
        if (!user.archivePassword) return res.status(400).json({ error: st('Пароль не установлен', detectLangReq(req)) });
        if (!(await bcrypt.compare(oldPassword, user.archivePassword))) return res.status(400).json({ error: st('Неверный пароль', detectLangReq(req)) });
        const hashed = await bcrypt.hash(newPassword, 10);
        await User.updateOne({ username: req.user.username }, { $set: { archivePassword: hashed } });
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/api/archive/password/verify', authenticateToken, async (req, res) => {
    const { password } = req.body;
    try {
        const user = await User.findOne({ username: req.user.username }).lean();
        if (!user.archivePassword) return res.json({ success: true });
        if (!(await bcrypt.compare(password, user.archivePassword))) return res.status(400).json({ error: st('Неверный пароль', detectLangReq(req)) });
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
