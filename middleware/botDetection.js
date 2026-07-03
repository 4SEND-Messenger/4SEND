const botDetection = (req, res, next) => {
    const dangerousChars = /["';<>]/g;
    ['user-agent', 'referer', 'x-forwarded-for'].forEach(h => {
        if (req.headers[h] && dangerousChars.test(req.headers[h])) {
            req.headers[h] = req.headers[h].replace(dangerousChars, "");
        }
    });
    const ua = req.headers['user-agent'];
    if (!ua || ua.length < 10) return res.status(403).send('Bot detected');
    if (req.headers['content-length'] > 50000) return res.status(413).send('Too large');
    next();
};

module.exports = { botDetection };
