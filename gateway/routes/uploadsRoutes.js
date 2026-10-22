// routes/uploadRoutes.js
import express from 'express';
import multer from 'multer';
import { processContractUpload, processContractQuestion } from '../controller/uploadController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import validatePdf from '../middleware/validatePdf.js';

const router = express.Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
    // Limits the size of the file to 10MB
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
router.post('/', upload.single('contract'), validatePdf, asyncHandler(processContractUpload));
router.post('/qa', upload.single('contract'), validatePdf, asyncHandler(processContractQuestion));
export default router;