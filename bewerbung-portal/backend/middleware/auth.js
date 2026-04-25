import jwt from 'jsonwebtoken';
import { getPool } from '../db.js';
import { getPermissionsForRole } from '../constants/roles.js';

/**
 * Middleware zum Überprüfen von JWT Token
 * Setzt req.admin mit Admin-Daten, wenn Token valide ist
 */
export async function authMiddleware(req, res, next) {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Kein Token gefunden. Bitte melde dich an.'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const pool = getPool();
        const [admins] = await pool.execute(
            'SELECT id, username, role FROM admins WHERE id = ? LIMIT 1',
            [decoded.id]
        );

        if (admins.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Admin Account wurde nicht gefunden.'
            });
        }

        const admin = admins[0];
        req.admin = {
            id: admin.id,
            username: admin.username,
            role: admin.role,
            permissions: getPermissionsForRole(admin.role)
        };
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: 'Token ungültig oder abgelaufen. Bitte melde dich neu an.'
        });
    }
}

/**
 * Generiert JWT Token für Admin
 */
export function generateToken(admin) {
    return jwt.sign(
        {
            id: admin.id,
            username: admin.username
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
}

export function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.admin || !Array.isArray(req.admin.permissions)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigungen gefunden.'
            });
        }

        if (!req.admin.permissions.includes(permission)) {
            return res.status(403).json({
                success: false,
                message: `Du hast keine Berechtigung für: ${permission}`
            });
        }

        next();
    };
}
