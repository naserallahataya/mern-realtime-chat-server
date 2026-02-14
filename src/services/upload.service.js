// src/services/upload.service.js
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Default uploads dir inside project root
const DEFAULT_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

// read env var safely
const envUploadDir = (typeof process.env.UPLOAD_DIR === 'string' && process.env.UPLOAD_DIR.trim() !== '')
  ? process.env.UPLOAD_DIR.trim()
  : null;

let UPLOAD_DIR;
try {
  if (envUploadDir) {
    UPLOAD_DIR = path.isAbsolute(envUploadDir) ? envUploadDir : path.resolve(process.cwd(), envUploadDir);
  } else {
    UPLOAD_DIR = DEFAULT_UPLOAD_DIR;
  }
} catch (e) {
  // fallback to default if anything goes wrong
  UPLOAD_DIR = DEFAULT_UPLOAD_DIR;
}

// ensure folder exists
try {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (err) {
  console.error('Failed to create upload dir:', UPLOAD_DIR, err);
  // still continue (multer may fail later but we avoid crashing here)
}

// multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

export const uploadMiddleware = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

export const getFileUrl = (filename) => {
  const serverUrl = (process.env.SERVER_URL && typeof process.env.SERVER_URL === 'string')
    ? process.env.SERVER_URL.replace(/\/$/, '')
    : `http://localhost:${process.env.PORT || 3000}`;
  const rel = path.posix.join('/uploads', filename);
  return `${serverUrl}${rel}`;
};

export const getUploadDir = () => UPLOAD_DIR;
