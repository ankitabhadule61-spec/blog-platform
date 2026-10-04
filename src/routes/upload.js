const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { bad } = require('../utils/http');

const router = express.Router();

fs.mkdirSync(config.uploadDir, { recursive: true });

const TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.uploadDir),
    // Random name + extension chosen from the verified mime type, never from user input.
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + TYPES[file.mimetype])
  }),
  limits: { fileSize: config.maxUploadMB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (TYPES[file.mimetype] ? cb(null, true) : cb(bad('Only PNG, JPG, GIF or WebP images are allowed')))
});

// Confirm the bytes really are an image, not just a spoofed Content-Type.
function looksLikeImage(file) {
  const b = Buffer.alloc(12);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, b, 0, 12, 0);
  fs.closeSync(fd);
  return (
    (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') ||
    (b[0] === 0xff && b[1] === 0xd8) ||
    b.toString('ascii', 0, 3) === 'GIF' ||
    (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP')
  );
}

router.post('/', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) throw bad('No file uploaded');
  if (!looksLikeImage(req.file.path)) {
    fs.unlink(req.file.path, () => {});
    throw bad('That file is not a valid image');
  }
  res.status(201).json({ url: `/uploads/${path.basename(req.file.filename)}` });
});

module.exports = router;
