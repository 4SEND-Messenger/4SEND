const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.ip,
    message: { error: 'Слишком много попыток входа. Попробуйте позже.' },
    standardHeaders: true,
    legacyHeaders: false
});

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyGenerator: (req) => req.ip,
    message: { error: 'Превышен лимит загрузки файлов. Попробуйте позже.' },
    standardHeaders: true,
    legacyHeaders: false
});

const securityLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.ip,
    message: { error: 'Слишком много попыток. Попробуйте позже.' },
    standardHeaders: true,
    legacyHeaders: false
});

const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.ip,
    message: { error: 'Слишком много AI запросов. Попробуйте позже.' },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = { authLimiter, uploadLimiter, securityLimiter, aiLimiter };
