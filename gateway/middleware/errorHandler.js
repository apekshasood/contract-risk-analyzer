import multer from 'multer';

function errorHandler(err, req, res, next) {
    console.error('Error:', err.message);

    if(err instanceof multer.MulterError) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 500;
        return res.status(status).json({ error: err.message });
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