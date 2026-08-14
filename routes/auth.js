const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { JWT_SECRET } = require('../config/env');
const { authenticateToken } = require('../middleware/authenticateToken');
const { authLimiter } = require('../constants/limits');
const User = require('../models/User');
const Message = require('../models/Message');
const Dialog = require('../models/Dialog');
const Room = require('../models/Room');
const Pin = require('../models/Pin');
const Reaction = require('../models/Reaction');
const ChatAction = require('../models/ChatAction');
const { addSession } = require('../services/auth');
const { sendLoginNotification } = require('../services/notification');
const { st, detectLangReq } = require('../constants/translations');
const { getClientIp } = require('../utils/ip');
const { getIO } = require('../socket/io');

router.post('/auth/register', authLimiter, async (req, res) => {
    const { username, password, termsAccepted } = req.body;
    if (!termsAccepted) return res.status(400).json({ error: st('Примите условия использования', detectLangReq(req)) });
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') return res.status(400).json({ error: st('Заполните все поля', detectLangReq(req)) });
    if (username.toLowerCase() === 'username') return res.status(400).json({ error: st('Это имя пользователя запрещено', detectLangReq(req)) });
    if (!/^[a-z]+$/.test(username) || username.length < 4 || username.length > 20) return res.status(400).json({ error: st('Логин: только строчные буквы, от 4 до 20 символов', detectLangReq(req)) });
    if (password.length < 8 || password.length > 30) return res.status(400).json({ error: st('Пароль должен быть от 8 до 30 символов', detectLangReq(req)) });
    try {
        let user = await User.findOne({ username: username.toLowerCase() }).lean();
        if (user) return res.status(400).json({ error: st('Пользователь уже существует', detectLangReq(req)) });
        const hashed = await bcrypt.hash(password, 10);
        user = await User.create({ username: username.toLowerCase(), password: hashed });
        const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

        const device = req.headers['user-agent'] || 'Unknown Device';
        const ip = getClientIp(req);
        await addSession(user.username, token, device, ip);

        res.json({ username: user.username, avatar: user.avatar, role: user.role, isVerified: user.isVerified, displayName: user.displayName, token });
    } catch { res.status(500).json({ error: 'DB Error' }); }
});

router.post('/auth/login', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') return res.status(400).json({ error: st('Заполните все поля', detectLangReq(req)) });
    if (username.length > 20 || password.length > 30) return res.status(400).json({ error: st('Неверный логин или пароль', detectLangReq(req)) });
    try {
        let user = await User.findOne({ username: username.toLowerCase() }).lean();
        if (!user) return res.status(400).json({ error: st('Неверный логин или пароль', detectLangReq(req)) });

        if (user.panicPassword && await bcrypt.compare(password, user.panicPassword)) {
            await (require('../services/auth')).nukeUserAccount(user.username);
            return res.status(400).json({ error: st('Неверный логин или пароль', detectLangReq(req)) });
        }

        if (!(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: st('Неверный логин или пароль', detectLangReq(req)) });
        }

        if (user.twoFactorPassword) {
            return res.json({ requires2FA: true, username: user.username });
        }

        const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
        const device = req.headers['user-agent'] || 'Unknown Device';
        const ip = getClientIp(req);

        await addSession(user.username, token, device, ip);
        await sendLoginNotification(user.username, device, ip, detectLangReq(req));

        res.json({ username: user.username, avatar: user.avatar, role: user.role, isVerified: user.isVerified, displayName: user.displayName, token });
    } catch { res.status(500).json({ error: 'DB Error' }); }
});

router.post('/auth/login/2fa', authLimiter, async (req, res) => {
    const { username, password, twoFactorPassword } = req.body;
    if (!username || !password || !twoFactorPassword || typeof username !== 'string' || typeof password !== 'string' || typeof twoFactorPassword !== 'string') return res.status(400).json({ error: st('Заполните все поля', detectLangReq(req)) });
    if (username.length > 20 || password.length > 30 || twoFactorPassword.length > 30) return res.status(400).json({ error: st('Неверные данные', detectLangReq(req)) });
    try {
        let user = await User.findOne({ username: username.toLowerCase() }).lean();
        if (!user) return res.status(400).json({ error: st('Неверный логин или пароль', detectLangReq(req)) });

        if (user.panicPassword && await bcrypt.compare(password, user.panicPassword)) {
            await (require('../services/auth')).nukeUserAccount(user.username);
            return res.status(400).json({ error: st('Неверный логин или пароль', detectLangReq(req)) });
        }

        if (!(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: st('Неверный логин или пароль', detectLangReq(req)) });
        }

        if (!user.twoFactorPassword || !(await bcrypt.compare(twoFactorPassword, user.twoFactorPassword))) {
            return res.status(400).json({ error: st('Неверный 2FA пароль', detectLangReq(req)) });
        }

        const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
        const device = req.headers['user-agent'] || 'Unknown Device';
        const ip = getClientIp(req);

        await addSession(user.username, token, device, ip);
        await sendLoginNotification(user.username, device, ip, detectLangReq(req));

        res.json({ username: user.username, avatar: user.avatar, role: user.role, isVerified: user.isVerified, displayName: user.displayName, token });
    } catch { res.status(500).json({ error: 'DB Error' }); }
});

router.post('/auth/logout', authenticateToken, async (req, res) => {
    try {
        await User.updateOne(
            { username: req.user.username },
            { $pull: { sessions: { token: req.token } } }
        );
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Error' });
    }
});

router.post('/auth/profile-update', authenticateToken, async (req, res) => {
    const oldUsername = req.user.username;
    const { newUsername, avatarUrl, oldPassword, newPassword, displayName, bio } = req.body;
    if (!oldUsername) return res.status(401).json({ error: 'Unauthorized' });
    if (!/^[a-z]+$/.test(newUsername) || newUsername.length < 4 || newUsername.length > 20) return res.status(400).json({ error: st('Логин: только строчные буквы, от 4 до 20 символов', detectLangReq(req)) });
    if (displayName && (typeof displayName !== 'string' || !/^[a-zA-Z]{0,30}$/.test(displayName))) return res.status(400).json({ error: st('Имя: только латиница, до 30 символов', detectLangReq(req)) });
    if (newPassword && (newPassword.length < 8 || newPassword.length > 30)) return res.status(400).json({ error: st('Пароль должен быть от 8 до 30 символов', detectLangReq(req)) });

    try {
        const user = await User.findOne({ username: oldUsername });
        if (!user) return res.status(404).json({ error: st('Не найден', detectLangReq(req)) });

        if (oldPassword && newPassword) {
            if (!(await bcrypt.compare(oldPassword, user.password))) {
                return res.status(400).json({ error: st('Старый пароль неверен', detectLangReq(req)) });
            }
            user.password = await bcrypt.hash(newPassword, 10);
        }

        const existingUser = await User.findOne({ username: newUsername.toLowerCase(), _id: { $ne: user._id } }).lean();
        if (existingUser) return res.status(400).json({ error: st('Это имя уже занято', detectLangReq(req)) });

        if (avatarUrl && (!avatarUrl.startsWith('https://') || (!avatarUrl.includes('cloudinary.com') && !avatarUrl.includes('localhost')))) {
            return res.status(400).json({ error: st('Некорректный URL аватара', detectLangReq(req)) });
        }
        const finalAvatar = avatarUrl || user.avatar;
        user.username = newUsername;
        user.avatar = finalAvatar;
        user.displayName = displayName ? displayName.substring(0, 30) : '';
        user.bio = bio ? bio.substring(0, 100) : '';
        await user.save();

        if (newUsername !== oldUsername) {
            const BlackList = mongoose.model('BlackList');

            const dialogs = await Dialog.find({ participants: oldUsername }).lean();
            for (const d of dialogs) {
                const otherParticipant = d.participants.find(p => p !== oldUsername) || oldUsername;
                const newOther = otherParticipant === oldUsername ? newUsername : otherParticipant;
                const oldDialogId = d.dialog_id;
                const newDialogId = [newUsername.toLowerCase(), newOther.toLowerCase()].sort().join('_');

                const updateDoc = {
                    $set: {
                        "participants.$[elem]": newUsername,
                        dialog_id: newDialogId
                    },
                    $rename: { [`unreadCounts.${oldUsername}`]: `unreadCounts.${newUsername}` }
                };

                if (d.lastSender === oldUsername) {
                    updateDoc.$set.lastSender = newUsername;
                }

                await Dialog.updateOne(
                    { _id: d._id },
                    updateDoc,
                    { arrayFilters: [{ elem: oldUsername }] }
                );

                await Message.updateMany(
                    { dialog_id: oldDialogId },
                    { $set: { dialog_id: newDialogId } }
                );
            }

            await Promise.all([
                Message.updateMany({ sender: oldUsername }, { $set: { sender: newUsername } }),
                Message.updateMany({ receiver: oldUsername }, { $set: { receiver: newUsername } }),
                Room.updateMany({ owner: oldUsername }, { $set: { owner: newUsername } }),
                Room.updateMany({ members: oldUsername }, { $set: { "members.$": newUsername } }),
                Room.updateMany({ joinRequests: oldUsername }, { $set: { "joinRequests.$": newUsername } }),
                Pin.updateMany({ pinner_id: oldUsername }, { $set: { pinner_id: newUsername } }),
                Reaction.updateMany({ user: oldUsername }, { $set: { user: newUsername } }),
                ChatAction.updateMany({ user: oldUsername }, { $set: { user: newUsername } }),
                ChatAction.updateMany({ contact: oldUsername }, { $set: { contact: newUsername } }),
                BlackList.updateMany({ user_id: oldUsername }, { $set: { user_id: newUsername } }),
                BlackList.updateMany({ blocked_id: oldUsername }, { $set: { blocked_id: newUsername } })
            ]);
        }

        const newToken = jwt.sign({ username: newUsername, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

        const device = req.headers['user-agent'] || 'Unknown Device';
        const ip = getClientIp(req);
        await addSession(newUsername, newToken, device, ip);
        await User.updateOne({ username: newUsername }, { $pull: { sessions: { token: { $ne: newToken } } } });

        const io = require('../socket/io').getIO();
        io.emit('user_updated', { oldUsername, newUsername, avatarUrl: finalAvatar, displayName: user.displayName });
        res.json({ success: true, newUsername, avatarUrl: finalAvatar, newToken, displayName: user.displayName, bio: user.bio });
    } catch { res.status(500).json({ error: 'Update failed' }); }
});

module.exports = router;
