const Message = require('../../models/Message');
const Dialog = require('../../models/Dialog');
const { getDialogId } = require('../../utils/dialog');
const { checkServerPrivacy } = require('../../middleware/privacyWrapper');
const { getIO } = require('../io');

const callTimeouts = new Map();
const activeCalls = new Map();

const handleCallRequest = (socket, data) => {
    if (!data || !data.target) return;
    const canCall = checkServerPrivacy(data.target, socket.username, 'calls');
    if (!canCall) return socket.emit('call_error', { reason: 'privacy' });
    const caller = socket.username.toLowerCase();
    const target = String(data.target).toLowerCase();
    if (caller === target) return;
    if (activeCalls.has(caller) || activeCalls.has(target)) return socket.emit('call_error', { reason: 'busy' });
    activeCalls.set(caller, { target, withVideo: !!data.withVideo, socketId: socket.id });
    const io = getIO();
    io.to(data.target).emit('call_incoming', { caller: socket.username, withVideo: data.withVideo, ringFile: data.ringFile || 'calling.mp3' });
    const key = `${caller}_${target}`;
    if (callTimeouts.has(key)) clearTimeout(callTimeouts.get(key));
    callTimeouts.set(key, setTimeout(async () => {
        callTimeouts.delete(key);
        activeCalls.delete(caller);
        io.to(target).emit('call_ended');
        io.to(caller).emit('call_ended');
        try {
            const dialogId = getDialogId(caller, target);
            const ts = new Date();
            const newMsgDoc = await Message.create({
                dialog_id: dialogId, sender: caller, receiver: target,
                text: '', isService: true, is_read: false, read_by: [caller],
                callType: 'missed', callDuration: 0, callWithVideo: !!data.withVideo,
                timestamp: ts
            });
            await Dialog.findOneAndUpdate(
                { dialog_id: dialogId },
                { $set: { participants: [caller, target], lastSender: caller, lastMessageTimestamp: ts, lastMessageText: '', lastCallType: 'missed', lastCallDuration: 0, lastCallWithVideo: !!data.withVideo } },
                { upsert: true }
            );
            const finalData = {
                id: newMsgDoc._id.toString(), sender: caller, receiver: target, text: '',
                isService: true, callType: 'missed', callDuration: 0, callWithVideo: !!data.withVideo,
                timestamp: newMsgDoc.timestamp, is_read: false
            };
            io.to(caller).to(target).emit('new_message', finalData);
            io.to(caller).to(target).emit('update_chat_list');
        } catch (e) {}
    }, 30000));
};

const handleCallResponse = async (socket, data) => {
    if (!data || !data.target) return;
    const caller = String(data.target).toLowerCase();
    const receiver = socket.username.toLowerCase();
    const call = activeCalls.get(caller);
    if (!call || call.target !== receiver) return;
    const io = getIO();
    io.to(data.target).emit('call_answered', { answer: data.answer });
    const key = `${caller}_${receiver}`;
    if (callTimeouts.has(key)) { clearTimeout(callTimeouts.get(key)); callTimeouts.delete(key); }
    activeCalls.delete(caller);
    if (data.answer === 'rejected' || data.answer === 'busy') {
        try {
            const dialogId = getDialogId(caller, receiver);
            const ts = new Date();
            const callTypeVal = data.answer === 'rejected' ? 'rejected' : 'missed';
            const newMsgDoc = await Message.create({
                dialog_id: dialogId, sender: caller, receiver: receiver,
                text: '', isService: true, is_read: false, read_by: [caller],
                callType: callTypeVal, callDuration: 0, callWithVideo: false,
                timestamp: ts
            });
            await Dialog.findOneAndUpdate(
                { dialog_id: dialogId },
                { $set: { participants: [caller, receiver], lastSender: caller, lastMessageTimestamp: ts, lastMessageText: '', lastCallType: callTypeVal, lastCallDuration: 0, lastCallWithVideo: false } },
                { upsert: true }
            );
            const finalData = {
                id: newMsgDoc._id.toString(), sender: caller, receiver: receiver, text: '',
                isService: true, callType: callTypeVal, callDuration: 0, callWithVideo: false,
                timestamp: newMsgDoc.timestamp, is_read: false
            };
            io.to(caller).to(receiver).emit('new_message', finalData);
            io.to(caller).to(receiver).emit('update_chat_list');
        } catch (e) {}
    }
};

const handleWebrtcSignal = (socket, data) => {
    if (!data || !data.target) return;
    const me = socket.username.toLowerCase();
    const target = String(data.target).toLowerCase();
    const call = activeCalls.get(me) || activeCalls.get(target);
    if (!call) return;
    const involved = (call.target === target && activeCalls.has(me)) || (call.target === me && activeCalls.has(target));
    if (!involved) return;
    const io = getIO();
    io.to(data.target).emit('webrtc_signal', { sender: socket.username, signal: data.signal });
};

const handleCallEnd = async (socket, data) => {
    if (!data || !data.target) return;
    const caller = socket.username.toLowerCase();
    const target = String(data.target).toLowerCase();
    const call = activeCalls.get(caller) || activeCalls.get(target);
    const involved = call && (call.target === target || call.target === caller);
    const io = getIO();
    io.to(data.target).emit('call_ended');
    if (!involved) return;
    try {
        activeCalls.delete(caller);
        activeCalls.delete(target);
        const key1 = `${caller}_${target}`;
        const key2 = `${target}_${caller}`;
        if (callTimeouts.has(key1)) { clearTimeout(callTimeouts.get(key1)); callTimeouts.delete(key1); }
        if (callTimeouts.has(key2)) { clearTimeout(callTimeouts.get(key2)); callTimeouts.delete(key2); }
        const dialogId = getDialogId(caller, target);
        const duration = parseInt(data.callDuration) || 0;
        const withVideo = !!data.withVideo;
        const ts = new Date();
        const newMsgDoc = await Message.create({
            dialog_id: dialogId, sender: caller, receiver: target,
            text: '', isService: true, is_read: false, read_by: [caller],
            callType: 'outgoing', callDuration: duration, callWithVideo: withVideo,
            timestamp: ts
        });
        await Dialog.findOneAndUpdate(
            { dialog_id: dialogId },
            { $set: { participants: [caller, target], lastSender: caller, lastMessageTimestamp: ts, lastMessageText: '', lastCallType: 'outgoing', lastCallDuration: duration, lastCallWithVideo: withVideo } },
            { upsert: true }
        );
        const finalData = {
            id: newMsgDoc._id.toString(), sender: caller, receiver: target, text: '',
            isService: true, callType: 'outgoing', callDuration: duration, callWithVideo: withVideo,
            timestamp: newMsgDoc.timestamp, is_read: false
        };
        io.to(caller).to(target).emit('new_message', finalData);
        io.to(caller).to(target).emit('update_chat_list');
    } catch (e) {}
};

const getCallState = () => ({ callTimeouts, activeCalls });
const cleanupCallForUser = (username) => {
    const io = getIO();
    if (activeCalls.has(username)) {
        const call = activeCalls.get(username);
        activeCalls.delete(username);
        activeCalls.delete(call.target);
        io.to(call.target).emit('call_ended');
        io.to(username).emit('call_ended');
    } else {
        for (const [key, val] of activeCalls) {
            if (val.target === username) {
                activeCalls.delete(key);
                activeCalls.delete(val.target);
                io.to(val.target).emit('call_ended');
                io.to(key).emit('call_ended');
                break;
            }
        }
    }
};

module.exports = {
    handleCallRequest, handleCallResponse, handleWebrtcSignal, handleCallEnd,
    getCallState, cleanupCallForUser, callTimeouts, activeCalls
};
