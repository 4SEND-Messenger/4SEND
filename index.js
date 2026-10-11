const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const { initSocket } = require('./socket/index');
const { PORT, MONGO_URI } = require('./constants/allowed');
const { runMigration, loadPrivacyMap, dedupPins } = require('./services/migration');
const { startAutoDeleteJob } = require('./jobs/autoDeleteUsers');
const { startNotificationRepeatJob } = require('./jobs/notificationRepeat');
const { startSessionCleanupJob } = require('./jobs/sessionCleanup');
const { startMessageExpiryJob } = require('./jobs/messageExpiry');

if (!MONGO_URI) {
    process.stderr.write('MONGO_URI is not set\n');
    process.exit(1);
}

const server = http.createServer(app);
initSocket(server);

mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
    .then(async () => {
        await runMigration();
        await loadPrivacyMap();
        await dedupPins();
        startAutoDeleteJob();
        startNotificationRepeatJob();
        startSessionCleanupJob();
        startMessageExpiryJob();
        server.listen(PORT, '0.0.0.0');
    })
    .catch((err) => {
        process.stderr.write(`[MONGO] ${err.message}\n`);
        process.exit(1);
    });

module.exports = app;