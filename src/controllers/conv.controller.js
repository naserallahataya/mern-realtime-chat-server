// src/controllers/conv.controller.js
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import mongoose from 'mongoose';
import { getIO } from '../sockets/io.js';


// create or return existing 1:1 conversation
export const createConversation = async (req, res) => {
  try {
    const { participantId } = req.body; // other user id
    const me = req.user._id;
    if (!participantId) return res.status(400).json({ message: 'participantId required' });

    // ensure both ids valid
    if (!mongoose.Types.ObjectId.isValid(participantId)) return res.status(400).json({ message: 'invalid id' });

    // try find existing between same two users (order-independent)
    const conv = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [me, participantId], $size: 2 }
    });

    if (conv) return res.json(conv);

    const created = await Conversation.create({ participants: [me, participantId], isGroup: false, lastMessageAt: new Date() });
    res.json(created);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

export const listConversations = async (req, res) => {
  try {
    const me = req.user._id;
    // fetch conversations where user participates
    const convs = await Conversation.find({ participants: me }).sort({ lastMessageAt: -1 }).lean();

    // for each conv compute unread count and last message
    const results = await Promise.all(convs.map(async (c) => {
      const lastMsg = await Message.findOne({ conversation: c._id }).sort({ createdAt: -1 }).limit(1).lean();
      const unread = await Message.countDocuments({ conversation: c._id, from: { $ne: me }, readBy: { $ne: me } });
      return { ...c, lastMessage: lastMsg || null, unreadCount: unread };
    }));

    res.json(results);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

export const getMessages = async (req, res) => {
  try {
    const { id } = req.params; // conversation id
    const limit = parseInt(req.query.limit || '50', 10);
    const before = req.query.before; // optional message id or date

    const query = { conversation: id };
    if (before) {
      if (mongoose.Types.ObjectId.isValid(before)) {
        const m = await Message.findById(before);
        if (m) query.createdAt = { $lt: m.createdAt };
      } else {
        const d = new Date(before);
        if (!isNaN(d)) query.createdAt = { $lt: d };
      }
    }

    const messages = await Message.find(query).sort({ createdAt: -1 }).limit(limit).populate('from', 'username avatarUrl').lean();
    res.json(messages.reverse()); // return chronological
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

export const markRead = async (req, res) => {
  try {
    const { id } = req.params; // conversation id
    const me = req.user._id;
    await Message.updateMany({ conversation: id, from: { $ne: me }, readBy: { $ne: me } }, { $addToSet: { readBy: me } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};



/**
 * Create a message via REST for a conversation (saves message and returns it).
 * Also updates conversation.lastMessageAt.
 * URL: POST /api/conversations/:id/messages
 * Body: { text, attachments }
 */
export const createMessage = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const me = req.user._id.toString();
    const { text = '', attachments = [] } = req.body;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) return res.status(400).json({ message: 'Invalid conversation id' });

    const conv = await Conversation.findById(conversationId).lean();
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });

    const isParticipant = conv.participants.map(p => p.toString()).includes(me);
    if (!isParticipant) return res.status(403).json({ message: 'Forbidden' });

    const message = await Message.create({
      conversation: conversationId,
      from: me,
      text,
      attachments
    });

    await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() });

    const populated = await Message.findById(message._id).populate('from', 'username avatarUrl').lean();

    // emit to room conv_<id>
    try {
      const io = getIO();
      io.to(`conv_${conversationId}`).emit('new_message', populated);
    } catch (e) {
      console.warn('IO not initialized (message will still be saved):', e.message || e);
    }

    return res.status(201).json({ message: populated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Create Group Conversation
 * POST /api/conversations/group
 * body: { title, members: [userId,...] }
 */
export const createGroup = async (req, res) => {
  try {
    const { title, members } = req.body;
    const me = req.user._id.toString();

    if (!title || !Array.isArray(members)) return res.status(400).json({ message: 'title and members array required' });

    // normalize ids to strings and ensure requester included
    const uniq = Array.from(new Set(members.map(m => m.toString())));
    if (!uniq.includes(me)) uniq.push(me);

    if (uniq.length < 3) return res.status(400).json({ message: 'Group requires at least 3 participants (including you)' });

    const conv = await Conversation.create({
      participants: uniq,
      isGroup: true,
      title,
      lastMessageAt: new Date()
    });

    res.status(201).json(conv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update group title
 * PUT /api/conversations/group/:id/title
 * body: { title }
 */
export const updateGroupTitle = async (req, res) => {
  try {
    const convId = req.params.id;
    const { title } = req.body;
    if (!mongoose.Types.ObjectId.isValid(convId)) return res.status(400).json({ message: 'Invalid id' });

    const conv = await Conversation.findById(convId);
    if (!conv || !conv.isGroup) return res.status(404).json({ message: 'Group not found' });

    // check membership
    const me = req.user._id.toString();
    if (!conv.participants.map(p => p.toString()).includes(me)) return res.status(403).json({ message: 'Forbidden' });

    conv.title = title;
    await conv.save();
    res.json(conv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Add member to group
 * POST /api/conversations/group/:id/add
 * body: { userId }
 */
export const addGroupMember = async (req, res) => {
  try {
    const convId = req.params.id;
    const { userId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(convId) || !mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ message: 'Invalid id' });

    const conv = await Conversation.findById(convId);
    if (!conv || !conv.isGroup) return res.status(404).json({ message: 'Group not found' });

    const me = req.user._id.toString();
    if (!conv.participants.map(p => p.toString()).includes(me)) return res.status(403).json({ message: 'Forbidden' });

    if (!conv.participants.map(p => p.toString()).includes(userId)) {
      conv.participants.push(userId);
      await conv.save();
    }

    res.json(conv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Remove member from group (or leave)
 * POST /api/conversations/group/:id/remove
 * body: { userId }
 */
export const removeGroupMember = async (req, res) => {
  try {
    const convId = req.params.id;
    const { userId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(convId) || !mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ message: 'Invalid id' });

    const conv = await Conversation.findById(convId);
    if (!conv || !conv.isGroup) return res.status(404).json({ message: 'Group not found' });

    const me = req.user._id.toString();
    // only allow if requester is member (or admin if implemented)
    if (!conv.participants.map(p => p.toString()).includes(me)) return res.status(403).json({ message: 'Forbidden' });

    // if removing self -> allow leave
    conv.participants = conv.participants.filter(p => p.toString() !== userId);
    await conv.save();

    // optional: if participants less than 2, delete conv
    if (conv.participants.length < 2) {
      await Conversation.findByIdAndDelete(convId);
      return res.json({ message: 'Group removed because participants < 2' });
    }

    res.json(conv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
