const User = require('../models/User');
const { kickSessions } = require('../socket/kick');

const startSessionCleanupJob = () => {
    setInterval(async () => {
        try {
            const users = await User.find({ "sessions.0": { $exists: true } }).lean();
            const now = new Date();

            for (const u of users) {
                const limitDays = u.autoLogoutDays || 7;
                const limitMs = limitDays * 24 * 60 * 60 * 1000;

                const expired = u.sessions.filter(s => (now - new Date(s.lastActive)) >= limitMs);
                if (!expired.length) continue;

                const expiredTokens = new Set(expired.map(s => s.token));
                const validSessions = u.sessions.filter(s => !expiredTokens.has(s.token));
                await User.updateOne({ _id: u._id }, { $set: { sessions: validSessions } });
                kickSessions(u.username, t => expiredTokens.has(t));
            }
        } catch (err) {
            console.error('[sessionCleanup]', err);
        }
    }, 60 * 60 * 1000);
};

module.exports = { startSessionCleanupJob };
