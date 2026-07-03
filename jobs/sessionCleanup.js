const User = require('../models/User');

const startSessionCleanupJob = () => {
    setInterval(async () => {
        try {
            const users = await User.find({ "sessions.0": { $exists: true } }).lean();
            const now = new Date();

            for (const u of users) {
                const limitDays = u.autoLogoutDays || 7;
                const limitMs = limitDays * 24 * 60 * 60 * 1000;

                const validSessions = u.sessions.filter(s => (now - new Date(s.lastActive)) < limitMs);

                if (validSessions.length !== u.sessions.length) {
                    await User.updateOne({ _id: u._id }, { $set: { sessions: validSessions } });
                }
            }
        } catch (err) {}
    }, 60 * 60 * 1000);
};

module.exports = { startSessionCleanupJob };
