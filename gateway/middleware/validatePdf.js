export const validatePdf = (req, res, next) => {
    if(!req.file) {
        const err = new Error('No file uploaded');
        err,status = 400;
        return next(err);
    }
    
    const header = req.file.buffer.subarray(0, 5).toString('ascii');
    if(header !== '%PDF-') {
        const err = new Error("FIle is not a valid PDF");
        err.status = 400;
        return next(err);
    }
    next();
};

export default validatePdf;