// controller/auditJobsController.js
// Async audit: answer 202 + jobId at once, run the audit in the background,
// the client polls GET /api/audits/:id until status is done or failed.
import FormData from 'form-data';
import axios from 'axios';
import { createJob, getJob, updateJob } from '../jobs/jobStore.js';

const AI_TIMEOUT_MS = 3 * 60 * 1000; // a job must never stay "processing" forever

export async function createAuditJob(req, res) {
    const job = createJob();

    // Copy what we need now: req is not ours after the response is sent.
    const input = {
        buffer: req.file.buffer,
        filename: req.file.originalname,
        contentType: req.file.mimetype,
        context: req.body.context ?? '',
        role: req.body.role ?? 'buyer',
    };

    res.status(202).json({ jobId: job.id, status: job.status });

    // Not awaited on purpose. runAudit catches its own errors, so this never rejects.
    runAudit(job.id, input);
}

export async function getAuditJob(req, res) {
    const job = getJob(req.params.id);
    if (!job) {
        const err = new Error('Job not found');
        err.status = 404;
        throw err;
    }
    res.json(job);
}

async function runAudit(jobId, input) {
    updateJob(jobId, { status: 'processing' });
    try {
        const form = new FormData();
        form.append('file', input.buffer, { filename: input.filename, contentType: input.contentType });
        form.append('context', input.context);
        form.append('role', input.role);

        const response = await axios.post(`${process.env.AI_ENGINE_URL}/api/audit`, form, {
            headers: form.getHeaders(),
            timeout: AI_TIMEOUT_MS,
        });
        updateJob(jobId, { status: 'done', result: response.data });
    } catch (err) {
        console.error(`Job ${jobId} failed:`, err.message);
        updateJob(jobId, { status: 'failed', error: toUserMessage(err) });
    }
}

// Show Python's 4xx message (e.g. "No text found in this PDF"), hide everything else.
function toUserMessage(err) {
    const status = err.response?.status;
    const detail = err.response?.data?.detail;
    if (status >= 400 && status < 500 && typeof detail === 'string') return detail;
    if (err.code === 'ECONNABORTED') return 'The analysis took too long. Please try again.';
    return 'Analysis failed. Please try again.';
}
