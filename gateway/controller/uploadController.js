// controllers/uploadController.js
import FormData from 'form-data';
import axios from 'axios';

export async function processContractUpload(req, res, next) {
        const form = new FormData();
        console.log("RSS MB:", Math.round(process.memoryUsage().rss / 1024 / 1024));
    
        form.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });
        form.append('context', req.body.context ?? '');
        form.append('role', req.body.role ?? 'buyer');

        const response = await axios.post(`${process.env.AI_ENGINE_URL}/api/audit`, form, {
            headers: form.getHeaders(),
        });

        return res.json(response.data);
}


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
        headers: form.getHeaders(),
    });

    return res.json(response.data);
}
