const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

router.get('/', (req, res) => {
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');
    fs.existsSync(indexPath) ? res.sendFile(indexPath) : res.status(404).send("");
});

module.exports = router;
