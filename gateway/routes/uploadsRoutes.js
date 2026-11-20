// routes/uploadRoutes.js
import express from 'express';
import upload from '../middleware/upload.js';
import { processContractUpload, processContractQuestion } from '../controller/uploadController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import validatePdf from '../middleware/validatePdf.js';

const router = express.Router();

router.post('/', upload.single('contract'), validatePdf, asyncHandler(processContractUpload));
router.post('/qa', upload.single('contract'), validatePdf, asyncHandler(processContractQuestion));
export default router;
