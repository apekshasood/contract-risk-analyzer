// jobs/jobStore.js
// In-memory job store. Good enough for one gateway instance in dev.
// Jobs are lost on restart; Phase 3/4 moves them to the Supabase `audits` table.
import { randomUUID } from 'node:crypto';

const JOB_TTL_MS = 60 * 60 * 1000; // forget finished jobs after 1 hour
const jobs = new Map();

export function createJob() {
    const now = new Date().toISOString();
    const job = { id: randomUUID(), status: 'queued', result: null, error: null, createdAt: now, updatedAt: now };
    jobs.set(job.id, job);
    return job;
}

export function getJob(id) {
    return jobs.get(id) ?? null;
}

export function updateJob(id, changes) {
    const job = jobs.get(id);
    if (!job) return null;
    Object.assign(job, changes, { updatedAt: new Date().toISOString() });
    return job;
}

// Without this the Map grows forever (memory leak).
function removeOldJobs() {
    const cutoff = Date.now() - JOB_TTL_MS;
    for (const [id, job] of jobs) {
        const finished = job.status === 'done' || job.status === 'failed';
        if (finished && Date.parse(job.updatedAt) < cutoff) jobs.delete(id);
    }
}
setInterval(removeOldJobs, 10 * 60 * 1000).unref(); // unref: don't keep Node alive just for this
