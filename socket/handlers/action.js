const ChatAction = require('../../models/ChatAction');

const handleToggleAction = async (socket, user, contact, type) => {
    try {
        if (!user || !contact) return;
        const action = await ChatAction.findOne({ user, contact, type }).lean();
        if (action) {
            await ChatAction.deleteOne({ _id: action._id });
            if (type === 'archive') socket.emit('archive_confirmed', { status: 'removed' });
        } else {
            await ChatAction.create({ user, contact, type });
            if (type === 'archive') socket.emit('archive_confirmed', { status: 'added' });
        }
        if (type === 'mute') socket.emit('mute_confirmed');
        if (type !== 'mute') socket.emit('update_chat_list');
    } catch {}
};

module.exports = { handleToggleAction };
