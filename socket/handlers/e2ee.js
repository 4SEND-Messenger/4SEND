const { getIO } = require('../io');

const handleE2EEInit = (socket, data) => {
    const from = socket.username ? socket.username.toLowerCase() : null;
    if (!from || !data || !data.to) return;

    const target = data.to.toLowerCase();
    const io = getIO();

    io.to(target).emit('e2ee_init', { from });
};

const handleE2EEAccept = (socket, data) => {
    const from = socket.username ? socket.username.toLowerCase() : null;
    if (!from || !data || !data.to) return;

    const target = data.to.toLowerCase();
    const io = getIO();

    io.to(target).emit('e2ee_accept', {
        from,
        identityKey: data.identityKey,
        ephemeralKey: data.ephemeralKey,
        usedKeyId: data.usedKeyId,
        ciphertext: data.ciphertext,
    });
};

module.exports = { handleE2EEInit, handleE2EEAccept };