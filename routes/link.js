const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const dns = require('dns');
const { authenticateToken } = require('../middleware/authenticateToken');
const { isPrivateIP } = require('../utils/ip');

router.get('/api/link-preview', authenticateToken, async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'No URL' });

    try {
        const parsedUrl = new URL(url);

        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(403).json({ error: 'Forbidden protocol' });
        }

        const hostname = parsedUrl.hostname;
        if (/^127\.|^0\.|^::1$|^localhost$/i.test(hostname)) {
            return res.status(403).json({ error: 'Forbidden URL' });
        }

        const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (parsedUrl.protocol === 'https:' ? 443 : 80);

        if (![80, 443].includes(port)) {
            return res.status(403).json({ error: 'Forbidden port' });
        }

        const ip = await dns.promises.lookup(hostname, { family: 0 });
        const addr = ip.address;

        if (isPrivateIP(addr)) {
            return res.status(403).json({ error: 'Forbidden URL' });
        }

        const safeUrl = `${parsedUrl.protocol}//${addr}${parsedUrl.port ? ':' + parsedUrl.port : ''}${parsedUrl.pathname}${parsedUrl.search}`;

        const response = await axios.get(safeUrl, {
            timeout: 3000,
            maxRedirects: 0,
            maxContentLength: 5 * 1024 * 1024,
            validateStatus: (status) => status >= 200 && status < 300,
            headers: {
                'Host': hostname,
                'User-Agent': 'Mozilla/5.0'
            },
            signal: AbortSignal.timeout(3000)
        });

        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
            return res.status(400).json({ error: 'Unsupported content type' });
        }

        const $ = cheerio.load(response.data);
        res.json({
            title: $('meta[property="og:title"]').attr('content') || $('title').text() || url,
            description: $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || "",
            image: $('meta[property="og:image"]').attr('content') || "",
            url
        });
    } catch { res.status(404).json({ error: 'Error' }); }
});

module.exports = router;
