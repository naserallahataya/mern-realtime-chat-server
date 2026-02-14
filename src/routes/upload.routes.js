import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { uploadFile } from '../controllers/upload.controller.js';
import { uploadMiddleware } from '../services/upload.service.js';

const router = express.Router();

router.post('/', authMiddleware, uploadMiddleware.single('file'), uploadFile);

export default router;
