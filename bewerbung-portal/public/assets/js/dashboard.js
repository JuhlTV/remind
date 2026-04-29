/**
 * Admin Dashboard Handler
 */

let currentFilter = 'all';
let currentApplication = null;
let currentAdmin = null;
let availableRoles = [];
let roleMatrix = null;
let applicationsLoadSeq = 0;
let currentSearchTerm = '';
let allApplications = [];

// Check if authenticated
window.addEventListener('load', async () => {
    if (!api.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const me = await api.getMe();
        currentAdmin = me.admin;
        localStorage.setItem('admin', JSON.stringify(currentAdmin));

        const badge = document.getElementById('adminBadge');
        if (badge) {
            badge.textContent = `Angemeldet als ${currentAdmin.username} (${currentAdmin.role})`;
        }

        const dashboardAccountStatus = document.getElementById('dashboardAccountStatus');
        if (dashboardAccountStatus) {
            dashboardAccountStatus.textContent = `${currentAdmin.username} ist mit Rolle ${currentAdmin.role} angemeldet.`;
        }

        setupRoleBasedUI();

        const startupTasks = [];

        if (hasPermission('stats.read')) {
            startupTasks.push(loadStats());
        }

        if (hasPermission('applications.read')) {
            startupTasks.push(loadApplications());
        }

        startupTasks.push(
            loadRoles().then(async () => {
                if (hasPermission('admins.read')) {
                    await loadAdmins();
                }
            })
        );

        await Promise.all(startupTasks);
    } catch (error) {
        console.error('Initialisierungsfehler:', error);
        api.logout();
        window.location.href = 'login.html';
    }
});

/**
 * Logout Handler
 */
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Möchtest du dich wirklich abmelden?')) {
        api.logout();
        window.location.href = 'login.html';
    }
});

document.getElementById('createAdminForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!hasPermission('admins.create')) return;

    const username = document.getElementById('newAdminUsername').value.trim();
    const password = document.getElementById('newAdminPassword').value;
    const email = document.getElementById('newAdminEmail').value.trim();
    const role = document.getElementById('newAdminRole').value;

    const feedback = document.getElementById('adminFormFeedback');

    try {
        const response = await api.createAdmin({
            username,
            password,
            role,
            email: email || null
        });

        feedback.innerHTML = `<div class="alert alert-success">✅ ${escapeHtml(response.message)}</div>`;
        event.target.reset();
        await loadAdmins();
    } catch (error) {
        feedback.innerHTML = `<div class="alert alert-danger">❌ ${escapeHtml(error.message || 'Fehler beim Erstellen des Admins')}</div>`;
    }
});

document.getElementById('refreshDashboardBtn')?.addEventListener('click', async () => {
    await Promise.all([loadStats(), loadApplications(), loadAdmins()]);
});

document.getElementById('refreshApplicationsBtn')?.addEventListener('click', async () => {
    await loadApplications();
});

document.getElementById('applicationSearch')?.addEventListener('input', (event) => {
    currentSearchTerm = event.target.value.trim().toLowerCase();
    renderApplications();
});

function hasPermission(permission) {
    return currentAdmin?.permissions?.includes(permission);
}

function setupRoleBasedUI() {
    const adminNav = document.getElementById('adminManagementNav');
    if (adminNav) {
        const canOpenAdminSection =
            hasPermission('admins.read') ||
            hasPermission('admins.create') ||
            hasPermission('admins.assign_roles');
        adminNav.style.display = canOpenAdminSection ? 'block' : 'none';
    }

    // Hide application controls for users without application visibility
    if (!hasPermission('applications.read')) {
        const appsNav = document.querySelector('[data-section="applications"]');
        const filterSection = document.querySelector('.sidebar-section:nth-of-type(2)');
        if (appsNav) appsNav.style.display = 'none';
        if (filterSection) filterSection.style.display = 'none';
    }

    // Hide stats cards for users without stats permission
    if (!hasPermission('stats.read')) {
        const statsContainer = document.getElementById('statsContainer');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="card">
                    <p style="color: var(--text-muted);">Keine Berechtigung für Statistiken.</p>
                </div>
            `;
        }
    }

    const createAdminForm = document.getElementById('createAdminForm');
    if (createAdminForm && !hasPermission('admins.create')) {
        createAdminForm.parentElement.style.display = 'none';
    }

    const adminsTableBody = document.getElementById('adminsTableBody');
    if (adminsTableBody && !hasPermission('admins.read')) {
        adminsTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted);">
                    Keine Berechtigung zum Anzeigen von Admins.
                </td>
            </tr>
        `;
    }
}

async function loadRoles() {
    try {
        const response = await api.getRoles();
        availableRoles = response.roles || [];
        roleMatrix = response.matrix || null;

        const roleSelect = document.getElementById('newAdminRole');
        if (roleSelect) {
            roleSelect.innerHTML = availableRoles
                .filter(role => canAssignRole(role.key))
                .map(role => `<option value="${role.key}">${escapeHtml(role.label)} (${role.key})</option>`)
                .join('');
        }

        renderRoleMatrix();
    } catch (error) {
        console.error('Rollen laden Fehler:', error);
    }
}

async function loadAdmins() {
    if (!hasPermission('admins.read')) return;

    const tableBody = document.getElementById('adminsTableBody');
    if (!tableBody) return;

    try {
        const response = await api.getAdmins();
        const admins = response.admins || [];

        if (admins.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-muted);">Keine Admins gefunden</td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = admins.map(admin => {
            const roleOptions = availableRoles
                .filter(role => canAssignRole(role.key))
                .map(role => `
                    <option value="${role.key}" ${role.key === admin.role ? 'selected' : ''}>
                        ${escapeHtml(role.label)} (${role.key})
                    </option>
                `)
                .join('');

            const permissions = Array.isArray(admin.permissions) && admin.permissions.length > 0
                ? admin.permissions.map(formatPermissionLabel).join(', ')
                : '-';

            const disableRoleChange =
                admin.id === currentAdmin.id ||
                !hasPermission('admins.assign_roles') ||
                !canAssignRole(admin.role)
                    ? 'disabled'
                    : '';

            return `
                <tr>
                    <td><strong>${escapeHtml(admin.username)}</strong>${admin.id === currentAdmin.id ? ' (du)' : ''}</td>
                    <td>
                        <select id="role-select-${admin.id}" ${disableRoleChange}>
                            ${roleOptions}
                        </select>
                    </td>
                    <td style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(permissions)}</td>
                    <td>${formatDate(admin.created_at)}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="changeAdminRole(${admin.id})" ${disableRoleChange}>
                            Rolle speichern
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--danger-color);">Fehler beim Laden der Admins</td>
            </tr>
        `;
    }
}

async function changeAdminRole(adminId) {
    if (!hasPermission('admins.assign_roles')) return;

    const select = document.getElementById(`role-select-${adminId}`);
    if (!select) return;

    try {
        await api.updateAdminRole(adminId, select.value);
        await loadAdmins();
        alert('✅ Rolle aktualisiert');
    } catch (error) {
        alert(error.message || 'Fehler beim Aktualisieren der Rolle');
    }
}

/**
 * Lade Statistiken
 */
async function loadStats() {
    if (!hasPermission('stats.read')) return;

    try {
        const response = await api.getStats();

        if (!response.success) {
            console.error('Fehler beim Laden der Stats:', response);
            return;
        }

        const { stats } = response;
        const container = document.getElementById('statsContainer');

        if (container) {
            container.innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${stats.total || 0}</div>
                    <div class="stat-label">Gesamt Bewerbungen</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.pending || 0}</div>
                    <div class="stat-label">Ausstehend</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.accepted || 0}</div>
                    <div class="stat-label">Akzeptiert</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.rejected || 0}</div>
                    <div class="stat-label">Abgelehnt</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Stats Fehler:', error);
    }
}

/**
 * Lade Bewerbungen
 */
async function loadApplications() {
    const loadSeq = ++applicationsLoadSeq;

    if (!hasPermission('applications.read')) {
        const tbody = document.getElementById('applicationsTableBody');
        const recent = document.getElementById('recentApplicationsContainer');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
                        Keine Berechtigung zum Anzeigen von Bewerbungen.
                    </td>
                </tr>
            `;
        }
        if (recent) {
            recent.innerHTML = `<p style="color: var(--text-muted);">Keine Berechtigung.</p>`;
        }
        return;
    }

    try {
        const filters = currentFilter !== 'all' ? { status: currentFilter } : {};
        const response = await api.getApplications(filters);

        if (loadSeq !== applicationsLoadSeq) {
            return;
        }

        if (!response.success) {
            console.error('Fehler beim Laden der Bewerbungen:', response);
            return;
        }

        allApplications = response.applications || [];
        renderApplications();
    } catch (error) {
        console.error('Applications Fehler:', error);
    }
}

function getVisibleApplications() {
    if (!Array.isArray(allApplications)) return [];

    return allApplications.filter((app) => {
        const haystack = `${app.name || ''} ${app.discord || ''}`.toLowerCase();
        return !currentSearchTerm || haystack.includes(currentSearchTerm);
    });
}

function renderApplications() {
    const visibleApplications = getVisibleApplications();
    updateApplicationsTable(visibleApplications);
    updateRecentApplications(visibleApplications);
}

/**
 * Update Bewerbungen Tabelle
 */
function updateApplicationsTable(applications) {
    const tbody = document.getElementById('applicationsTableBody');

    if (!applications || applications.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    Keine Bewerbungen für den aktuellen Filter oder die aktuelle Suche gefunden.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = applications.map(app => `
        <tr onclick="openApplicationDetail('${app.id}')">
            <td><strong>${escapeHtml(app.name)}</strong></td>
            <td>${escapeHtml(app.discord)}</td>
            <td>${app.age}</td>
            <td>
                <span class="status-badge ${app.status}">
                    ${getStatusLabel(app.status)}
                </span>
            </td>
            <td>${formatDate(app.created_at)}</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openApplicationDetail('${app.id}')">
                    Details
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Update Letzte Bewerbungen
 */
function updateRecentApplications(applications) {
    const container = document.getElementById('recentApplicationsContainer');

    const recent = applications.slice(0, 5);

    if (!recent || recent.length === 0) {
        container.innerHTML = `
            <div class="card">
                <p style="text-align: center; color: var(--text-muted);">Noch keine passenden Bewerbungen</p>
            </div>
        `;
        return;
    }

    container.innerHTML = recent.map(app => `
        <div class="card" style="margin-bottom: 16px; cursor: pointer;" onclick="openApplicationDetail('${app.id}')">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <h4 style="margin: 0 0 4px 0;">${escapeHtml(app.name)}</h4>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin: 4px 0;">
                        ${escapeHtml(app.discord)} • ${app.age} Jahre
                    </p>
                </div>
                <span class="status-badge ${app.status}">
                    ${getStatusLabel(app.status)}
                </span>
            </div>
            <p style="margin-top: 12px; font-size: 0.9rem; color: var(--text-secondary); max-height: 60px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                ${escapeHtml(app.motivation)}
            </p>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;">
                ${formatDate(app.created_at)}
            </p>
        </div>
    `).join('');
}

/**
 * Öffne Bewerbungsdetails Modal
 */
async function openApplicationDetail(id) {
    try {
        const response = await api.getApplication(id);

        if (!response.success) {
            alert('Fehler beim Laden der Bewerbung');
            return;
        }

        const app = response.application;
        currentApplication = app;

        const modal = document.getElementById('detailModal');
        const modalInfo = document.getElementById('modalInfo');

        const reviewedInfo = app.reviewed_by
            ? `<p style="margin-top: 12px; font-size: 0.85rem; color: var(--text-muted);">
                Bewertet von: <strong>${escapeHtml(app.reviewed_by_admin)}</strong> am ${formatDateTime(app.reviewed_at)}
              </p>`
            : '';

        const adminNotes = app.admin_notes
            ? `<div class="modal-info" style="margin-top: 16px; background: rgba(249, 171, 0, 0.06); border-left-color: #f9ab00;">
                <strong style="color: #f9ab00;">Admin Notizen:</strong>
                <p style="margin-top: 8px;">${escapeHtml(app.admin_notes)}</p>
              </div>`
            : '';

        modalInfo.innerHTML = `
            <div class="modal-info">
                <div class="modal-info-row">
                    <span class="modal-info-label">Name:</span>
                    <span>${escapeHtml(app.name)}</span>
                </div>
                <div class="modal-info-row">
                    <span class="modal-info-label">Discord:</span>
                    <span>${escapeHtml(app.discord)}</span>
                </div>
                <div class="modal-info-row">
                    <span class="modal-info-label">Alter:</span>
                    <span>${app.age} Jahre</span>
                </div>
                <div class="modal-info-row">
                    <span class="modal-info-label">Status:</span>
                    <span>
                        <span class="status-badge ${app.status}">
                            ${getStatusLabel(app.status)}
                        </span>
                    </span>
                </div>
            </div>

            <div style="margin: 24px 0;">
                <h4 style="margin-bottom: 8px;">RP Erfahrung:</h4>
                <p style="color: var(--text-secondary); white-space: pre-wrap; line-height: 1.6;">
                    ${escapeHtml(app.experience)}
                </p>
            </div>

            <div style="margin: 24px 0;">
                <h4 style="margin-bottom: 8px;">Motivation:</h4>
                <p style="color: var(--text-secondary); white-space: pre-wrap; line-height: 1.6;">
                    ${escapeHtml(app.motivation)}
                </p>
            </div>

            ${adminNotes}
            ${reviewedInfo}
        `;

        modal.classList.add('active');
    } catch (error) {
        console.error('Detail Fehler:', error);
        alert('Fehler beim Laden der Bewerbung');
    }
}

/**
 * Bewerte Bewerbung
 */
async function reviewApplication(status) {
    if (!currentApplication) return;
    if (!hasPermission('applications.review')) {
        alert('Keine Berechtigung, Bewerbungen zu bewerten.');
        return;
    }

    const notesField = document.getElementById('reviewNotes');
    const notes = notesField ? notesField.value.trim() : '';

    try {
        const response = await api.reviewApplication(
            currentApplication.id,
            status,
            notes
        );

        if (response.success) {
            alert(`✅ Bewerbung als ${status === 'accepted' ? 'akzeptiert' : 'abgelehnt'} markiert`);
            closeModal();
            await loadApplications();
            await loadStats();
        } else {
            alert('Fehler beim Aktualisieren der Bewerbung');
        }
    } catch (error) {
        console.error('Review Fehler:', error);
        alert('Fehler beim Aktualisieren der Bewerbung');
    }
}

/**
 * Schließe Detail Modal
 */
function closeModal() {
    const modal = document.getElementById('detailModal');
    modal.classList.remove('active');
    const notesField = document.getElementById('reviewNotes');
    if (notesField) {
        notesField.value = '';
    }
    currentApplication = null;
}

/**
 * Filtere nach Status
 */
function filterByStatus(status, event) {
    currentFilter = status;
    loadApplications();

    // Update aktive Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event?.target) {
        event.target.classList.add('active');
    }

    // Update aktive Nav Items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.filter === status) {
            item.classList.add('active');
        }
    });
}

/**
 * Zeige Section
 */
function showSection(section, event) {
    document.querySelectorAll('.section').forEach(el => {
        el.style.display = 'none';
    });
    document.getElementById(section).style.display = 'block';

    // Update aktive Nav Item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = event?.target || document.querySelector(`.nav-item[data-section="${section}"]`);
    activeItem?.classList.add('active');

    // Reset Filter
    currentFilter = 'all';
    if (section === 'overview' || section === 'applications') {
        loadApplications();
    }

    if (section === 'admins' && hasPermission('admins.read')) {
        loadAdmins();
    }
}

function formatPermissionLabel(permission) {
    const labels = {
        'applications.read': 'Bewerbungen lesen',
        'applications.review': 'Bewerbungen bewerten',
        'applications.delete': 'Bewerbungen loeschen',
        'stats.read': 'Statistiken sehen',
        'admins.read': 'Admins einsehen',
        'admins.create': 'Admins erstellen',
        'admins.assign_roles': 'Rollen zuweisen'
    };

    return labels[permission] || permission;
}

function canAssignRole(targetRole) {
    const roleRanks = {
        website_owner: 100,
        projektleitung: 80,
        hr_manager: 60,
        reviewer: 40,
        analyst: 30,
        observer: 20,
        support: 10
    };

    if (!currentAdmin?.role) return false;
    if (currentAdmin.role === 'website_owner') return true;

    return (roleRanks[currentAdmin.role] || 0) > (roleRanks[targetRole] || 0);
}

function renderRoleMatrix() {
    const headRow = document.getElementById('rolesMatrixHeadRow');
    const body = document.getElementById('rolesMatrixBody');
    if (!headRow || !body || !roleMatrix) return;

    headRow.innerHTML = '<th>Rolle</th>' + roleMatrix.permissions
        .map(permission => `<th>${escapeHtml(permission.label)}</th>`)
        .join('');

    body.innerHTML = roleMatrix.roles.map(role => {
        const cells = roleMatrix.permissions.map(permission => {
            const enabled = role.permissions.includes(permission.key);
            return `<td style="text-align: center; font-size: 1.1rem;">${enabled ? '✅' : '—'}</td>`;
        }).join('');

        const highlight = role.key === currentAdmin?.role ? ' style="font-weight: 700;"' : '';

        return `
            <tr${highlight}>
                <td>${escapeHtml(role.label)} <span style="color: var(--text-muted);">(${role.key})</span></td>
                ${cells}
            </tr>
        `;
    }).join('');
}

/**
 * Utility: Format Datum
 */
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Utility: Format DateTime
 */
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Utility: Status Label
 */
function getStatusLabel(status) {
    const labels = {
        'pending': '⏳ Ausstehend',
        'accepted': '✅ Akzeptiert',
        'rejected': '❌ Abgelehnt'
    };
    return labels[status] || status;
}

/**
 * Utility: HTML Escape
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Close Modal on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

document.getElementById('detailModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'detailModal') {
        closeModal();
    }
});
