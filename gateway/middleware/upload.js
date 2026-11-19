// middleware/upload.js
// Shared multer config: keep the PDF in memory, max 10 MB, PDF mimetype only.
import multer from 'multer';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            const err = new Error('Invalid file type');
            err.status = 400;
            return cb(err);
        }
        cb(null, true);
    },
});

export default upload;
