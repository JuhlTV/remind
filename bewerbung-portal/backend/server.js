import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializePool, closePool } from './db.js';
import authRoutes from './routes/auth.js';
import applicationRoutes from './routes/applications.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint nicht gefunden',
        path: req.path
    });
});

// Error Handler
app.use((error, req, res, next) => {
    console.error('Server Fehler:', error);
    res.status(500).json({
        success: false,
        message: 'Interner Serverfehler',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// Server starten
async function startServer() {
    try {
        // Initialize database
        await initializePool();
        console.log('✅ Datenbankverbindung hergestellt');

        // Start server
        app.listen(PORT, () => {
            console.log(`\n🚀 Bewerbungsportal Server läuft auf Port ${PORT}`);
            console.log(`📍 URL: http://localhost:${PORT}`);
            console.log(`🔗 API Health Check: http://localhost:${PORT}/api/health`);
            console.log(`\n⚠️  Stelle sicher dass deine .env Datei korrekt konfiguriert ist!`);
        });
    } catch (error) {
        console.error('❌ Fehler beim Starten des Servers:', error);
        process.exit(1);
    }
}

// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('\n⏹️  Server wird heruntergefahren...');
    await closePool();
    process.exit(0);
});

startServer();
