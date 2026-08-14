const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/authenticateToken');
const User = require('../models/User');
const Message = require('../models/Message');
const Dialog = require('../models/Dialog');
const { getDialogId } = require('../utils/dialog');
const { obscure } = require('../utils/crypto');
const { st } = require('../constants/translations');
const { getIO } = require('../socket/io');
const { sendPushNotification } = require('../services/push');

const REPORTS_DIR = path.join(__dirname, '..', 'data', 'reports');

function appendReport(entry) {
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const file = path.join(REPORTS_DIR, `${date}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
}

const CATEGORIES = ['bug', 'account', 'suggestion'];
const CATEGORY_LABELS = { bug: 'Ошибка', account: 'Аккаунт', suggestion: 'Предложение' };

async function notifyOwner(entry) {
    const recipient = String(process.env.REPORT_RECIPIENT || '').toLowerCase();
    const recipientUser = await User.findOne({ username: recipient }).lean();
    if (!recipient || !recipientUser) return;

    const time = new Date(entry.meta.timestamp).toLocaleString('ru-RU');
    let desc = String(entry.description || '');
    if (desc.length > 400) desc = desc.slice(0, 400) + '...';
    const categoryLabel = CATEGORY_LABELS[entry.category] || entry.category;
    const contact = entry.contact ? `Контакт: ${entry.contact}` : 'Контакт: не указан';
    const version = entry.meta.appVersion ? `Версия приложения: ${entry.meta.appVersion}` : 'Версия: не указана';

    let text = `📩 Новый отчёт об ошибке

От: ${entry.username}
Категория: ${categoryLabel}

${desc}

${contact}
${version}
Время: ${time}`;
    if (text.length > 900) text = text.slice(0, 900) + '...';

    const hiddenText = obscure(text);
    const dialogId = getDialogId(recipient, '4send_help');

    const msgDoc = await Message.create({
        dialog_id: dialogId, sender: '4send_help', receiver: recipient, text: hiddenText,
        is_read: false, read_by: ['4send_help'], timestamp: new Date()
    });

    await Dialog.findOneAndUpdate(
        { dialog_id: dialogId },
        {
            $set: {
                participants: [recipient, '4send_help'],
                lastMessageText: hiddenText,
                lastSender: '4send_help',
                lastMessageTimestamp: msgDoc.timestamp,
                lastIsAudio: false,
                lastIsMusic: false,
                lastIsVideoNote: false,
                lastFileUrl: null,
                lastFileName: null
            },
            $unset: { lastCallType: '', lastCallDuration: '', lastCallWithVideo: '' },
            $inc: { [`unreadCounts.${recipient}`]: 1 }
        },
        { upsert: true }
    );

    const io = getIO();
    if (io) {
        io.to(recipient).emit('new_message', {
            id: msgDoc._id.toString(),
            sender: '4send_help',
            receiver: recipient,
            text,
            timestamp: msgDoc.timestamp,
            isVerified: true,
            displayName: st('Поддержка 4SEND', 'ru'),
            senderAvatar: '/ico.png',
            is_read: false
        });
        io.to(recipient).emit('update_chat_list');
    }

    await sendPushNotification(recipient, {
        notification: { title: st('Поддержка 4SEND', 'ru'), body: `📩 ${categoryLabel}: ${entry.username}` },
        android: { notification: { channelId: '4send_channel', priority: 'high', sound: 'default', icon: '/ico.png' } },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        webpush: { notification: { icon: '/ico.png', badge: '/ico.png' } }
    });
}

router.post('/api/reports', authenticateToken, async (req, res) => {
    try {
        const category = String(req.body.category || 'bug');
        const description = String(req.body.description || '').trim();
        const contact = String(req.body.contact || '').trim();

        if (!CATEGORIES.includes(category)) {
            return res.status(400).json({ error: 'Invalid category' });
        }
        if (!description || description.length < 5 || description.length > 4000) {
            return res.status(400).json({ error: 'Description must be between 5 and 4000 characters' });
        }
        if (contact.length > 500) {
            return res.status(400).json({ error: 'Contact is too long' });
        }

        let meta = null;
        try {
            meta = {
                appVersion: String(req.body.appVersion || '').slice(0, 50),
                userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
                timestamp: new Date().toISOString(),
            };
        } catch { meta = null; }

        appendReport({
            username: req.user.username,
            category,
            description,
            contact: contact || null,
            meta,
        });

        try {
            await notifyOwner({
                username: req.user.username,
                category,
                description,
                contact: contact || null,
                meta,
            });
        } catch (e) {}

        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;