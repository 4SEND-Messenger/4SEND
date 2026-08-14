const lastActiveCache = new Map();
const THROTTLE_MS = 5 * 60 * 1000;

const shouldUpdateLastActive = (username, token) => {
    const key = `${username}:${token}`;
    const now = Date.now();
    const last = lastActiveCache.get(key);
    if (last && now - last < THROTTLE_MS) return false;
    lastActiveCache.set(key, now);
    return true;
};

module.exports = { shouldUpdateLastActive };