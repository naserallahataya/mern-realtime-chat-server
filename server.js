import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path'; 
import connectDB  from './src/config/db.js';
import authRoutes from './src/routes/auth.routes.js';
import usersRoutes from './src/routes/users.routes.js';
import convRoutes from './src/routes/conv.routes.js';
import uploadRoutes from './src/routes/upload.routes.js';
import setupSocket from './src/sockets/socket.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/conversations', convRoutes);
app.use('/api/upload', uploadRoutes);


const rawUploadDir = (typeof process.env.UPLOAD_DIR === 'string' && process.env.UPLOAD_DIR.trim() !== '')
  ? process.env.UPLOAD_DIR.trim()
  : './uploads';

// normalize to absolute path
const uploadsPath = path.isAbsolute(rawUploadDir)
  ? rawUploadDir
  : path.resolve(process.cwd(), rawUploadDir);

// optional: create folder if not exists (prevents runtime errors)
import fs from 'fs';
try {
  if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
} catch (err) {
  console.warn('Could not create uploads dir:', uploadsPath, err);
}

console.log('Using uploads path:', uploadsPath);

// serve static uploads
app.use('/uploads', express.static(uploadsPath));

const server = http.createServer(app);

import { Server } from 'socket.io';
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || '*' } });

setupSocket(io);

const start = async () => {
  await connectDB();
  server.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
};

start();
