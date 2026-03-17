const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

function createImageUploader(folderName) {
  if (!folderName || typeof folderName !== 'string') {
    throw new Error('createImageUploader requires a folderName string');
  }

  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: folderName,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ quality: 'auto' }],
    },
  });

  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  const fileFilter = (req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported file type. Allowed: jpg, jpeg, png, webp'));
  };

  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter,
  });

  return {
    // raw multer instance so callers can use .single/.array/.fields
    upload,
    // convenience helpers
    single: (fieldName = 'image') => upload.single(fieldName),
    array: (fieldName, maxCount) => upload.array(fieldName, maxCount),
    fields: (fields) => upload.fields(fields),
  };
}

module.exports = createImageUploader;
