import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';

dotenv.config();

async function setupDatabase() {
    try {
        // Connect to MySQL without database first
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT || 3306
        });

        console.log('✅ Verbunden zu MySQL Server');

        // Create database
        await connection.execute(
            `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`
        );
        console.log(`✅ Datenbank '${process.env.DB_NAME}' erstellt/existiert`);

        // Select database
        await connection.changeUser({
            database: process.env.DB_NAME
        });

        // Create admins table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS admins (
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(100),
                role ENUM('website_owner', 'projektleitung', 'hr_manager', 'reviewer', 'analyst', 'observer', 'support') NOT NULL DEFAULT 'reviewer',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabelle "admins" erstellt/existiert');

        // Add role column for existing installations
        const [roleColumn] = await connection.execute(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ?
              AND TABLE_NAME = 'admins'
              AND COLUMN_NAME = 'role'
            LIMIT 1
        `, [process.env.DB_NAME]);

        if (roleColumn.length === 0) {
            await connection.execute(`
                ALTER TABLE admins
                ADD COLUMN role ENUM('website_owner', 'projektleitung', 'hr_manager', 'reviewer', 'analyst', 'observer', 'support')
                NOT NULL DEFAULT 'reviewer'
            `);
            console.log('✅ Spalte "role" zu "admins" hinzugefügt');
        } else {
            await connection.execute(`
                ALTER TABLE admins
                MODIFY COLUMN role ENUM('website_owner', 'projektleitung', 'hr_manager', 'reviewer', 'analyst', 'observer', 'support')
                NOT NULL DEFAULT 'reviewer'
            `);
            console.log('✅ Rollen-Enum in "admins.role" synchronisiert');
        }

        // Create applications table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS applications (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                discord VARCHAR(50) NOT NULL,
                age INT NOT NULL,
                experience VARCHAR(255) NOT NULL,
                motivation LONGTEXT NOT NULL,
                status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
                admin_notes LONGTEXT,
                reviewed_at TIMESTAMP NULL,
                reviewed_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (reviewed_by) REFERENCES admins(id) ON DELETE SET NULL,
                INDEX idx_status (status),
                INDEX idx_created_at (created_at)
            )
        `);
        console.log('✅ Tabelle "applications" erstellt/existiert');

        // Check if admin exists and print onboarding
        const [admins] = await connection.execute(
            'SELECT COUNT(*) as count FROM admins'
        );

        if (admins[0].count === 0) {
            console.log('\n⚠️  Keine Admins gefunden. Erstelle jetzt deinen ersten Owner-Account:');
            console.log('npm run create-admin -- owner DEIN_SICHERES_PASSWORT website_owner\n');
        }

        await connection.end();
        console.log('\n✅ Datenbanksetup abgeschlossen!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Fehler beim Datenbanksetup:', error.message);
        console.error('\n⚠️  Überprüfe folgende Punkte:');
        console.error('1. .env Datei existiert mit korrekten MySQL-Zugangsdaten');
        console.error('2. MySQL Server läuft und ist erreichbar');
        console.error('3. Datenbankname und Benutzer sind korrekt');
        process.exit(1);
    }
}

setupDatabase();
