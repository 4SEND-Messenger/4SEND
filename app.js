const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { MONGO_URI } = require('./constants/allowed');
const { SESSION_SECRET } = require('./config/env');
const fs = require('fs');
const { sanitizeMiddleware } = require('./middleware/sanitizeMongo');
const { botDetection } = require('./middleware/botDetection');
const { securityHeaders, cspMiddleware } = require('./middleware/securityHeaders');
const { privacyWrapper } = require('./middleware/privacyWrapper');

const app = express();
app.use(compression());
app.set('trust proxy', 1);
app.use(express.static(path.join(__dirname, 'public')));
if (!global.privacyMap) global.privacyMap = new Map();
if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'));

const sessionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    validate: { xForwardedForHeader: false },
    keyGenerator: (req) => req.ip,
    message: 'Too many requests'
});
app.use(sessionLimiter);

app.use(session({
    name: '4send_sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI, collectionName: 'sessions', ttl: 24 * 60 * 60 }),
    cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 24 * 60 * 60 * 1000 }
}));

const User = require('./models/User');
app.use(async (req, res, next) => {
    if (req.session && req.session.username && !req.session.avatar) {
        try {
            const user = await User.findOne({ username: req.session.username }).select('avatar').lean();
            if (user && user.avatar) req.session.avatar = user.avatar;
        } catch (e) {}
    }
    next();
});

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(botDetection);
app.use(securityHeaders);
app.use(cspMiddleware);
app.use(sanitizeMiddleware);
app.use(privacyWrapper);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', require('./routes/root'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/users'));
app.use('/', require('./routes/upload'));
app.use('/', require('./routes/chats'));
app.use('/', require('./routes/rooms'));
app.use('/', require('./routes/admin'));
app.use('/', require('./routes/settings'));
app.use('/', require('./routes/security'));
app.use('/', require('./routes/block'));
app.use('/', require('./routes/media'));
app.use('/', require('./routes/pins'));
app.use('/', require('./routes/link'));
app.use('/', require('./routes/push'));
app.use('/', require('./routes/account'));
app.use('/', require('./routes/sessions'));
app.use('/', require('./routes/ai'));
app.use('/', require('./routes/firebase'));

app.use((req, res) => res.status(404).send('Not found'));
app.use((err, req, res, next) => { res.status(500).send('Server error'); });

module.exports = app;
