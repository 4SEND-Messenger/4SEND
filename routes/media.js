const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticateToken } = require('../middleware/authenticateToken');
const Message = require('../models/Message');
const Reaction = require('../models/Reaction');
const { getDialogId } = require('../utils/dialog');
const { clarify } = require('../utils/crypto');

router.get('/api/reactions/:msgId', authenticateToken, async (req, res) => {
    try {
        const reactions = await Reaction.aggregate([
            { $match: { message_id: new mongoose.Types.ObjectId(req.params.msgId) } },
            { $group: { _id: "$emoji", count: { $sum: 1 } } }
        ]);
        res.json(reactions.map(r => ({ emoji: r._id, count: r.count })));
    } catch { res.status(500).json([]); }
});

router.get('/api/shared-media/:target', authenticateToken, async (req, res) => {
    try {
        const me = req.user.username.toLowerCase();
        const target = req.params.target.toLowerCase();
        const dialogId = getDialogId(me, target);

        const messages = await Message.find({
            dialog_id: dialogId,
            $or: [
                { fileUrl: { $nin: [null, '', 'dummy'] } },
                { fileUrls: { $not: { $size: 0 } } }
            ]
        }).select('fileUrl fileUrls isAudio isMusic isVideoNote').lean();

        let photos = 0, videos = 0, voices = 0, music = 0, files = 0;

        messages.forEach(m => {
            const urls = m.fileUrls && m.fileUrls.length > 0 ? m.fileUrls : [m.fileUrl];
            urls.forEach(url => {
                if (!url || url === 'dummy') return;
                if (m.isAudio || m.isVideoNote) voices++;
                else if (m.isMusic || url.toLowerCase().includes('.mp3')) music++;
                else {
                    const extMatch = url.match(/\.([^.?#]+)(?:[?#]|$)/i);
                    const ext = extMatch ? extMatch[1].toLowerCase() : '';
                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) photos++;
                    else if (['mp4', 'webm', 'mov'].includes(ext)) videos++;
                    else files++;
                }
            });
        });

        res.json({ photos, videos, voices, music, files });
    } catch (e) {
        res.json({ photos: 0, videos: 0, voices: 0, music: 0, files: 0 });
    }
});

router.get('/api/shared-media-list/:target', authenticateToken, async (req, res) => {
    try {
        const me = req.user.username.toLowerCase();
        const target = req.params.target.toLowerCase();
        const type = req.query.type;
        const dialogId = getDialogId(me, target);

        const messages = await Message.find({
            dialog_id: dialogId,
            $or: [
                { fileUrl: { $nin: [null, '', 'dummy'] } },
                { fileUrls: { $not: { $size: 0 } } }
            ]
        }).sort({ timestamp: -1 }).lean();

        let filtered = [];
        messages.forEach(m => {
            const urls = m.fileUrls && m.fileUrls.length > 0 ? m.fileUrls : [m.fileUrl];
            urls.forEach((url, idx) => {
                if (!url || url === 'dummy') return;
                const extMatch = url.match(/\.([^.?#]+)(?:[?#]|$)/i);
                const ext = extMatch ? extMatch[1].toLowerCase() : '';

                let match = false;
                if (type === 'voices' && (m.isAudio || m.isVideoNote)) match = true;
                else if (type === 'videos' && ['mp4', 'webm', 'mov'].includes(ext) && !m.isVideoNote) match = true;
                else if (type === 'music' && (m.isMusic || ext === 'mp3')) match = true;
                else if (type === 'photos' && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) match = true;
                else if (type === 'files' && !m.isAudio && !m.isVideoNote && !m.isMusic && ext !== 'mp3' && !['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'].includes(ext)) match = true;

                if (match) {
                    filtered.push({
                        id: m._id.toString() + (idx > 0 ? `_${idx}` : ''),
                        fileUrl: url,
                        fileName: m.fileName,
                        timestamp: m.timestamp,
                        text: clarify(m.text, m._id.toString()),
                        isVideoNote: m.isVideoNote,
                        isAudio: m.isAudio
                    });
                }
            });
        });

        res.json(filtered);
    } catch (e) {
        res.json([]);
    }
});

module.exports = router;
