import bcrypt from 'bcryptjs';
import { initializePool, closePool, getPool } from './db.js';
import { isValidRole, getPermissionsForRole } from './constants/roles.js';

function printUsage() {
    console.log('Verwendung: npm run create-admin -- <username> <password> <role> [email]');
    console.log('Rollen: website_owner | projektleitung | hr_manager | reviewer | analyst | observer | support');
}

async function createAdmin() {
    const [username, password, role, email] = process.argv.slice(2);

    if (!username || !password || !role) {
        printUsage();
        process.exit(1);
    }

    if (username.trim().length < 3) {
        console.error('❌ Username muss mindestens 3 Zeichen lang sein');
        process.exit(1);
    }

    if (password.length < 8) {
        console.error('❌ Passwort muss mindestens 8 Zeichen lang sein');
        process.exit(1);
    }

    if (!isValidRole(role)) {
        console.error('❌ Ungültige Rolle:', role);
        printUsage();
        process.exit(1);
    }

    try {
        await initializePool();
        const pool = getPool();

        const [existing] = await pool.execute(
            'SELECT id FROM admins WHERE username = ? LIMIT 1',
            [username.trim()]
        );

        if (existing.length > 0) {
            console.error('❌ Username existiert bereits');
            process.exit(1);
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const [result] = await pool.execute(
            'INSERT INTO admins (username, password_hash, role, email) VALUES (?, ?, ?, ?)',
            [username.trim(), passwordHash, role, email?.trim() || null]
        );

        console.log('✅ Admin erfolgreich erstellt');
        console.log(`ID: ${result.insertId}`);
        console.log(`Username: ${username.trim()}`);
        console.log(`Rolle: ${role}`);
        console.log(`Rechte: ${getPermissionsForRole(role).join(', ')}`);
    } catch (error) {
        console.error('❌ Fehler beim Erstellen des Admins:', error.message);
        process.exit(1);
    } finally {
        await closePool();
    }
}

createAdmin();
