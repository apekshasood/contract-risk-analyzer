import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import uploadsRoutes from './routes/uploadsRoutes.js';
import auditJobsRoutes from './routes/auditJobsRoutes.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

const PORT = process.env.PORT || 3001;

// Middleware
// CORS_ORIGIN: comma-separated list, e.g. "http://localhost:3000,https://myapp.vercel.app"
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
// A simple GET route to test if it's alive
app.get('/health', (req, res) => {
    res.json({ status: "Gateway is running!" });
});


app.use('/api/uploads', uploadsRoutes);
app.use('/api/audits', auditJobsRoutes);
app.use(errorHandler);
app.listen(PORT, () => {
    console.log(`🚀 Gateway listening on port ${PORT}`);
});