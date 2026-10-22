import multer from 'multer';

function errorHandler(err, req, res, next) {
    console.error('Error:', err.message);

    if(err instanceof multer.MulterError) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 500;
        return res.status(status).json({ error: err.message });
    }

    // Python answered with a 4xx (bad PDF, bad role...): pass its message through
    if (err.isAxiosError && err.response?.status >= 400 && err.response.status < 500) {
        const detail = err.response.data?.detail;
        return res.status(err.response.status).json({
            error: typeof detail === 'string' ? detail : 'Invalid request',
        });
    }

    if(err.isAxiosError) {
        return res.status(502).json({ error: 'Analysis service unavailable' });
    }

    const statusCode = err.status || err.statusCode || 500;

    res.status(statusCode).json({ 
        error : statusCode === 500 ? 'Internal server error' : err.message,
    });
}

export default errorHandler;    