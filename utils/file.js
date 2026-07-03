const fs = require('fs');
const path = require('path');
const { ALLOWED_EXTENSIONS } = require('../constants/allowed');

const extractCloudinaryId = (url) => {
    if (!url) return null;
    const match = url.match(/\/v\d+\/(4send_cloud\/[^\.]+)/) || url.match(/(4send_cloud\/[^\.]+)/);
    return match ? match[1] : null;
};

const detectFileSignature = (buf) => {
    if (!buf || buf.length < 12) return null;
    const hex = buf.slice(0, 12).toString('hex').toLowerCase();
    const ascii = buf.slice(0, 12).toString('latin1');
    if (hex.startsWith('ffd8ff')) return 'image';
    if (hex.startsWith('89504e47')) return 'image';
    if (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')) return 'image';
    if (ascii.startsWith('RIFF') && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'image';
    if (ascii.startsWith('RIFF') && buf.slice(8, 12).toString('latin1') === 'WAVE') return 'media';
    if (hex.startsWith('494433') || hex.startsWith('fffb') || hex.startsWith('fff3') || hex.startsWith('fff2')) return 'media';
    if (ascii.startsWith('OggS')) return 'media';
    if (buf.slice(4, 8).toString('latin1') === 'ftyp') return 'media';
    if (hex.startsWith('1a45dfa3')) return 'media';
    return null;
};

const verifyUploadedFile = async (filePath, ext) => {
    if (!ALLOWED_EXTENSIONS.includes(ext)) return false;
    const fsPromises = require('fs').promises;
    const fd = await fsPromises.open(filePath, 'r');
    try {
        const buf = Buffer.alloc(12);
        await fd.read(buf, 0, 12, 0);
        return detectFileSignature(buf) !== null;
    } finally {
        await fd.close();
    }
};

module.exports = { extractCloudinaryId, detectFileSignature, verifyUploadedFile };
