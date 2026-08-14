const mongoose = require('mongoose');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');
const Dialog = require('../models/Dialog');
const ChatAction = require('../models/ChatAction');
const Pin = require('../models/Pin');
const Reaction = require('../models/Reaction');
const { MAX_SESSIONS } = require('../constants/allowed');
const { extractCloudinaryId } = require('../utils/file');
const cloudinary = require('../config/cloudinary');

const addSession = async (username, token, device, ip) => {
    try {
        const user = await User.findOne({ username });
        if (!user) return;
        if (user.sessions.length >= MAX_SESSIONS) {
            user.sessions.sort((a, b) => new Date(a.lastActive) - new Date(b.lastActive));
            user.sessions.shift();
        }
        user.sessions.push({ token, device, ip, lastActive: new Date() });
        await user.save();
    } catch {}
};

const nukeUserAccount = async (username) => {
    try {
        const user = await User.findOne({ username }).lean();
        if (!user) return false;

        const BlackList = require('../models/BlackList');
        const myRooms = await Room.find({ owner: username }).lean();
        const myRoomIds = myRooms.map(r => r.roomId);

        const msgsWithFiles = await Message.find({
            sender: username,
            $or: [
                { fileUrl: { $nin: [null, '', 'dummy'] } },
                { fileUrls: { $not: { $size: 0 } } }
            ]
        }).lean();

        const urlsToDelete = new Set();
        if (user.avatar && user.avatar.includes('cloudinary.com')) urlsToDelete.add(user.avatar);
        myRooms.forEach(r => { if (r.avatar && r.avatar.includes('cloudinary.com')) urlsToDelete.add(r.avatar); });
        msgsWithFiles.forEach(m => {
            if (m.fileUrl && m.fileUrl.includes('cloudinary.com')) urlsToDelete.add(m.fileUrl);
            if (m.fileUrls && m.fileUrls.length > 0) {
                m.fileUrls.forEach(u => { if (u.includes('cloudinary.com')) urlsToDelete.add(u); });
            }
        });

        const deletePromises = Array.from(urlsToDelete).map(url => {
            const publicId = extractCloudinaryId(url);
            if (publicId) {
                const resourceType = url.match(/\.(mp4|webm|mov|mp3|wav|ogg|m4a)$/i) ? 'video' : 'image';
                return cloudinary.uploader.destroy(publicId, { resource_type: resourceType }).catch(() => {});
            }
            return Promise.resolve();
        });

        await Promise.all([
            ...deletePromises,
            Message.deleteMany({ $or: [{ sender: username }, { receiver: username }] }),
            Dialog.deleteMany({ participants: username }),
            ChatAction.deleteMany({ $or: [{ user: username }, { contact: username }] }),
            Room.updateMany({ members: username }, { $pull: { members: username } }),
            Room.updateMany({ joinRequests: username }, { $pull: { joinRequests: username } }),
            Pin.deleteMany({ pinner_id: username }),
            Reaction.deleteMany({ user: username }),
            BlackList.deleteMany({ $or: [{ user_id: username }, { blocked_id: username }] }),
            mongoose.connection.db.collection('sessions').deleteMany({ session: { $regex: '"username":"' + username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"' } }).catch(() => {})
        ]);

        if (myRoomIds.length > 0) {
            await Promise.all([
                Room.deleteMany({ owner: username }),
                Message.deleteMany({ receiver: { $in: myRoomIds } }),
                Pin.deleteMany({ chat_id: { $in: myRoomIds } })
            ]);
        }

        await User.deleteOne({ username });
        return true;
    } catch (err) {
        return false;
    }
};

module.exports = { addSession, nukeUserAccount };
