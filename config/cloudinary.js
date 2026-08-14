const cloudinary = require('cloudinary').v2;

const cloudName = process.env.CLOUDINARY_NAME;
const apiKey = process.env.CLOUDINARY_KEY;
const apiSecret = process.env.CLOUDINARY_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
    console.error('[CLOUDINARY] Missing env vars:', {
        CLOUDINARY_NAME: !!cloudName,
        CLOUDINARY_KEY: !!apiKey,
        CLOUDINARY_SECRET: !!apiSecret
    });
}

cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
});

module.exports = cloudinary;
