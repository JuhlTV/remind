import express from 'express';
import bcrypt from 'bcryptjs';
import { getPool } from '../db.js';
import { authMiddleware, generateToken, requirePermission } from '../middleware/auth.js';
import { validateLogin } from '../middleware/validation.js';
import {
    canManageRole,
    getPermissionsForRole,
    getRoleMatrix,
    isValidRole,
    listRoles
} from '../constants/roles.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Admin Login
 */
router.post('/login', validateLogin, async (req, res) => {
    try {
        const { username, password } = req.body;
        const pool = getPool();

        // Finde Admin
        const [admins] = await pool.execute(
            'SELECT id, username, role, password_hash FROM admins WHERE username = ?',
            [username]
        );

        if (admins.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Username oder Passwort ist falsch'
            });
        }

        const admin = admins[0];

        // Vergleiche Passwort
        const isPasswordValid = await bcrypt.compare(password, admin.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Username oder Passwort ist falsch'
            });
        }

        // Generiere Token
        const token = generateToken(admin);

        res.json({
            success: true,
            message: 'Login erfolgreich',
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                role: admin.role,
                permissions: getPermissionsForRole(admin.role)
            }
        });
    } catch (error) {
        console.error('Login Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Login'
        });
    }
});

/**
 * GET /api/auth/roles
 * Rollen und Rechte abrufen
 */
router.get('/roles', authMiddleware, async (req, res) => {
    res.json({
        success: true,
        roles: listRoles(),
        matrix: getRoleMatrix()
    });
});

/**
 * GET /api/auth/admins
 * Admins abrufen (nur mit admins.read)
 */
router.get('/admins', authMiddleware, requirePermission('admins.read'), async (req, res) => {
    try {
        const pool = getPool();
        const [admins] = await pool.execute(
            'SELECT id, username, email, role, created_at, updated_at FROM admins ORDER BY created_at DESC'
        );

        res.json({
            success: true,
            admins: admins.map(admin => ({
                ...admin,
                permissions: getPermissionsForRole(admin.role)
            }))
        });
    } catch (error) {
        console.error('Admins laden Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Laden der Admins'
        });
    }
});

/**
 * POST /api/auth/admins
 * Neuen Admin erstellen (nur mit admins.create)
 */
router.post('/admins', authMiddleware, requirePermission('admins.create'), async (req, res) => {
    try {
        const { username, password, role, email } = req.body;
        const pool = getPool();

        // Validiere Input
        if (!username || username.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Username muss mindestens 3 Zeichen lang sein'
            });
        }

        if (!password || password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Passwort muss mindestens 6 Zeichen lang sein'
            });
        }

        if (!isValidRole(role)) {
            return res.status(400).json({
                success: false,
                message: 'Ungültige Rolle'
            });
        }

        if (!canManageRole(req.admin.role, role)) {
            return res.status(403).json({
                success: false,
                message: 'Du darfst diese Rolle nicht vergeben'
            });
        }

        // Hash Passwort
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Erstelle Admin
        const [result] = await pool.execute(
            'INSERT INTO admins (username, password_hash, role, email) VALUES (?, ?, ?, ?)',
            [username.trim(), passwordHash, role, email?.trim() || null]
        );

        const newAdmin = {
            id: result.insertId,
            username: username.trim(),
            role,
            permissions: getPermissionsForRole(role)
        };

        res.status(201).json({
            success: true,
            message: 'Admin erfolgreich erstellt',
            admin: newAdmin
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Username existiert bereits'
            });
        }

        console.error('Admin erstellen Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Erstellen des Admins'
        });
    }
});

/**
 * PATCH /api/auth/admins/:id/role
 * Rolle eines Admins ändern (nur mit admins.assign_roles)
 */
router.patch('/admins/:id/role', authMiddleware, requirePermission('admins.assign_roles'), async (req, res) => {
    try {
        const pool = getPool();
        const { id } = req.params;
        const { role } = req.body;

        if (!isValidRole(role)) {
            return res.status(400).json({
                success: false,
                message: 'Ungültige Rolle'
            });
        }

        const targetAdminId = Number(id);
        if (!Number.isInteger(targetAdminId) || targetAdminId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Ungültige Admin ID'
            });
        }

        if (req.admin.id === targetAdminId) {
            return res.status(400).json({
                success: false,
                message: 'Du kannst deine eigene Rolle nicht ändern'
            });
        }

        const [targetRows] = await pool.execute(
            'SELECT role FROM admins WHERE id = ? LIMIT 1',
            [targetAdminId]
        );

        if (targetRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Admin nicht gefunden'
            });
        }

        const currentTargetRole = targetRows[0].role;

        if (!canManageRole(req.admin.role, currentTargetRole)) {
            return res.status(403).json({
                success: false,
                message: 'Du darfst diesen Admin nicht bearbeiten'
            });
        }

        if (!canManageRole(req.admin.role, role)) {
            return res.status(403).json({
                success: false,
                message: 'Du darfst diese Zielrolle nicht vergeben'
            });
        }

        const [result] = await pool.execute(
            'UPDATE admins SET role = ?, updated_at = NOW() WHERE id = ?',
            [role, targetAdminId]
        );

        res.json({
            success: true,
            message: 'Rolle erfolgreich aktualisiert',
            role,
            permissions: getPermissionsForRole(role)
        });
    } catch (error) {
        console.error('Admin Rolle ändern Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Aktualisieren der Rolle'
        });
    }
});

/**
 * GET /api/auth/me
 * Aktuellen Admin inkl. Rolleninformationen abrufen
 */
router.get('/me', authMiddleware, async (req, res) => {
    res.json({
        success: true,
        admin: req.admin
    });
});

export default router;
