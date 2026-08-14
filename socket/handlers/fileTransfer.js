const { getIO } = require('../io');

const handleFileOffer = (socket, data) => {
    if (!data || !data.target) return;
    const sender = socket.username.toLowerCase();
    const target = String(data.target).toLowerCase();
    if (sender === target) return;
    const io = getIO();
    io.to(target).emit('file_offer', {
        sender: socket.username,
        fileName: data.fileName,
        fileSize: data.fileSize,
        sdp: data.sdp
    });
};

const handleFileAnswer = (socket, data) => {
    if (!data || !data.target) return;
    const target = String(data.target).toLowerCase();
    const io = getIO();
    io.to(target).emit('file_answer', { sdp: data.sdp });
};

const handleFileIceCandidate = (socket, data) => {
    if (!data || !data.target) return;
    const target = String(data.target).toLowerCase();
    const io = getIO();
    io.to(target).emit('file_ice_candidate', {
        sender: socket.username,
        candidate: data.candidate
    });
};

const handleFileCancel = (socket, data) => {
    if (!data || !data.target) return;
    const target = String(data.target).toLowerCase();
    const io = getIO();
    io.to(target).emit('file_cancel', { sender: socket.username });
};

const handleFileComplete = (socket, data) => {
    if (!data || !data.target) return;
    const target = String(data.target).toLowerCase();
    const io = getIO();
    io.to(target).emit('file_transfer_complete', {
        sender: socket.username,
        fileName: data.fileName,
        fileSize: data.fileSize
    });
};

module.exports = {
    handleFileOffer, handleFileAnswer, handleFileIceCandidate,
    handleFileCancel, handleFileComplete
};