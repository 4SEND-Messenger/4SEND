const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');
const cloudinary = require('../config/cloudinary');
const { authenticateToken } = require('../middleware/authenticateToken');
const { uploadLimiter } = require('../constants/limits');
const { st, detectLangReq } = require('../constants/translations');
const { verifyUploadedFile } = require('../utils/file');
const { spawn } = require('child_process');

const ffmpegPath = (() => { try { return require('ffmpeg-static'); } catch { return null; } })();

const runFfmpegStrip = (input, output) => new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('ffmpeg unavailable'));
    const args = ['-y', '-i', input, '-map_metadata', '-1', '-map_chapters', '-1', '-fflags', '+bitexact', '-c', 'copy', output];
    const cp = spawn(ffmpegPath, args);
    let err = '';
    cp.stderr.on('data', (d) => { err += d; });
    cp.on('error', reject);
    cp.on('close', (code) => code === 0 ? resolve() : reject(new Error(err || ('ffmpeg exit ' + code))));
});

const sanitizeSvg = async (inputPath) => {
    const s = await fs.promises.readFile(inputPath, 'utf8');
    const cleaned = s
        .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<\?xml-stylesheet[\s\S]*?\?>/gi, '')
        .replace(/\son\w+\s*=\s*("(?:[^"]*)"|'(?:[^']*)')/gi, '')
        .replace(/(?:href|xlink:href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '');
    await fs.promises.writeFile(inputPath, cleaned);
};

const processMedia = async (safePath, ext) => {
    if (sharpExts.includes(ext)) {
        const tempPath = safePath + '_clean.webp';
        await sharp(safePath, { limitInputPixels: 50000000 })
            .rotate()
            .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(tempPath);
        await fs.promises.unlink(safePath);
        return tempPath;
    }
    if (ext === '.gif') {
        if (ffmpegPath) {
            const tempPath = safePath + '_clean.gif';
            try {
                await runFfmpegStrip(safePath, tempPath);
                await fs.promises.unlink(safePath);
                return tempPath;
            } catch {
                if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath).catch(() => {});
            }
        }
        return safePath;
    }
    if (ext === '.svg') {
        try { await sanitizeSvg(safePath); } catch {}
        return safePath;
    }
    if (extList.audio.includes(ext) || extList.video.includes(ext)) {
        if (ffmpegPath) {
            const tempPath = safePath + '_clean' + ext;
            try {
                await runFfmpegStrip(safePath, tempPath);
                await fs.promises.unlink(safePath);
                return tempPath;
            } catch {
                if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath).catch(() => {});
            }
        }
        return safePath;
    }
    return safePath;
};

const uploadDir = path.join(os.tmpdir(), '4send_uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, Date.now() + '_' + crypto.randomBytes(8).toString('hex') + path.extname(file.originalname || ''))
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }
});

const extList = {
    img: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.ico', '.bmp', '.tiff', '.tif', '.heic', '.heif'],
    audio: ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.opus'],
    video: ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.m4v'],
    doc: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf', '.odt', '.ods', '.odp'],
    archive: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'],
    exe: ['.apk', '.exe', '.msi', '.dmg', '.iso', '.img'],
    data: ['.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.log', '.sqlite', '.db'],
    font: ['.ttf', '.otf', '.woff', '.woff2', '.eot'],
    design: ['.psd', '.ai', '.eps'],
    model: ['.fbx', '.obj', '.stl', '.3ds', '.glb', '.gltf', '.blend'],
    ebook: ['.epub', '.mobi', '.fb2'],
    other: ['.dart', '.torrent', '.nfo', '.diz']
};
const allowedExts = Object.values(extList).flat();
const imgExts = extList.img;
const sharpExts = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.heic', '.heif', '.ico', '.bmp'];

const blockedCloudinaryExts = ['.apk', '.app', '.bat', '.bin', '.cmd', '.com', '.command', '.cpl', '.csh', '.exe', '.gadget', '.inf1', '.ins', '.inx', '.ipa', '.isu', '.job', '.jse', '.ksh', '.lnk', '.msc', '.msi', '.msp', '.mst', '.osx', '.out', '.paf', '.pif', '.prg', '.ps1', '.reg', '.rgs', '.run', '.sct', '.shb', '.shs', '.u3p', '.vb', '.vbe', '.vbs', '.vbscript', '.workflow', '.ws', '.wsf'];

const safeUploadPath = async (filePath, ext) => {
    if (!blockedCloudinaryExts.includes(ext)) return filePath;
    const safePath = filePath + '_safe.dat';
    await fs.promises.copyFile(filePath, safePath);
    return safePath;
};

const handleUploadSingle = (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? st('Файл слишком большой. Лимит 25 МБ', detectLangReq(req)) : st('Ошибка загрузки файла', detectLangReq(req)) });
        } else if (err) {
            return res.status(500).json({ error: st('Ошибка сервера', detectLangReq(req)) });
        }
        next();
    });
};

const handleUploadMultiple = (req, res, next) => {
    upload.array('files', 10)(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? st('Файл слишком большой. Лимит 25 МБ', detectLangReq(req)) : st('Ошибка загрузки файла', detectLangReq(req)) });
        } else if (err) {
            return res.status(500).json({ error: st('Ошибка сервера', detectLangReq(req)) });
        }
        next();
    });
};

router.post('/upload', authenticateToken, uploadLimiter, handleUploadSingle, async (req, res) => {
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

        if (!allowedExts.includes(ext)) {
            if (fs.existsSync(safePath)) await fsPromises.unlink(safePath);
            return res.status(400).json({ error: st('Недопустимый формат файла', detectLangReq(req)) });
        }

            if (imgExts.includes(ext)) {
            if (!(await verifyUploadedFile(safePath, ext))) {
                if (fs.existsSync(safePath)) await fsPromises.unlink(safePath);
                return res.status(400).json({ error: st('Неподдерживаемый тип медиа', detectLangReq(req)) });
            }
        }

        try {
            finalPath = await processMedia(safePath, ext);
        } catch (procErr) {
            if (fs.existsSync(safePath)) await fsPromises.unlink(safePath);
            return res.status(400).json({ error: st('Неподдерживаемый тип медиа', detectLangReq(req)) });
        }

        const uploadOpts = {
            folder: "4send_cloud",
            resource_type: imgExts.includes(ext) ? "image" : (extList.audio.includes(ext) || extList.video.includes(ext) ? "video" : "raw")
        };

        const uploadPath = await safeUploadPath(finalPath, ext);
        let result;
        try {
            result = await cloudinary.uploader.upload(uploadPath, uploadOpts);
        } catch (cloudErr) {
            if (uploadPath !== finalPath) await fsPromises.unlink(uploadPath).catch(() => {});
            if (fs.existsSync(finalPath)) await fsPromises.unlink(finalPath);
            return res.status(400).json({ error: st('Неподдерживаемый тип медиа', detectLangReq(req)) });
        }
        if (uploadPath !== finalPath) await fsPromises.unlink(uploadPath).catch(() => {});
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

router.post('/upload-multiple', authenticateToken, uploadLimiter, handleUploadMultiple, async (req, res) => {
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

            if (!allowedExts.includes(ext)) {
                if (fs.existsSync(safePath)) await fsPromises.unlink(safePath);
                continue;
            }

        if (imgExts.includes(ext)) {
                if (!(await verifyUploadedFile(safePath, ext))) {
                    if (fs.existsSync(safePath)) await fsPromises.unlink(safePath);
                    continue;
                }
            }

            try {
                finalPath = await processMedia(safePath, ext);
            } catch {
                if (fs.existsSync(safePath)) await fsPromises.unlink(safePath);
                continue;
            }

            const uploadOpts = {
                folder: "4send_cloud",
                resource_type: imgExts.includes(ext) ? "image" : (extList.audio.includes(ext) || extList.video.includes(ext) ? "video" : "raw")
            };

            const uploadPath = await safeUploadPath(finalPath, ext);
            let result;
            try {
                result = await cloudinary.uploader.upload(uploadPath, uploadOpts);
            } catch {
                if (uploadPath !== finalPath) await fsPromises.unlink(uploadPath).catch(() => {});
                if (fs.existsSync(finalPath)) await fsPromises.unlink(finalPath);
                continue;
            }
            if (uploadPath !== finalPath) await fsPromises.unlink(uploadPath).catch(() => {});
            if (fs.existsSync(finalPath)) await fsPromises.unlink(finalPath);
            urls.push(result.secure_url);
        }

        if (urls.length === 0) {
            return res.status(400).json({ error: st('Не удалось загрузить ни один файл', detectLangReq(req)) });
        }

        res.json({ urls });
    } catch (err) {
        if (req.files) {
            const fsPromises = require('fs').promises;
            for (const f of req.files) {
                if (f.path && fs.existsSync(f.path)) await fsPromises.unlink(f.path).catch(() => {});
            }
        }
        res.status(500).json({ error: err?.message || st('Ошибка сервера', detectLangReq(req)) });
    }
});

router.post('/api/upload-tiktok', authenticateToken, uploadLimiter, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'Invalid URL' });

        try {
            const parsed = new URL(url);
            if (!parsed.hostname.includes('tiktok.com')) {
                return res.status(400).json({ error: 'Invalid URL' });
            }
        } catch {
            return res.status(400).json({ error: 'Invalid URL' });
        }

        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl, { timeout: 15000 });

        const data = response.data?.data;
        if (!data) return res.status(400).json({ error: 'Could not extract video' });

        const videoUrl = data.hdplay || data.play || data.wmplay || data.images?.[0];
        if (!videoUrl || typeof videoUrl !== 'string') return res.status(400).json({ error: 'Could not extract video' });

        const result = await cloudinary.uploader.upload(videoUrl, {
            folder: "4send_cloud",
            resource_type: "video"
        });
        res.json({ url: result.secure_url });
    } catch (err) {
        res.status(500).json({ error: err?.message || 'Server error' });
    }
});

router.get('/api/proxy-download', authenticateToken, async (req, res) => {
    try {
        const { url } = req.query;
        if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing url' });
        const parsed = new URL(url);
        if (!['https:', 'http:'].includes(parsed.protocol)) {
            return res.status(400).json({ error: 'Invalid protocol' });
        }
        const response = await axios({ method: 'GET', url, responseType: 'stream', timeout: 60000 });
        const ct = response.headers['content-type'];
        if (ct) res.setHeader('Content-Type', ct);
        const cd = response.headers['content-disposition'];
        if (cd) res.setHeader('Content-Disposition', cd);
        response.data.pipe(res);
    } catch {
        res.status(500).json({ error: 'Proxy error' });
    }
});

module.exports = router;