const fs = require('fs');
const path = require('path');

const signatures = {
    jpeg: { offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
    jpg: { offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
    png: { offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
    gif: { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
    webp: { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
    bmp: { offset: 0, bytes: [0x42, 0x4D] },
    tiff: null,
    tif: null,
    heic: null,
    heif: null,
    mp3: null,
    wav: { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
    ogg: { offset: 0, bytes: [0x4F, 0x67, 0x67, 0x53] },
    flac: { offset: 0, bytes: [0x66, 0x4C, 0x61, 0x43] },
    opus: { offset: 0, bytes: [0x4F, 0x67, 0x67, 0x53] },
    m4a: null,
    mp4: null,
    webm: { offset: 0, bytes: [0x1A, 0x45, 0xDF, 0xA3] },
    mov: null,
    avi: { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
    mkv: { offset: 0, bytes: [0x1A, 0x45, 0xDF, 0xA3] },
    wmv: { offset: 0, bytes: [0x30, 0x26, 0xB2, 0x75] },
    flv: { offset: 0, bytes: [0x46, 0x4C, 0x56, 0x01] },
    m4v: null
};

const containerExts = ['.wav', '.webp', '.avi', '.mp3'];
const ftypExts = ['.mp4', '.m4a', '.m4v', '.mov'];
const tiffExts = ['.tiff', '.tif'];
const heicExts = ['.heic', '.heif'];

const checkFtyp = (buf) => {
    if (buf.length < 12) return false;
    const brand = buf.slice(8, 12).toString().toLowerCase();
    const compatible = buf.slice(16, 20).toString().toLowerCase();
    const ftypBrands = ['isom', 'mp42', 'm4v ', 'm4a ', '3gp4', 'mov ', 'avc1', 'mp71'];
    return ftypBrands.includes(brand) || ftypBrands.includes(compatible);
};

const checkTiff = (buf) => {
    if (buf.length < 4) return false;
    return (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2A && buf[3] === 0x00) ||
           (buf[0] === 0x4D && buf[1] === 0x4D && buf[2] === 0x00 && buf[3] === 0x2A);
};

const checkHeic = (buf) => {
    if (buf.length < 12) return false;
    const brand = buf.slice(8, 12).toString().toLowerCase();
    return ['heic', 'heix', 'heim', 'heis', 'mif1', 'msf1'].includes(brand);
};

const checkMp3 = (buf) => {
    if (buf.length < 3) return false;
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
    if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) return true;
    return false;
};

const checkContainer = (buf, expected) => {
    if (buf.length < 12) return false;
    const fourCc = buf.slice(8, 12).toString();
    return fourCc === expected;
};

const verifyUploadedFile = async (filePath, ext) => {
    try {
        const fd = await fs.promises.open(filePath, 'r');
        const buf = Buffer.alloc(32);
        const { bytesRead } = await fd.read(buf, 0, 32, 0);
        await fd.close();

        if (bytesRead < 4) return false;

        const sigExt = ext.replace('.', '');

        if (containerExts.includes(ext)) {
            if (ext === '.wav') return checkContainer(buf, 'WAVE');
            if (ext === '.webp') return checkContainer(buf, 'WEBP');
            if (ext === '.avi') return checkContainer(buf, 'AVI ');
            if (ext === '.mp3') return checkMp3(buf);
        }

        if (ftypExts.includes(ext)) return checkFtyp(buf);
        if (tiffExts.includes(ext)) return checkTiff(buf);
        if (heicExts.includes(ext)) return checkHeic(buf);

        const sig = signatures[sigExt];
        if (!sig) return true;

        for (let i = 0; i < sig.bytes.length; i++) {
            if (buf[sig.offset + i] !== sig.bytes[i]) return false;
        }

        return true;
    } catch {
        return false;
    }
};

const extractCloudinaryId = (url) => {
    if (!url) return null;
    const match = url.match(/\/v\d+\/(4send_cloud\/[^\.]+)/) || url.match(/(4send_cloud\/[^\.]+)/);
    return match ? match[1] : null;
};

module.exports = { verifyUploadedFile, extractCloudinaryId };