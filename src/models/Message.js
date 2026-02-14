import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const AttachmentSchema = new Schema({
  type: { type: String, enum: ['image','audio','video','file'], required: true },
  url: { type: String, required: true },
  fileName: String,
  size: Number,
  mime: String
}, { _id: false });

const MessageSchema = new Schema({
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },
  attachments: [AttachmentSchema],
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

MessageSchema.index({ conversation: 1, createdAt: -1 });

export default model('Message', MessageSchema);
