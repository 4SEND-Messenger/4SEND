const User = require('../models/User');
const { nukeUserAccount } = require('../services/auth');

const startAutoDeleteJob = () => {
    setInterval(async () => {
        try {
            const users = await User.find({ role: { $ne: 'admin' } }).lean();
            const now = new Date();

            for (const user of users) {
                const lastSeen = new Date(user.last_seen || now);
                const monthsInactive = (now.getFullYear() - lastSeen.getFullYear()) * 12 + (now.getMonth() - lastSeen.getMonth());
                const limit = user.autoDeleteMonths || 6;

                if (monthsInactive >= limit) {
                    await nukeUserAccount(user.username);
                }
            }
        } catch (err) {}
    }, 24 * 60 * 60 * 1000);
};

module.exports = { startAutoDeleteJob };
