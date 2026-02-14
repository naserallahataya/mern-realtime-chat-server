import { getFileUrl } from '../services/upload.service.js';

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    console.log('UPLOAD: saved file ->', req.file); // debug
    const url = getFileUrl(req.file.filename);
    res.json({ url, fileName: req.file.originalname, size: req.file.size, mime: req.file.mimetype });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
