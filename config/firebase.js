const admin = require('firebase-admin');

const parseServiceAccount = (raw) => {
    const attempts = [
        () => JSON.parse(raw),
        () => JSON.parse(raw.replace(/("private_key"\s*:\s*")((?:[^"\\]|\\.|[\r\n])*)(")/, (m, a, key, c) => a + key.replace(/\r?\n/g, '\\n') + c)),
        () => JSON.parse(raw.replace(/\r?\n/g, '\\n')),
        () => JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
    ];
    for (const attempt of attempts) {
        try {
            const parsed = attempt();
            if (parsed && parsed.private_key && parsed.project_id) return parsed;
        } catch {}
    }
    return null;
};

try {
    const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
    if (raw) {
        const serviceAccount = parseServiceAccount(raw);
        if (serviceAccount) {
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
            console.log('[firebase] admin initialized, project:', serviceAccount.project_id);
        } else {
            console.error('[firebase] FIREBASE_SERVICE_ACCOUNT could not be parsed');
        }
    } else {
        console.warn('[firebase] FIREBASE_SERVICE_ACCOUNT not set, push sending disabled');
    }
} catch (err) {
    console.error('[firebase] initialization failed:', err && err.message);
}

module.exports = admin;
