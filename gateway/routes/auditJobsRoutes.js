// routes/auditJobsRoutes.js
import express from 'express';
import { requireUser } from '../middleware/requireUser.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { startAuditJob, cancelAuditJob } from '../controller/auditJobsController.js';

const router = express.Router();

// Status is not served here: the browser reads its own audit row from Supabase (RLS).
router.post('/', requireUser, asyncHandler(startAuditJob));
router.post('/:id/cancel', requireUser, asyncHandler(cancelAuditJob));

export default router;
