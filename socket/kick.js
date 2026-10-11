const { getIO } = require('./io');

const kickSessions = (username, predicate) => {
    const io = getIO();
    if (!io || !username) return;
    for (const [, s] of io.sockets.sockets) {
        if (s.username !== username) continue;
        if (predicate && !predicate(s.authToken)) continue;
        try { s.emit('session_revoked'); } catch {}
        setTimeout(() => { try { s.disconnect(true); } catch {} }, 50);
    }
};

module.exports = { kickSessions };
