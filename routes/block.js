const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authenticateToken');
const BlackList = require('../models/BlackList');
const { st, detectLangReq } = require('../constants/translations');

router.post('/api/toggle-block', authenticateToken, async (req, res) => {
    const { me, target } = req.body;
    if (!me || !target) return res.status(400).json({ error: st("Данные не полные", detectLangReq(req)) });

    try {
        const check = await BlackList.findOne({ user_id: me, blocked_id: target }).lean();
        if (check) {
            await BlackList.deleteOne({ _id: check._id });
            res.json({ status: 'unblocked' });
        } else {
            await BlackList.create({ user_id: me, blocked_id: target });
            res.json({ status: 'blocked' });
        }
    } catch {
        res.status(500).json({ error: st("Ошибка базы данных", detectLangReq(req)) });
    }
});

router.get('/api/is-blocked/:me/:target', authenticateToken, async (req, res) => {
    try {
        const check = await BlackList.findOne({
            user_id: req.params.me,
            blocked_id: req.params.target
        }).lean();
        res.json({ blocked: !!check });
    } catch {
        res.json({ blocked: false });
    }
});

module.exports = router;
