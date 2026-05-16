export const uploadController = {
  uploadTaskImage(req, res) {
    // multer-s3 populates req.file after a successful upload
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    return res.status(200).json({
      message: 'Image uploaded successfully.',
      imageUrl: req.file.location, // full S3 HTTPS URL
      key: req.file.key, // e.g. "task-images/uuid.jpg"
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  },
};

// Multer error handler — call this AFTER your routes as Express error middleware
export const multerErrorHandler = (err, _req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File too large. Maximum size is 5 MB.' });
  }
  if (err.message && err.message.startsWith('Invalid file type')) {
    return res.status(415).json({ message: err.message });
  }
  next(err);
};
