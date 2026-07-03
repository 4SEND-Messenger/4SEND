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
        const query = me === target
            ? { chat_id: me, pinner_id: me }
            : { $or: [{ chat_id: me, pinner_id: target, pin_type: 'both' }, { chat_id: target, pinner_id: me, pin_type: 'both' }, { chat_id: target, pinner_id: me, pin_type: 'me' }] };
        const pins = await Pin.find(query).sort({ timestamp: -1 }).lean();
        res.json(pins.map(p => ({ id: p.message_id, text: clarify(p.text_preview) })));
    } catch { res.status(500).json([]); }
});

module.exports = router;
