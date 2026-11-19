// routes/auditJobsRoutes.js
import express from 'express';
import upload from '../middleware/upload.js';
import validatePdf from '../middleware/validatePdf.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createAuditJob, getAuditJob } from '../controller/auditJobsController.js';

const router = express.Router();

router.post('/', upload.single('contract'), validatePdf, asyncHandler(createAuditJob));
router.get('/:id', asyncHandler(getAuditJob));

export default router;
