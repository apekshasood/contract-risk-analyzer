// controllers/uploadController.js
import FormData from 'form-data';
import axios from 'axios';

function qaForm(req) {
    const question = req.body.question?.trim();
    if (!question) {
        const err = new Error('Question is required');
        err.status = 400;
        throw err;
    }

    const form = new FormData();
    form.append('file', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
    });
    form.append('question', question);
    form.append('history', req.body.history ?? '[]');
    form.append('role', req.body.role ?? 'buyer');
    return form;
}

// Q&A: same PDF + a question -> Python /api/qa
export async function processContractQuestion(req, res) {
    const form = qaForm(req);
    const response = await axios.post(`${process.env.AI_ENGINE_URL}/api/qa`, form, {
        headers: { ...form.getHeaders(), 'X-Engine-Secret': process.env.ENGINE_SECRET },
        timeout: 2 * 60 * 1000,
    });

    return res.json(response.data);
}


// Q&A, streamed: pipe Python's Server-Sent Events straight to the browser.
export async function streamContractQuestion(req, res) {
    const form = qaForm(req);
    const controller = new AbortController();
    // Browser closed the tab or pressed Stop: stop reading from Python too.
    res.on('close', () => controller.abort());

    const response = await axios.post(`${process.env.AI_ENGINE_URL}/api/qa/stream`, form, {
        headers: { ...form.getHeaders(), 'X-Engine-Secret': process.env.ENGINE_SECRET },
        responseType: 'stream',
        signal: controller.signal,
        timeout: 2 * 60 * 1000, // fires if Python goes silent for 2 min, not on total length
        validateStatus: () => true,
    });

    // Python failed before streaming (bad PDF, bad history): body is JSON, not SSE.
    if (response.status >= 400) {
        let detail;
        try {
            const chunks = [];
            for await (const c of response.data) chunks.push(Buffer.from(c));
            detail = JSON.parse(Buffer.concat(chunks).toString()).detail;
        } catch { /* not JSON */ }
        const err = new Error(typeof detail === 'string' ? detail : 'Analysis service unavailable');
        err.status = response.status < 500 ? response.status : 502;
        throw err;
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no', // ask proxies not to buffer the stream
    });
    response.data.on('error', () => res.end()); // Python dropped mid-stream
    response.data.pipe(res);
}
