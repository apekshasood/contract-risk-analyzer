import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import uploadsRoutes from './routes/uploadsRoutes.js';
import errorHandler from './middleware/errorHandler.js';
import streamTestRoutes from "./routes/streamTest.js";

const app = express();

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());
// A simple GET route to test if it's alive
app.use("/api/stream-test", streamTestRoutes);
app.get('/health', (req, res) => {
    res.json({ status: "Gateway is running!" });
});


app.use('/api/uploads', uploadsRoutes);
app.use(errorHandler);
app.listen(PORT, () => {
    console.log(`🚀 Gateway listening on port ${PORT}`);
});