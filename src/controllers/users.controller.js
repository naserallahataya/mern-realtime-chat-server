import User from '../models/UserModel.js';
import bcrypt from 'bcrypt';
import { getFileUrl, getUploadDir } from '../services/upload.service.js';
import path from 'path'
import fs from 'fs';


export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'Not found' });
    res.json(user);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

export const searchUsers = async (req, res) => {
  try {
    const q = req.query.search || '';
    const users = await User.find({ username: { $regex: q, $options: 'i' } }).limit(20).select('-passwordHash');
    res.json(users);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

export const updateProfile = async (req, res) => {
  try {
    const id = req.params.id;

    if (req.user._id.toString() !== id)
      return res.status(403).json({ message: 'Forbidden' });

    const { username, statusText } = req.body;
    const update = {};

    if (username) update.username = username;
    if (statusText) update.statusText = statusText;

    // handle avatar file (multer.diskStorage ensures filename has extension)
    if (req.file) {
      // Build full URL to store in DB
      const url = getFileUrl(req.file.filename);
      update.avatarUrl = url;

      // OPTIONAL: delete previous avatar file from disk (if it was stored locally)
      try {
        const user = await User.findById(id).lean();
        if (user && user.avatarUrl) {
          // If avatarUrl is a full URL, extract filename
          const prev = user.avatarUrl;
          const uploadsDir = getUploadDir();
          let prevFilename = null;
          if (prev.startsWith('http')) {
            // assume format http://host/uploads/filename.ext
            prevFilename = prev.split('/').pop();
          } else if (prev.startsWith('/uploads')) {
            prevFilename = prev.split('/').pop();
          }
          if (prevFilename) {
            const prevPath = path.join(uploadsDir, prevFilename);
            if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);
          }
        }
      } catch (e) {
        console.warn('Failed to remove previous avatar (non-fatal):', e.message || e);
      }
    }

    if (req.body.password) {
      const hash = await bcrypt.hash(req.body.password, 10);
      update.passwordHash = hash;
    }

    const user = await User.findByIdAndUpdate(id, update, { new: true })
                           .select('-passwordHash');

    res.json(user);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

