const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.webm', '.mov'];
const MAX_SESSIONS = 5;
const PORT = process.env.PORT || 7860;
const MONGO_URI = process.env.MONGO_URI;

module.exports = { ALLOWED_EXTENSIONS, MAX_SESSIONS, PORT, MONGO_URI };
