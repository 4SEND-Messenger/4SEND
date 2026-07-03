let _io = null;
const onlineUsers = new Set();

const setIO = (io) => { _io = io; };
const getIO = () => _io;

module.exports = { setIO, getIO, onlineUsers };
