// src/routes/users.routes.js
import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { getProfile, searchUsers, updateProfile } from '../controllers/users.controller.js';

// <-- import upload middleware from service
import { uploadMiddleware } from '../services/upload.service.js';

const router = express.Router();

router.get('/', authMiddleware, searchUsers); // ?search=
router.get('/:id', authMiddleware, getProfile);

// USE uploadMiddleware which uses diskStorage and preserves extension
router.put('/:id', authMiddleware, uploadMiddleware.single('avatar'), updateProfile);

export default router;
