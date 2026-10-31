import multer from 'multer';

// Use memory storage for S3 uploads
const storage = multer.memoryStorage();

/**
 * Uploads land in a bucket the application serves back to users, so the type and
 * size are a trust boundary, not a nicety: without these an authenticated caller
 * could park arbitrary executables or fill the bucket from a single request.
 */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES };
export default upload;
