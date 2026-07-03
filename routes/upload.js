const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const cloudinary = require('../config/cloudinary');
const { authenticateToken } = require('../middleware/authenticateToken');
const { uploadLimiter } = require('../constants/limits');
const { verifyUploadedFile } = require('../utils/file');
const { st, detectLangReq } = require('../constants/translations');

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + '_' + crypto.randomBytes(8).toString('hex') + path.extname(file.originalname))
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }
});

router.post('/upload', authenticateToken, uploadLimiter, upload.single('file'), async (req, res) => {
    let safePath = null;
    let finalPath = null;
    try {
        if (!req.file) return res.status(400).json({ error: st('Файл не выбран', detectLangReq(req)) });

        const fsPromises = require('fs').promises;
        const originalPath = req.file.path;
        const cleanName = req.file.filename.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        safePath = path.join(path.dirname(originalPath), cleanName);
        await fsPromises.rename(originalPath, safePath);

        const ext = path.extname(cleanName).toLowerCase();
        finalPath = safePath;

        if (!(await verifyUploadedFile(safePath, ext))) {
            if (fs.existsSync(safePath)) await fsPromises.unlink(safePath);
            return res.status(400).json({ error: st('Некорректный формат изображения', detectLangReq(req)) });
        }

        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            try {
                const tempPath = safePath + '_clean.webp';
                await sharp(safePath, { limitInputPixels: 25000000 })
                    .rotate()
                    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toFile(tempPath);
                await fsPromises.unlink(safePath);
                finalPath = tempPath;
            } catch {
                if (fs.existsSync(safePath)) await fsPromises.unlink(safePath);
                return res.status(400).json({ error: st('Некорректный формат изображения', detectLangReq(req)) });
            }
        }

        const uploadOpts = {
            folder: "4send_cloud",
            resource_type: "auto",
            image_metadata: false
        };

        if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
            uploadOpts.quality = "auto";
        } else if (['.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.webm', '.mov'].includes(ext)) {
            uploadOpts.resource_type = "video";
            if (['.mp4', '.webm', '.mov'].includes(ext)) {
                uploadOpts.quality = "auto:good";
                uploadOpts.fetch_format = "mp4";
            }
        }

        const result = await cloudinary.uploader.upload(finalPath, uploadOpts);
        if (fs.existsSync(finalPath)) await fsPromises.unlink(finalPath);
        res.json({ url: result.secure_url });
    } catch (err) {
        const fsPromises = require('fs').promises;
        if (req.file && fs.existsSync(req.file.path)) await fsPromises.unlink(req.file.path).catch(() => {});
        if (safePath && fs.existsSync(safePath)) await fsPromises.unlink(safePath).catch(() => {});
        if (finalPath && fs.existsSync(finalPath)) await fsPromises.unlink(finalPath).catch(() => {});

        res.status(500).json({ error: st('Ошибка сервера', detectLangReq(req)) });
    }
});

router.post('/upload-multiple', authenticateToken, uploadLimiter, upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: st('Файлы не выбраны', detectLangReq(req)) });

        const fsPromises = require('fs').promises;
        const urls = [];

        for (const file of req.files) {
            const originalPath = file.path;
            const cleanName = file.filename.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
            const safePath = path.join(path.dirname(originalPath), cleanName);
            await fsPromises.rename(originalPath, safePath);

            const ext = path.extname(cleanName).toLowerCase();
            let finalPath = safePath;

            if (!(await verifyUploadedFile(safePath, ext))) {
                if (fs.existsSync(safePath)) await fsPromises.unlink(safePath);
                continue;
            }

            if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
                try {
                    const tempPath = safePath + '_clean.webp';
                    await sharp(safePath, { limitInputPixels: 25000000 })
                        .rotate()
                        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
                        .webp({ quality: 80 })
                        .toFile(tempPath);
                    await fsPromises.unlink(safePath);
                    finalPath = tempPath;
                } catch {
                    if (fs.existsSync(safePath)) await fsPromises.unlink(safePath);
                    continue;
                }
            }

            const uploadOpts = {
                folder: "4send_cloud",
                resource_type: "auto",
                image_metadata: false
            };

            if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
                uploadOpts.quality = "auto";
            } else if (['.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.webm', '.mov'].includes(ext)) {
                uploadOpts.resource_type = "video";
                if (['.mp4', '.webm', '.mov'].includes(ext)) {
                    uploadOpts.quality = "auto:good";
                    uploadOpts.fetch_format = "mp4";
                }
            }

            const result = await cloudinary.uploader.upload(finalPath, uploadOpts);
            if (fs.existsSync(finalPath)) await fsPromises.unlink(finalPath);
            urls.push(result.secure_url);
        }

        res.json({ urls });
    } catch (err) {
        if (req.files) {
            const fsPromises = require('fs').promises;
            for (const f of req.files) {
                if (f.path && fs.existsSync(f.path)) await fsPromises.unlink(f.path).catch(() => {});
            }
        }
        res.status(500).json({ error: st('Ошибка сервера', detectLangReq(req)) });
    }
});

router.post('/api/upload-tiktok', authenticateToken, uploadLimiter, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'Invalid URL' });

        try {
            const parsed = new URL(url);
            if (parsed.hostname !== 'tiktok.com' && !parsed.hostname.endsWith('.tiktok.com')) {
                return res.status(400).json({ error: 'Invalid URL' });
            }
        } catch {
            return res.status(400).json({ error: 'Invalid URL' });
        }

        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl);

        if (response.data && response.data.data && response.data.data.play) {
            const videoUrl = response.data.data.play;
            if (typeof videoUrl !== 'string' || !videoUrl.startsWith('https://')) {
                return res.status(400).json({ error: 'Invalid video URL' });
            }
            try {
                const cdnHost = new URL(videoUrl).hostname;
                if (!cdnHost.endsWith('tikwm.com') && !cdnHost.endsWith('tiktokcdn.com') && !cdnHost.endsWith('byteoversea.com')) {
                    return res.status(400).json({ error: 'Invalid video source' });
                }
            } catch {
                return res.status(400).json({ error: 'Invalid video URL' });
            }
            const result = await cloudinary.uploader.upload(videoUrl, {
                folder: "4send_cloud",
                resource_type: "video"
            });
            res.json({ url: result.secure_url });
        } else {
            res.status(400).json({ error: 'Could not extract video' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
