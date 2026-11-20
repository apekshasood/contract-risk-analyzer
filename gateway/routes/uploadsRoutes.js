// routes/uploadsRoutes.js
import express from 'express';
import upload from '../middleware/upload.js';
import { processContractQuestion } from '../controller/uploadController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import validatePdf from '../middleware/validatePdf.js';
import { requireUser } from '../middleware/requireUser.js';

const router = express.Router();

// requireUser runs before multer, so anonymous requests are rejected before we buffer 10 MB.
// The old sync audit (POST /) is gone: audits now run as jobs via /api/audits.
router.post('/qa', requireUser, upload.single('contract'), validatePdf, asyncHandler(processContractQuestion));

export default router;
