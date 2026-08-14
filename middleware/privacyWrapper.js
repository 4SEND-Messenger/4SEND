const checkServerPrivacy = (owner, requester, type) => {
    if (!owner || !requester) return true;
    if (owner.toLowerCase() === requester.toLowerCase()) return true;
    const p = global.privacyMap.get(owner.toLowerCase());
    if (!p) return true;

    if (p[type] === 'none') return false;
    if (p[type] === 'selected') {
        return p.exceptions && p.exceptions[type] && p.exceptions[type].includes(requester.toLowerCase());
    }
    return true;
};

const privacyWrapper = (req, res, next) => {
    const origJson = res.json;
    res.json = function(data) {
        let requester = null;
        if (req.user && req.user.username) requester = req.user.username.toLowerCase();
        else if (req.query.me) requester = req.query.me.toLowerCase();

        if (requester && data && typeof data === 'object') {
            const cleanUser = (u) => {
                const targetName = u.username || u.name;
                if (!targetName || u.roomId) return;
                const targetLower = targetName.toLowerCase();
                if (targetLower === requester) return;

                if (!checkServerPrivacy(targetLower, requester, 'avatar')) u.avatar = null;
                if (!checkServerPrivacy(targetLower, requester, 'status')) {
                    u.last_seen = null;
                    u.isOnline = false;
                }
            };

            if (Array.isArray(data)) {
                data.forEach(cleanUser);
            } else {
                const targetName = req.params.user || req.params.username || data.username || data.sender;
                if (targetName && !data.roomId) {
                    if (!checkServerPrivacy(targetName, requester, 'avatar')) data.avatar = null;
                    if (!checkServerPrivacy(targetName, requester, 'status')) data.last_seen = null;
                }
            }
        }
        return origJson.call(this, data);
    };
    next();
};

module.exports = { checkServerPrivacy, privacyWrapper };
