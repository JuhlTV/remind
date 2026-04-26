import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';

dotenv.config();

let pool;

export async function initializePool() {
    try {
        pool = await mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306,
            charset: 'utf8mb4',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            connectTimeout: 10000,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
            supportBigNumbers: true,
            bigNumberStrings: true
        });

        console.log('✅ MySQL Connection Pool erstellt');
        return pool;
    } catch (error) {
        console.error('❌ Fehler beim Erstellen des Connection Pools:', error);
        throw error;
    }
}

export function getPool() {
    if (!pool) {
        throw new Error('Database pool ist nicht initialisiert. Rufe initializePool() zuerst auf!');
    }
    return pool;
}

export async function closePool() {
    if (pool) {
        await pool.end();
        console.log('✅ Datenbankverbindungen geschlossen');
    }
}
