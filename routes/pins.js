const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authenticateToken');
const Pin = require('../models/Pin');
const { clarify } = require('../utils/crypto');
const { st, detectLangReq } = require('../constants/translations');

router.get('/api/get-pins/:me/:target', authenticateToken, async (req, res) => {
    const me = req.params.me.toLowerCase();
    const target = req.params.target.toLowerCase();

    if (req.user.username.toLowerCase() !== me) {
        return res.status(403).json({ error: st('Нет доступа', detectLangReq(req)) });
    }

    try {
        let query;
        if (me === target) {
            query = { chat_id: me, pinner_id: me };
        } else if (target.startsWith('room_')) {
            query = { chat_id: target, $or: [{ pinner_id: me }, { pin_type: 'both' }] };
        } else {
            query = { $or: [
                { chat_id: me, pinner_id: target, pin_type: 'both' },
                { chat_id: target, pinner_id: me, pin_type: { $in: ['both', 'me', 'self'] } }
            ] };
        }
        const pins = await Pin.find(query).sort({ timestamp: -1 }).lean();
        const seen = new Set();
        const unique = pins.filter(p => {
            const id = String(p.message_id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
        res.json(unique.map(p => ({ id: p.message_id, text: clarify(p.text_preview) })));
    } catch { res.status(500).json([]); }
});

module.exports = router;
