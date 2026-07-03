const { Server } = require('socket.io');
const { setIO } = require('./io');
const { createSocketRateLimiter, cleanupSocketRateLimit } = require('../utils/rateLimiter');
const { sanitizeMongo } = require('../middleware/sanitizeMongo');
const { socketAuthMiddleware, socketPrivacyMiddleware } = require('./middleware');
const { handleJoin, handleDisconnect } = require('./handlers/join');
const { handleToggleAction } = require('./handlers/action');
const { handleForwardMessage } = require('./handlers/forward');
const { handleSetReaction } = require('./handlers/reaction');
const { handleChatMessage } = require('./handlers/message');
const { handlePinRequest, handleUnpinRequest } = require('./handlers/pin');
const { handleMarkRead, handleClearHistory } = require('./handlers/read');
const { handleDeleteMsg, handleEditMsg } = require('./handlers/edit');
const { handleSearchUser } = require('./handlers/search');
const { handleTyping } = require('./handlers/typing');
const { handleCreateRoom, handleUpdateRoom, handleJoinPublicRoom, handleRequestJoinRoom, handleJoinRequest, handleLeaveRoom, handleRemoveMember } = require('./handlers/room');
const { handleCallRequest, handleCallResponse, handleWebrtcSignal, handleCallEnd, cleanupCallForUser } = require('./handlers/call');

const initSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.NODE_ENV === 'production' ? false : true,
            methods: ['GET', 'POST']
        }
    });
    setIO(io);

    io.use(socketAuthMiddleware);
    io.use(socketPrivacyMiddleware);

    io.on('connection', (socket) => {
        socket.use(createSocketRateLimiter(socket, sanitizeMongo));

        socket.on('join', (user) => handleJoin(socket, user));
        socket.on('toggle_pin', ({ user, contact }) => handleToggleAction(socket, socket.username, contact, 'pin'));
        socket.on('toggle_archive', ({ me, contact }) => handleToggleAction(socket, socket.username, contact, 'archive'));
        socket.on('toggle_mute', ({ me, contact }) => handleToggleAction(socket, socket.username, contact, 'mute'));
        socket.on('forward_message', (data) => handleForwardMessage(socket, data));
        socket.on('update_chat_list', () => io.to(socket.username).emit('update_chat_list'));
        socket.on('messages_read', () => io.to(socket.username).emit('update_chat_list'));
        socket.on('set_reaction', (data) => handleSetReaction(socket, data));
        socket.on('clear_history', ({ user, contact }) => handleClearHistory(socket, { user, contact }));
        socket.on('chat_message', (data) => handleChatMessage(socket, data));
        socket.on('pin_request', (data) => handlePinRequest(socket, data));
        socket.on('unpin_request', (data) => handleUnpinRequest(socket, data));
        socket.on('mark_read', (data) => handleMarkRead(socket, data));
        socket.on('delete_msg', (id) => handleDeleteMsg(socket, id));
        socket.on('edit_msg', (data) => handleEditMsg(socket, data));
        socket.on('search_user', (query) => handleSearchUser(socket, query));
        socket.on('typing', (data) => handleTyping(socket, data));
        socket.on('create_room', (data) => handleCreateRoom(socket, data));
        socket.on('update_room', (data) => handleUpdateRoom(socket, data));
        socket.on('join_public_room', (id) => handleJoinPublicRoom(socket, id));
        socket.on('request_join_room', (id) => handleRequestJoinRoom(socket, id));
        socket.on('handle_join_request', (data) => handleJoinRequest(socket, data));
        socket.on('leave_room', (roomId) => handleLeaveRoom(socket, roomId));
        socket.on('remove_member', (data) => handleRemoveMember(socket, data));
        socket.on('call_request', (data) => handleCallRequest(socket, data));
        socket.on('call_response', (data) => handleCallResponse(socket, data));
        socket.on('webrtc_signal', (data) => handleWebrtcSignal(socket, data));
        socket.on('call_end', (data) => handleCallEnd(socket, data));

        socket.on('disconnect', () => {
            cleanupSocketRateLimit(socket.username ? socket.username.toLowerCase() : socket.id);
            const username = socket.username ? socket.username.toLowerCase() : null;
            if (username) {
                cleanupCallForUser(username);
                const { callTimeouts } = require('./handlers/call');
                for (const [key, val] of callTimeouts) {
                    if (key.startsWith(username + '_') || key.endsWith('_' + username)) {
                        clearTimeout(val);
                        callTimeouts.delete(key);
                    }
                }
            }
            handleDisconnect(socket);
        });
    });

    return io;
};

module.exports = { initSocket };
