// controllers/uploadController.js
import FormData from 'form-data';
import axios from 'axios';

// Q&A: same PDF + a question -> Python /api/qa
export async function processContractQuestion(req, res) {
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

    const response = await axios.post(`${process.env.AI_ENGINE_URL}/api/qa`, form, {
        headers: { ...form.getHeaders(), 'X-Engine-Secret': process.env.ENGINE_SECRET },
        timeout: 2 * 60 * 1000,
    });

    return res.json(response.data);
}
