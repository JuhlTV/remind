import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializePool, closePool } from './db.js';
import authRoutes from './routes/auth.js';
import applicationRoutes from './routes/applications.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

function createRequestId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

app.disable('x-powered-by');

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

app.use((error, req, res, next) => {
    if (error?.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            message: 'Request zu groß'
        });
    }

    if (error instanceof SyntaxError && 'body' in error) {
        return res.status(400).json({
            success: false,
            message: 'Ungültiges JSON im Request-Body'
        });
    }

    next(error);
});

// Request logging
app.use((req, res, next) => {
    const requestId = createRequestId();
    const startedAt = Date.now();

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
        const duration = Date.now() - startedAt;
        console.log(
            `[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`
        );
    });

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
        requestId: req.requestId,
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
        const server = app.listen(PORT, () => {
            console.log(`\n🚀 Bewerbungsportal Server läuft auf Port ${PORT}`);
            console.log(`📍 URL: http://localhost:${PORT}`);
            console.log(`🔗 API Health Check: http://localhost:${PORT}/api/health`);
            console.log(`\n⚠️  Stelle sicher dass deine .env Datei korrekt konfiguriert ist!`);
        });

        // Keep requests bounded to avoid hanging sockets during unstable networks.
        server.requestTimeout = 60_000;
        server.headersTimeout = 65_000;
        server.keepAliveTimeout = 5_000;
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

process.on('SIGTERM', async () => {
    console.log('\n⏹️  SIGTERM empfangen, Server wird heruntergefahren...');
    await closePool();
    process.exit(0);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

startServer();
