const User = require('../models/User');
const { nukeUserAccount } = require('../services/auth');

const DAY_MS = 24 * 60 * 60 * 1000;

const runOnce = async () => {
    try {
        const users = await User.find({ role: { $ne: 'admin' } }).lean();
        const now = Date.now();

        for (const user of users) {
            const lastSeen = user.last_seen ? new Date(user.last_seen).getTime() : now;
            const daysInactive = Math.floor((now - lastSeen) / DAY_MS);
            const limitMonths = [3, 6, 12].includes(user.autoDeleteMonths) ? user.autoDeleteMonths : 6;
            const limitDays = limitMonths * 30;

            if (daysInactive >= limitDays) {
                try {
                    await nukeUserAccount(user.username);
                    process.stdout.write(`[autoDeleteUsers] deleted ${user.username} after ${daysInactive}d\n`);
                } catch (err) {
                    process.stderr.write(`[autoDeleteUsers] ${user.username}: ${err.message}\n`);
                }
            }
        }
    } catch (err) {
        process.stderr.write(`[autoDeleteUsers] ${err.message}\n`);
    }
};

const startAutoDeleteJob = () => {
    setTimeout(runOnce, 15 * 1000);
    setInterval(runOnce, 24 * 60 * 60 * 1000);
};

module.exports = { startAutoDeleteJob, runOnce };