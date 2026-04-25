import express from 'express';
import { getPool } from '../db.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { validateApplication } from '../middleware/validation.js';

const router = express.Router();

/**
 * POST /api/applications
 * Neue Bewerbung einreichen (öffentlich)
 */
router.post('/', validateApplication, async (req, res) => {
    try {
        const { name, discord, age, experience, motivation } = req.body;
        const pool = getPool();

        // Überprüfe ob Bewerber bereits existiert (Max 1 Bewerbung pro Discord)
        const [existing] = await pool.execute(
            'SELECT id FROM applications WHERE discord = ? AND status = "pending"',
            [discord]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Du hast bereits eine ausstehende Bewerbung. Warte auf eine Rückmeldung.'
            });
        }

        // Erstelle Bewerbung
        const [result] = await pool.execute(
            'INSERT INTO applications (name, discord, age, experience, motivation) VALUES (?, ?, ?, ?, ?)',
            [name, discord, age, experience, motivation]
        );

        res.status(201).json({
            success: true,
            message: 'Bewerbung erfolgreich eingereicht! Das Admin-Team wird sie überprüfen.',
            application: {
                id: result.insertId,
                name,
                discord,
                status: 'pending',
                created_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Application Submit Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Einreichen der Bewerbung'
        });
    }
});

/**
 * GET /api/applications
 * Alle Bewerbungen abrufen (nur Admins)
 */
router.get('/', authMiddleware, requirePermission('applications.read'), async (req, res) => {
    try {
        const pool = getPool();
        const { status, sortBy = 'created_at', order = 'DESC' } = req.query;

        let query = `
            SELECT 
                a.id, 
                a.name, 
                a.discord, 
                a.age, 
                a.experience, 
                a.motivation, 
                a.status, 
                a.admin_notes, 
                a.created_at, 
                a.reviewed_at, 
                a.reviewed_by,
                COALESCE(admin.username, 'System') as reviewed_by_admin
            FROM applications a
            LEFT JOIN admins admin ON a.reviewed_by = admin.id
            WHERE 1=1
        `;
        const params = [];

        // Filter nach Status
        if (status) {
            query += ' AND a.status = ?';
            params.push(status);
        }

        // Sortieren
        const allowedSort = ['created_at', 'name', 'status'];
        const allowedOrder = ['ASC', 'DESC'];
        const sort = allowedSort.includes(sortBy) ? sortBy : 'created_at';
        const orderDir = allowedOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

        query += ` ORDER BY a.${sort} ${orderDir}`;

        const [applications] = await pool.execute(query, params);

        res.json({
            success: true,
            count: applications.length,
            applications
        });
    } catch (error) {
        console.error('Get Applications Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Bewerbungen'
        });
    }
});

/**
 * GET /api/applications/:id
 * Einzelne Bewerbung abrufen (nur Admins)
 */
router.get('/:id', authMiddleware, requirePermission('applications.read'), async (req, res) => {
    try {
        const pool = getPool();
        const { id } = req.params;

        const [applications] = await pool.execute(
            `SELECT 
                a.*,
                COALESCE(admin.username, 'System') as reviewed_by_admin
            FROM applications a
            LEFT JOIN admins admin ON a.reviewed_by = admin.id
            WHERE a.id = ?`,
            [id]
        );

        if (applications.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Bewerbung nicht gefunden'
            });
        }

        res.json({
            success: true,
            application: applications[0]
        });
    } catch (error) {
        console.error('Get Application Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Bewerbung'
        });
    }
});

/**
 * PATCH /api/applications/:id
 * Bewerbung überprüfen und akzeptieren/ablehnen (nur Admins)
 */
router.patch('/:id', authMiddleware, requirePermission('applications.review'), async (req, res) => {
    try {
        const pool = getPool();
        const { id } = req.params;
        const { status, notes } = req.body;

        // Validiere Status
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status muss "accepted" oder "rejected" sein'
            });
        }

        // Update Bewerbung
        const [result] = await pool.execute(
            `UPDATE applications 
            SET status = ?, admin_notes = ?, reviewed_at = NOW(), reviewed_by = ?
            WHERE id = ?`,
            [status, notes || null, req.admin.id, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Bewerbung nicht gefunden'
            });
        }

        res.json({
            success: true,
            message: `Bewerbung als ${status === 'accepted' ? 'akzeptiert' : 'abgelehnt'} markiert`,
            status
        });
    } catch (error) {
        console.error('Update Application Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Aktualisieren der Bewerbung'
        });
    }
});

/**
 * DELETE /api/applications/:id
 * Bewerbung löschen (nur Admins)
 */
router.delete('/:id', authMiddleware, requirePermission('applications.delete'), async (req, res) => {
    try {
        const pool = getPool();
        const { id } = req.params;

        const [result] = await pool.execute(
            'DELETE FROM applications WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Bewerbung nicht gefunden'
            });
        }

        res.json({
            success: true,
            message: 'Bewerbung gelöscht'
        });
    } catch (error) {
        console.error('Delete Application Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Löschen der Bewerbung'
        });
    }
});

/**
 * GET /api/applications/stats/summary
 * Übersichtsstatistiken (nur Admins)
 */
router.get('/stats/summary', authMiddleware, requirePermission('stats.read'), async (req, res) => {
    try {
        const pool = getPool();

        const [stats] = await pool.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM applications
        `);

        res.json({
            success: true,
            stats: stats[0]
        });
    } catch (error) {
        console.error('Stats Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Statistiken'
        });
    }
});

export default router;
