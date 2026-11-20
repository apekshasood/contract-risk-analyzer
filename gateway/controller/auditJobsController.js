// controller/auditJobsController.js
// The browser already uploaded the PDF to Storage and inserted a `queued` audit row
// (RLS makes sure it can only do that for itself). This endpoint:
//   1. checks the audit belongs to the signed-in user and is still queued
//   2. enforces the daily limit
//   3. asks the AI engine to start the job (engine answers 202 at once)
// The browser then watches the audit row in Supabase until done / failed.
import axios from 'axios';
import { db } from '../lib/supabase.js';

const DAILY_AUDIT_LIMIT = Number(process.env.DAILY_AUDIT_LIMIT ?? 5);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function startAuditJob(req, res) {
    const auditId = req.body?.auditId;
    if (typeof auditId !== 'string' || !UUID_RE.test(auditId)) {
        return res.status(400).json({ error: 'auditId must be a UUID' });
    }

    const { data: rows } = await db.get('/audits', {
        params: { id: `eq.${auditId}`, select: 'id,user_id,status' },
    });
    const audit = rows[0];
    // Same 404 for "missing" and "not yours": don't reveal other users' ids
    if (!audit || audit.user_id !== req.user.id) {
        return res.status(404).json({ error: 'Audit not found' });
    }
    if (audit.status !== 'queued') {
        return res.status(409).json({ error: `Audit is already ${audit.status}` });
    }

    if ((await countAuditsLast24h(req.user.id)) > DAILY_AUDIT_LIMIT) {
        const error = `Daily limit reached (${DAILY_AUDIT_LIMIT} audits per 24 hours). Please try again tomorrow.`;
        await markFailed(auditId, error);
        return res.status(429).json({ error });
    }

    try {
        await axios.post(`${process.env.AI_ENGINE_URL}/api/jobs/${auditId}`, null, {
            headers: { 'X-Engine-Secret': process.env.ENGINE_SECRET },
            timeout: 15_000,
        });
    } catch (err) {
        // Don't leave the row "queued" forever if the engine never got the job
        await markFailed(auditId, 'Analysis service unavailable. Please try again.');
        throw err; // errorHandler -> 502
    }

    res.status(202).json({ auditId, status: 'queued' });
}

// Stop button: mark the user's queued/processing audit as failed.
// The engine only writes to rows still "processing", so a late result is dropped.
export async function cancelAuditJob(req, res) {
    const auditId = req.params.id;
    if (!UUID_RE.test(auditId)) return res.status(400).json({ error: 'Invalid audit id' });

    const { data: rows } = await db.patch(
        '/audits',
        { status: 'failed', error: 'Stopped by you.' },
        {
            // user_id filter = ownership check; status filter = only running jobs
            params: { id: `eq.${auditId}`, user_id: `eq.${req.user.id}`, status: 'in.(queued,processing)', select: 'id,status' },
            headers: { Prefer: 'return=representation' },
        },
    );
    if (rows.length === 0) return res.status(409).json({ error: 'Audit is not running' });
    res.json({ auditId, status: 'failed' });
}

// Includes the audit just created, hence "> limit" above.
async function countAuditsLast24h(userId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { headers } = await db.get('/audits', {
        params: { user_id: `eq.${userId}`, created_at: `gte.${since}`, select: 'id' },
        headers: { Prefer: 'count=exact', Range: '0-0' },
    });
    // Content-Range: "0-0/7" -> 7
    return Number(headers['content-range']?.split('/')[1] ?? 0);
}

async function markFailed(auditId, error) {
    await db.patch('/audits', { status: 'failed', error }, { params: { id: `eq.${auditId}` } });
}
