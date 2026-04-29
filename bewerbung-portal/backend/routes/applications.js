import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { getPool } from '../db.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { validateApplication } from '../middleware/validation.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');

const ALLOWED_STATUS = ['pending', 'accepted', 'rejected'];
const ALLOWED_SORT_FIELDS = {
    created_at: 'a.created_at',
    name: 'a.name',
    status: 'a.status',
    age: 'a.age'
};

function parsePositiveInt(value, fallback, min = 1, max = 100) {
    const numeric = Number.parseInt(value, 10);
    if (!Number.isInteger(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
}

function parseSort(sortBy, order) {
    const sortColumn = ALLOWED_SORT_FIELDS[sortBy] || ALLOWED_SORT_FIELDS.created_at;
    const sortDirection = String(order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return { sortColumn, sortDirection };
}

function normalizeStatusFilter(status) {
    if (!status) return null;
    const normalizedStatus = String(status).trim().toLowerCase();
    return ALLOWED_STATUS.includes(normalizedStatus) ? normalizedStatus : null;
}

function buildApplicationFilterClause({ status, search }) {
    const whereParts = ['1=1'];
    const params = [];

    const normalizedStatus = normalizeStatusFilter(status);
    if (status && !normalizedStatus) {
        return {
            isValid: false,
            whereSql: '',
            params,
            message: 'Ungültiger Status-Filter'
        };
    }

    if (normalizedStatus) {
        whereParts.push('a.status = ?');
        params.push(normalizedStatus);
    }

    const safeSearch = typeof search === 'string' ? search.trim() : '';
    if (safeSearch.length > 0) {
        whereParts.push('(a.name LIKE ? OR a.discord LIKE ?)');
        const wildcard = `%${safeSearch.slice(0, 80)}%`;
        params.push(wildcard, wildcard);
    }

    return {
        isValid: true,
        whereSql: whereParts.join(' AND '),
        params,
        message: null
    };
}

function csvEscape(value) {
    const rawValue = value === null || value === undefined ? '' : String(value);
    return `"${rawValue.replace(/"/g, '""')}"`;
}

function toPublicEvidenceUrl(storedName) {
    if (!storedName) return null;
    return `/uploads/${storedName}`;
}

async function saveEvidenceFile(evidence) {
    if (!evidence) return null;

    await fs.mkdir(uploadsDir, { recursive: true });

    const extensionByMime = {
        'application/pdf': '.pdf',
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/webp': '.webp'
    };

    const safeMime = String(evidence.type || '').toLowerCase();
    const fileExtension = extensionByMime[safeMime] || '';
    const storedName = `${Date.now()}-${randomUUID()}${fileExtension}`;
    const filePath = path.join(uploadsDir, storedName);
    const fileBuffer = Buffer.from(evidence.data, 'base64');

    await fs.writeFile(filePath, fileBuffer);

    return {
        originalName: evidence.name,
        storedName,
        mimeType: safeMime,
        size: fileBuffer.length
    };
}

async function writeActivityLog(connection, {
    applicationId = null,
    activityType,
    message,
    details = null,
    actorId = null
}) {
    await connection.execute(
        `INSERT INTO application_activity_log (application_id, activity_type, message, details, actor_id)
         VALUES (?, ?, ?, ?, ?)`,
        [applicationId, activityType, message, details ? JSON.stringify(details) : null, actorId]
    );
}

async function writeHistoryEntry(connection, {
    applicationId,
    oldStatus,
    newStatus,
    oldNotes,
    newNotes,
    actionType,
    changedBy
}) {
    await connection.execute(
        `INSERT INTO application_review_history
         (application_id, old_status, new_status, old_admin_notes, new_admin_notes, action_type, changed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [applicationId, oldStatus, newStatus, oldNotes || null, newNotes || null, actionType, changedBy]
    );
}

/**
 * POST /api/applications
 * Neue Bewerbung einreichen (öffentlich)
 */
router.post('/', validateApplication, async (req, res) => {
    try {
        const { name, discord, age, experience, motivation, evidence } = req.body;
        const pool = getPool();
        const evidenceMeta = await saveEvidenceFile(evidence);

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
            `INSERT INTO applications
             (name, discord, age, experience, motivation, evidence_original_name, evidence_stored_name, evidence_mime_type, evidence_size)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                discord,
                age,
                experience,
                motivation,
                evidenceMeta?.originalName || null,
                evidenceMeta?.storedName || null,
                evidenceMeta?.mimeType || null,
                evidenceMeta?.size || null
            ]
        );

        await writeActivityLog(pool, {
            applicationId: result.insertId,
            activityType: 'application_submitted',
            message: 'Neue Bewerbung eingereicht',
            details: {
                discord,
                hasEvidence: Boolean(evidenceMeta)
            }
        });

        res.status(201).json({
            success: true,
            message: 'Bewerbung erfolgreich eingereicht! Das Admin-Team wird sie überprüfen.',
            application: {
                id: result.insertId,
                name,
                discord,
                status: 'pending',
                evidence_url: toPublicEvidenceUrl(evidenceMeta?.storedName),
                created_at: new Date().toISOString()
            }
        });
    } catch (error) {
        if (error?.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Für diesen Discord-Account existiert bereits eine Bewerbung.'
            });
        }

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
        const {
            status,
            search,
            sortBy = 'created_at',
            order = 'DESC',
            page = 1,
            pageSize = 10
        } = req.query;

        const filter = buildApplicationFilterClause({ status, search });
        if (!filter.isValid) {
            return res.status(400).json({
                success: false,
                message: filter.message
            });
        }

        const currentPage = parsePositiveInt(page, 1, 1, 5000);
        const currentPageSize = parsePositiveInt(pageSize, 10, 1, 100);
        const offset = (currentPage - 1) * currentPageSize;
        const { sortColumn, sortDirection } = parseSort(sortBy, order);

        const [countRows] = await pool.execute(
            `SELECT COUNT(*) AS total FROM applications a WHERE ${filter.whereSql}`,
            filter.params
        );

        const totalItems = Number(countRows[0]?.total || 0);
        const totalPages = Math.max(1, Math.ceil(totalItems / currentPageSize));

        const [applications] = await pool.execute(
            `
            SELECT 
                a.id, 
                a.name, 
                a.discord, 
                a.age, 
                a.experience, 
                a.motivation, 
                a.evidence_original_name,
                a.evidence_stored_name,
                a.evidence_mime_type,
                a.evidence_size,
                a.status, 
                a.admin_notes, 
                a.created_at, 
                a.reviewed_at, 
                a.reviewed_by,
                COALESCE(admin.username, 'System') as reviewed_by_admin
            FROM applications a
            LEFT JOIN admins admin ON a.reviewed_by = admin.id
            WHERE ${filter.whereSql}
            ORDER BY ${sortColumn} ${sortDirection}
            LIMIT ? OFFSET ?
            `,
            [...filter.params, currentPageSize, offset]
        );

        res.json({
            success: true,
            count: applications.length,
            total: totalItems,
            pagination: {
                page: currentPage,
                pageSize: currentPageSize,
                totalPages,
                totalItems,
                hasNext: currentPage < totalPages,
                hasPrev: currentPage > 1
            },
            applications: applications.map((application) => ({
                ...application,
                evidence_url: toPublicEvidenceUrl(application.evidence_stored_name)
            }))
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
 * GET /api/applications/export/csv
 * CSV Export der Bewerbungen (nur Admins)
 */
router.get('/export/csv', authMiddleware, requirePermission('applications.read'), async (req, res) => {
    try {
        const pool = getPool();
        const { status, search, sortBy = 'created_at', order = 'DESC' } = req.query;

        const filter = buildApplicationFilterClause({ status, search });
        if (!filter.isValid) {
            return res.status(400).json({
                success: false,
                message: filter.message
            });
        }

        const { sortColumn, sortDirection } = parseSort(sortBy, order);

        const [rows] = await pool.execute(
            `
            SELECT
                a.id,
                a.name,
                a.discord,
                a.age,
                a.status,
                a.created_at,
                a.reviewed_at,
                COALESCE(admin.username, 'System') AS reviewed_by_admin,
                a.admin_notes,
                a.evidence_original_name
            FROM applications a
            LEFT JOIN admins admin ON a.reviewed_by = admin.id
            WHERE ${filter.whereSql}
            ORDER BY ${sortColumn} ${sortDirection}
            LIMIT 5000
            `,
            filter.params
        );

        const header = [
            'ID',
            'Name',
            'Discord',
            'Alter',
            'Status',
            'Erstellt am',
            'Reviewed am',
            'Reviewed von',
            'Admin Notizen',
            'Nachweis Datei'
        ];

        const lines = [header.map(csvEscape).join(',')];
        for (const row of rows) {
            lines.push([
                row.id,
                row.name,
                row.discord,
                row.age,
                row.status,
                row.created_at,
                row.reviewed_at || '',
                row.reviewed_by_admin,
                row.admin_notes || '',
                row.evidence_original_name || ''
            ].map(csvEscape).join(','));
        }

        await writeActivityLog(pool, {
            activityType: 'applications_csv_export',
            message: 'CSV Export erstellt',
            details: { rowCount: rows.length },
            actorId: req.admin.id
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="applications-${Date.now()}.csv"`);
        res.status(200).send(lines.join('\n'));
    } catch (error) {
        console.error('CSV Export Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim CSV Export'
        });
    }
});

/**
 * GET /api/applications/activity
 * Activity Log (nur Admins)
 */
router.get('/activity', authMiddleware, requirePermission('applications.read'), async (req, res) => {
    try {
        const pool = getPool();
        const page = parsePositiveInt(req.query.page, 1, 1, 5000);
        const pageSize = parsePositiveInt(req.query.pageSize, 20, 1, 100);
        const offset = (page - 1) * pageSize;

        const [countRows] = await pool.execute('SELECT COUNT(*) AS total FROM application_activity_log');
        const totalItems = Number(countRows[0]?.total || 0);
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

        const [rows] = await pool.execute(
            `
            SELECT
                log.id,
                log.application_id,
                log.activity_type,
                log.message,
                log.details,
                log.created_at,
                COALESCE(admin.username, 'System') AS actor_username
            FROM application_activity_log log
            LEFT JOIN admins admin ON log.actor_id = admin.id
            ORDER BY log.created_at DESC
            LIMIT ? OFFSET ?
            `,
            [pageSize, offset]
        );

        res.json({
            success: true,
            entries: rows.map((entry) => ({
                ...entry,
                details: entry.details ? JSON.parse(entry.details) : null
            })),
            pagination: {
                page,
                pageSize,
                totalItems,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Activity Log Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen des Activity-Logs'
        });
    }
});

/**
 * GET /api/applications/:id/history
 * Review-Historie einer Bewerbung
 */
router.get('/:id/history', authMiddleware, requirePermission('applications.read'), async (req, res) => {
    try {
        const pool = getPool();
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Ungültige Bewerbungs-ID'
            });
        }

        const [rows] = await pool.execute(
            `
            SELECT
                history.id,
                history.old_status,
                history.new_status,
                history.old_admin_notes,
                history.new_admin_notes,
                history.action_type,
                history.changed_at,
                history.undone_at,
                COALESCE(changer.username, 'System') AS changed_by_admin,
                COALESCE(undoer.username, 'System') AS undone_by_admin
            FROM application_review_history history
            LEFT JOIN admins changer ON history.changed_by = changer.id
            LEFT JOIN admins undoer ON history.undone_by = undoer.id
            WHERE history.application_id = ?
            ORDER BY history.changed_at DESC
            `,
            [id]
        );

        res.json({
            success: true,
            history: rows
        });
    } catch (error) {
        console.error('History Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Historie'
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
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Ungültige Bewerbungs-ID'
            });
        }

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
            application: {
                ...applications[0],
                evidence_url: toPublicEvidenceUrl(applications[0].evidence_stored_name)
            }
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
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
        const id = Number(req.params.id);
        const { status, notes } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Ungültige Bewerbungs-ID'
            });
        }

        // Validiere Status
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status muss "accepted" oder "rejected" sein'
            });
        }

        const sanitizedNotes = typeof notes === 'string' ? notes.trim() : '';
        if (sanitizedNotes.length > 2000) {
            return res.status(400).json({
                success: false,
                message: 'Notizen dürfen maximal 2000 Zeichen lang sein'
            });
        }

        await connection.beginTransaction();

        const [currentRows] = await connection.execute(
            'SELECT id, status, admin_notes FROM applications WHERE id = ? LIMIT 1 FOR UPDATE',
            [id]
        );

        if (currentRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Bewerbung nicht gefunden'
            });
        }

        const current = currentRows[0];

        const [result] = await connection.execute(
            `UPDATE applications 
            SET status = ?, admin_notes = ?, reviewed_at = NOW(), reviewed_by = ?
            WHERE id = ?`,
            [status, sanitizedNotes || null, req.admin.id, id]
        );

        await writeHistoryEntry(connection, {
            applicationId: id,
            oldStatus: current.status,
            newStatus: status,
            oldNotes: current.admin_notes,
            newNotes: sanitizedNotes,
            actionType: 'review',
            changedBy: req.admin.id
        });

        await writeActivityLog(connection, {
            applicationId: id,
            activityType: 'application_reviewed',
            message: `Bewerbung auf ${status} gesetzt`,
            details: {
                oldStatus: current.status,
                newStatus: status,
                notesLength: sanitizedNotes.length
            },
            actorId: req.admin.id
        });

        await connection.commit();

        res.json({
            success: true,
            message: `Bewerbung als ${status === 'accepted' ? 'akzeptiert' : 'abgelehnt'} markiert`,
            status
        });
    } catch (error) {
        await connection.rollback();
        console.error('Update Application Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Aktualisieren der Bewerbung'
        });
    } finally {
        connection.release();
    }
});

/**
 * POST /api/applications/bulk/review
 * Bulk Review mit Notiz
 */
router.post('/bulk/review', authMiddleware, requirePermission('applications.review'), async (req, res) => {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
        const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
        const status = String(req.body.status || '').toLowerCase();
        const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';

        const normalizedIds = [...new Set(ids.map((value) => Number(value)).filter((id) => Number.isInteger(id) && id > 0))];

        if (normalizedIds.length === 0 || normalizedIds.length > 200) {
            return res.status(400).json({
                success: false,
                message: 'Ungültige Bulk-Auswahl'
            });
        }

        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status muss "accepted" oder "rejected" sein'
            });
        }

        if (notes.length > 2000) {
            return res.status(400).json({
                success: false,
                message: 'Bulk-Notiz darf maximal 2000 Zeichen lang sein'
            });
        }

        await connection.beginTransaction();

        const placeholders = normalizedIds.map(() => '?').join(',');
        const [rows] = await connection.execute(
            `SELECT id, status, admin_notes FROM applications WHERE id IN (${placeholders}) FOR UPDATE`,
            normalizedIds
        );

        const byId = new Map(rows.map((row) => [row.id, row]));
        const foundIds = normalizedIds.filter((id) => byId.has(id));

        if (foundIds.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Keine gültigen Bewerbungen gefunden'
            });
        }

        for (const applicationId of foundIds) {
            const current = byId.get(applicationId);

            await connection.execute(
                `UPDATE applications
                 SET status = ?, admin_notes = ?, reviewed_at = NOW(), reviewed_by = ?
                 WHERE id = ?`,
                [status, notes || null, req.admin.id, applicationId]
            );

            await writeHistoryEntry(connection, {
                applicationId,
                oldStatus: current.status,
                newStatus: status,
                oldNotes: current.admin_notes,
                newNotes: notes,
                actionType: 'bulk_review',
                changedBy: req.admin.id
            });
        }

        await writeActivityLog(connection, {
            activityType: 'bulk_review',
            message: `${foundIds.length} Bewerbungen per Bulk auf ${status} gesetzt`,
            details: {
                ids: foundIds,
                notesLength: notes.length
            },
            actorId: req.admin.id
        });

        await connection.commit();

        res.json({
            success: true,
            message: `${foundIds.length} Bewerbungen erfolgreich aktualisiert`,
            updated: foundIds.length,
            status
        });
    } catch (error) {
        await connection.rollback();
        console.error('Bulk Review Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler bei der Bulk-Aktion'
        });
    } finally {
        connection.release();
    }
});

/**
 * DELETE /api/applications/:id
 * Bewerbung löschen (nur Admins)
 */
router.delete('/:id', authMiddleware, requirePermission('applications.delete'), async (req, res) => {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Ungültige Bewerbungs-ID'
            });
        }

        await connection.beginTransaction();

        const [rows] = await connection.execute(
            'SELECT id, name, discord, status FROM applications WHERE id = ? LIMIT 1 FOR UPDATE',
            [id]
        );

        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Bewerbung nicht gefunden'
            });
        }

        const [result] = await connection.execute(
            'DELETE FROM applications WHERE id = ?',
            [id]
        );

        await writeActivityLog(connection, {
            activityType: 'application_deleted',
            message: `Bewerbung ${rows[0].name} gelöscht`,
            details: {
                applicationId: id,
                status: rows[0].status,
                discord: rows[0].discord
            },
            actorId: req.admin.id
        });

        await connection.commit();

        res.json({
            success: true,
            message: 'Bewerbung gelöscht'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Delete Application Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Löschen der Bewerbung'
        });
    } finally {
        connection.release();
    }
});

/**
 * POST /api/applications/:id/undo
 * Letzte Statusänderung rückgängig machen
 */
router.post('/:id/undo', authMiddleware, requirePermission('applications.review'), async (req, res) => {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Ungültige Bewerbungs-ID'
            });
        }

        await connection.beginTransaction();

        const [applicationRows] = await connection.execute(
            'SELECT id, status, admin_notes FROM applications WHERE id = ? LIMIT 1 FOR UPDATE',
            [id]
        );

        if (applicationRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Bewerbung nicht gefunden'
            });
        }

        const [historyRows] = await connection.execute(
            `
            SELECT id, old_status, new_status, old_admin_notes, new_admin_notes
            FROM application_review_history
            WHERE application_id = ?
              AND undone_at IS NULL
              AND action_type IN ('review', 'bulk_review')
            ORDER BY changed_at DESC
            LIMIT 1
            FOR UPDATE
            `,
            [id]
        );

        if (historyRows.length === 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: 'Keine rückgängig zu machende Änderung gefunden'
            });
        }

        const history = historyRows[0];
        const current = applicationRows[0];

        if (current.status !== history.new_status) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: 'Status wurde seit der letzten Änderung bereits erneut angepasst'
            });
        }

        await connection.execute(
            `
            UPDATE applications
            SET status = ?, admin_notes = ?, reviewed_at = NOW(), reviewed_by = ?
            WHERE id = ?
            `,
            [history.old_status, history.old_admin_notes || null, req.admin.id, id]
        );

        await connection.execute(
            `
            UPDATE application_review_history
            SET undone_by = ?, undone_at = NOW()
            WHERE id = ?
            `,
            [req.admin.id, history.id]
        );

        await writeHistoryEntry(connection, {
            applicationId: id,
            oldStatus: current.status,
            newStatus: history.old_status,
            oldNotes: current.admin_notes,
            newNotes: history.old_admin_notes,
            actionType: 'undo',
            changedBy: req.admin.id
        });

        await writeActivityLog(connection, {
            applicationId: id,
            activityType: 'application_review_undo',
            message: `Status auf ${history.old_status} zurückgesetzt`,
            details: {
                from: current.status,
                to: history.old_status,
                undoneHistoryId: history.id
            },
            actorId: req.admin.id
        });

        await connection.commit();

        res.json({
            success: true,
            message: `Status erfolgreich auf ${history.old_status} zurückgesetzt`,
            status: history.old_status
        });
    } catch (error) {
        await connection.rollback();
        console.error('Undo Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Rückgängigmachen der Statusänderung'
        });
    } finally {
        connection.release();
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
