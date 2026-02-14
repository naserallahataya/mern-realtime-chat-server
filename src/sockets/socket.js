// src/sockets/socket.js
import jwt from 'jsonwebtoken';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import { setIO } from './io.js';
import mongoose from 'mongoose';

const onlineUsers = new Map(); // userId -> Set(socketId)

export default function setupSocket(io) {
  setIO(io);

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Auth error'));
      // token may be "Bearer <token>" or raw token — handle both
      const raw = token.startsWith && token.startsWith('Bearer ') ? token.split(' ')[1] : token;
      const payload = jwt.verify(raw, process.env.JWT_SECRET);
      socket.userId = payload.id;
      next();
    } catch (err) {
      next(new Error('Auth error'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId.toString();
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // join conversation rooms for this user
    try {
      const convs = await Conversation.find({ participants: userId }).select('_id').lean();
      convs.forEach(c => {
        const room = `conv_${c._id.toString()}`;
        socket.join(room);
      });
    } catch (e) {
      console.warn('Failed joining conv rooms for user', userId, e.message || e);
    }

    // emit updated online list (optional)
    io.emit('online_users', Array.from(onlineUsers.keys()));

    // handle incoming send_message via socket
    socket.on('send_message', async (payload, ack) => {
      // payload: { conversationId, text, attachments }
      try {
        const { conversationId, text = '', attachments = [] } = payload;
        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
          if (ack) ack({ status: 'error', message: 'invalid conversationId' });
          return;
        }

        // verify user is participant
        const conv = await Conversation.findById(conversationId).lean();
        if (!conv) {
          if (ack) ack({ status: 'error', message: 'conversation not found' });
          return;
        }
        const me = socket.userId.toString();
        if (!conv.participants.map(p => p.toString()).includes(me)) {
          if (ack) ack({ status: 'error', message: 'forbidden' });
          return;
        }

        // create message
        const message = await Message.create({
          conversation: conversationId,
          from: me,
          text,
          attachments
        });

        // update conversation lastMessageAt
        await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() });

        const populated = await Message.findById(message._id).populate('from', 'username avatarUrl').lean();

        // emit to conversation room only
        const room = `conv_${conversationId}`;
        io.to(room).emit('new_message', populated);

        if (ack) ack({ status: 'ok', message: populated });
      } catch (err) {
        console.error('socket send_message error', err);
        if (ack) ack({ status: 'error' });
      }
    });

    socket.on('typing', ({ conversationId, isTyping }) => {
      // broadcast typing to conv room excluding sender
      if (!conversationId) return;
      const room = `conv_${conversationId}`;
      socket.to(room).emit('typing', { conversationId, userId });
    });

    socket.on('mark_read', async ({ conversationId }) => {
      try {
        const me = socket.userId.toString();
        await Message.updateMany({ conversation: conversationId, from: { $ne: me }, readBy: { $ne: me } }, { $addToSet: { readBy: me } });
        io.to(`conv_${conversationId}`).emit('marked_read', { conversationId, userId: me });
      } catch (e) { console.error(e); }
    });

    socket.on('disconnect', () => {
      const set = onlineUsers.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) onlineUsers.delete(userId);
      }
      io.emit('online_users', Array.from(onlineUsers.keys()));
    });
  });
}
