const socketRateLimits = new Map();

const createSocketRateLimiter = (socket, sanitizeMongo) => {
    return (packet, next) => {
        if (packet[1] && typeof packet[1] === 'object') {
            sanitizeMongo(packet[1]);
        }
        const rlKey = socket.username ? socket.username.toLowerCase() : socket.id;
        const now = Date.now();
        const userLimits = socketRateLimits.get(rlKey) || [];
        const recent = userLimits.filter(t => now - t < 1000);
        if (recent.length >= 10) return next(new Error('Rate limit exceeded'));
        recent.push(now);
        socketRateLimits.set(rlKey, recent);
        next();
    };
};

const cleanupSocketRateLimit = (key) => {
    socketRateLimits.delete(key);
};

module.exports = { socketRateLimits, createSocketRateLimiter, cleanupSocketRateLimit };
