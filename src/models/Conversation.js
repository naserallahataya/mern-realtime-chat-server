import mongoose from 'mongoose';

const ConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  isGroup: { type: Boolean, default: false },
  title: { type: String },
  lastMessageAt: { type: Date },
  groupAvatar: { type: String, default: null },
}, { timestamps: true });

ConversationSchema.index({ participants: 1 });

export default mongoose.model('Conversation', ConversationSchema);
