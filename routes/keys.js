const express = require('express');
const router = express.Router();
const PreKey = require('../models/PreKey');
const { authenticateToken } = require('../middleware/authenticateToken');

router.post('/api/keys/upload', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;
        const { identityKey, signedPreKey, oneTimePreKeys, signingPublicKey } = req.body;

        if (!identityKey || !signedPreKey || !signedPreKey.keyId || !signedPreKey.publicKey || !signedPreKey.signature) {
            return res.status(400).json({ error: 'Missing required key fields' });
        }

        await PreKey.findOneAndUpdate(
            { username },
            {
                username,
                identityKey,
                signingPublicKey,
                signedPreKey: {
                    keyId: signedPreKey.keyId,
                    publicKey: signedPreKey.publicKey,
                    signature: signedPreKey.signature,
                },
                oneTimePreKeys: (oneTimePreKeys || []).map((k) => ({
                    keyId: k.keyId,
                    publicKey: k.publicKey,
                    used: false,
                })),
                version: 1,
                updatedAt: new Date(),
            },
            { upsert: true }
        );

        res.json({ status: 'ok' });
    } catch (err) {
        console.error('PreKey upload error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/api/keys/:username', authenticateToken, async (req, res) => {
    try {
        const target = req.params.username.toLowerCase();

        const preKey = await PreKey.findOne({ username: target }).lean();
        if (!preKey) {
            return res.status(404).json({ error: 'No keys found for this user' });
        }

        const unusedIndex = preKey.oneTimePreKeys
            ? preKey.oneTimePreKeys.findIndex((k) => !k.used)
            : -1;

        let oneTimePreKey = null;
        if (unusedIndex >= 0) {
            oneTimePreKey = {
                keyId: preKey.oneTimePreKeys[unusedIndex].keyId,
                publicKey: preKey.oneTimePreKeys[unusedIndex].publicKey,
            };

            const setKey = `oneTimePreKeys.${unusedIndex}.used`;
            await PreKey.updateOne(
                { username: target },
                { $set: { [setKey]: true } }
            );
        }

        res.json({
            identityKey: preKey.identityKey,
            signingPublicKey: preKey.signingPublicKey || null,
            signedPreKey: {
                keyId: preKey.signedPreKey.keyId,
                publicKey: preKey.signedPreKey.publicKey,
                signature: preKey.signedPreKey.signature,
            },
            oneTimePreKey,
        });
    } catch (err) {
        console.error('PreKey fetch error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/api/keys/:username/identity', authenticateToken, async (req, res) => {
    try {
        const target = req.params.username.toLowerCase();
        const preKey = await PreKey.findOne({ username: target }).select('identityKey').lean();
        if (!preKey) {
            return res.status(404).json({ error: 'No keys found' });
        }
        res.json({ identityKey: preKey.identityKey });
    } catch (err) {
        console.error('PreKey identity fetch error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/api/keys/check', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;
        const preKey = await PreKey.findOne({ username }).lean();
        res.json({ hasKeys: !!preKey });
    } catch (err) {
        console.error('PreKey check error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;