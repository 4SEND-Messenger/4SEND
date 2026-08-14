const sanitizeMongo = (obj, depth = 0) => {
    if (!obj || typeof obj !== 'object') return;
    if (depth > 10) return;
    if (Array.isArray(obj)) {
        obj.forEach(item => sanitizeMongo(item, depth + 1));
        return;
    }
    for (const key of Object.keys(obj)) {
        if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
            delete obj[key];
        } else {
            sanitizeMongo(obj[key], depth + 1);
        }
    }
};

const sanitizeMiddleware = (req, res, next) => {
    sanitizeMongo(req.body);
    sanitizeMongo(req.query);
    sanitizeMongo(req.params);
    next();
};

module.exports = { sanitizeMongo, sanitizeMiddleware };
