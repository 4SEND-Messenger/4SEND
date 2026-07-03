const logError = (scope, err) => {
    process.stderr.write(`[${new Date().toISOString()}] [${scope}] ${err && err.stack ? err.stack : err}\n`);
};

module.exports = { logError };
