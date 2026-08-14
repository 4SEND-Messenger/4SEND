const getClientIp = (req) => {
    return req.ip || req.socket.remoteAddress || 'Unknown IP';
};

const isPrivateIP = (addr) => {
    if (!addr) return true;
    const a = addr.replace(/^::ffff:/i, '');
    if (a === '0.0.0.0' || a === '::' || a === '::1') return true;
    if (/^127\./.test(a)) return true;
    if (/^10\./.test(a)) return true;
    if (/^192\.168\./.test(a)) return true;
    if (/^169\.254\./.test(a)) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(a)) return true;
    if (/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(a)) return true;
    if (/^192\.0\.0\./.test(a)) return true;
    if (/^192\.0\.2\./.test(a)) return true;
    if (/^198\.(1[8-9])\./.test(a)) return true;
    if (/^198\.51\.100\./.test(a)) return true;
    if (/^203\.0\.113\./.test(a)) return true;
    if (/^(22[4-9]|2[3-5][0-9])\./.test(a)) return true;
    if (/^fc/i.test(a) || /^fd/i.test(a)) return true;
    if (/^fe80:/i.test(a)) return true;
    if (/^ff/i.test(a)) return true;
    const octets = a.split('.');
    if (octets.length === 4 && octets.some(o => o === '' || /[^0-9]/.test(o) || parseInt(o, 10) > 255)) return true;
    return false;
};

module.exports = { getClientIp, isPrivateIP };
