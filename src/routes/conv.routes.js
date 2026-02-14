// src/routes/conv.routes.js
import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  createConversation,
  listConversations,
  getMessages,
  markRead,
  createMessage,
  createGroup,
  updateGroupTitle,
  addGroupMember,
  removeGroupMember
} from '../controllers/conv.controller.js';

const router = express.Router();

// 1:1 conv
router.post('/', authMiddleware, createConversation);
router.get('/', authMiddleware, listConversations);
router.get('/:id/messages', authMiddleware, getMessages);
router.patch('/:id/read', authMiddleware, markRead);

// messages via REST (create message)
router.post('/:id/messages', authMiddleware, createMessage);

// group endpoints
router.post('/group', authMiddleware, createGroup);
router.put('/group/:id/title', authMiddleware, updateGroupTitle);
router.post('/group/:id/add', authMiddleware, addGroupMember);
router.post('/group/:id/remove', authMiddleware, removeGroupMember);

export default router;
