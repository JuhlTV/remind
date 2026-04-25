/**
 * Debug logging utility - only logs when heat_debug flag is set
 * @param {...any} args - Arguments to log
 */
const ultraDebugLog = (...args) => {
  if (window.localStorage.getItem('heat_debug') === '1') {
    console.debug('[LSPD-HEAT]', new Date().toISOString(), ...args);
  }
};

/**
 * Safely escapes HTML special characters to prevent XSS
 * @param {any} value - Value to escape
 * @returns {string} Escaped HTML-safe string
 */
function escapeHtml(value) {
  const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(value ?? '').replace(/[&<>"']/g, char => htmlEscapeMap[char]);
}

/**
 * Formats a page name into a readable label
 * @param {string} page - Page name/identifier
 * @returns {string} Formatted readable label
 */
function formatPageLabel(page) {
  if (!page) return 'Übersicht';
  return String(page)
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Sets the application theme
 * @param {string} mode - Theme mode ('light' or 'dark')
 */
function setTheme(mode) {
  const isLight = mode === 'light';
  document.body.classList.toggle('light', isLight);
  try {
    window.localStorage.setItem('heat_theme', isLight ? 'light' : 'dark');
  } catch (error) {
    ultraDebugLog('[ERROR] Failed to save theme preference:', error);
  }
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.textContent = isLight ? 'Tagmodus' : 'Nachtmodus';
  }
}

/**
 * Initializes theme toggle button
 */
function initThemeToggle() {
  const savedTheme = window.localStorage.getItem('heat_theme') || 'dark';
  setTheme(savedTheme);
  const toggle = document.getElementById('theme-toggle');
  if (!toggle || toggle.dataset.bound === '1') return;
  toggle.dataset.bound = '1';
  toggle.addEventListener('click', () => {
    setTheme(document.body.classList.contains('light') ? 'dark' : 'light');
  });
}

function createHeaderActionArea() {
  const header = document.getElementById('header');
  if (!header) return null;
  let actions = document.getElementById('header-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.id = 'header-actions';
    actions.className = 'header-actions';
    header.appendChild(actions);
  }
  return actions;
}

/**
 * Returns appropriate CSS class for status badge
 * @param {string} status - Status value
 * @returns {string} CSS class for status styling
 */
function statusClass(status) {
  const value = String(status || '').toLowerCase().trim();
  const acceptedStatuses = ['angenommen', 'freigegeben', 'aktiv', 'abgeschlossen', 'gueltig'];
  const rejectedStatuses = ['abgelehnt', 'verlaengert', 'gesperrt', 'archiviert', 'abgelaufen'];
  const reviewStatuses = ['in review', 'rueckfrage'];
  
  if (acceptedStatuses.includes(value)) return 'status-badge status-accepted';
  if (rejectedStatuses.includes(value)) return 'status-badge status-rejected';
  if (reviewStatuses.includes(value)) return 'status-badge status-open';
  return 'status-badge status-open';
}

/**
 * Checks if record matches search query across specified fields
 * @param {Object} record - Object to search
 * @param {Array<string>} fields - Field names to search
 * @param {string} search - Search query
 * @returns {boolean} True if matches
 */
function matchesSearch(record, fields, search) {
  if (!search || !fields || !record) return true;
  const query = String(search).toLowerCase().trim();
  if (!query) return true;
  return fields.some(field => String(record[field] || '').toLowerCase().includes(query));
}

function renderOptionList(options, selectedValue) {
  return options.map(option => `<option value="${escapeHtml(option)}" ${option === selectedValue ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('');
}

/**
 * Safely reads and parses JSON from localStorage
 * @param {string} key - Storage key
 * @param {any} fallbackValue - Default value if key not found or invalid
 * @returns {any} Parsed value or fallback
 */
function readStorageJson(key, fallbackValue) {
  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) return fallbackValue;
  try {
    const parsed = JSON.parse(rawValue);
    return parsed;
  } catch (error) {
    ultraDebugLog('[ERROR] Invalid localStorage data for key:', key, error);
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      // Ignore removal errors
    }
    return fallbackValue;
  }
}

const rankOrder = [
  'chief of police',
  'assistant chief',
  'deputy chief',
  'commander',
  'captain',
  'lieutenant',
  'sergeant ii',
  'sergeant i',
  'detective iii',
  'detective ii',
  'detective i',
  'senior lead officer',
  'officer iii+1',
  'officer iii',
  'officer ii',
  'officer i',
  'cadet',
  'trainee'
];

const rankCatalog = [
  'Chief of Police',
  'Assistant Chief',
  'Deputy Chief',
  'Commander',
  'Captain',
  'Lieutenant',
  'Sergeant II',
  'Sergeant I',
  'Detective III',
  'Detective II',
  'Detective I',
  'Officer III+1',
  'Officer III',
  'Officer II',
  'Officer I',
  'Cadet',
  'Trainee'
];

const departmentCatalog = [
  'Command',
  'Patrol',
  'Detective Bureau',
  'Traffic Division',
  'SWAT',
  'Air Support',
  'K9 Unit',
  'Gang Unit',
  'Narcotics & Weapons',
  'Field Training Officer',
  'Personnel',
  'Records',
  'Internal Affairs',
  'Academy'
];

const reportStatusCatalog = ['offen', 'in review', 'rueckfrage', 'freigegeben', 'archiviert'];
const documentStatusCatalog = ['offen', 'in review', 'gueltig', 'abgelaufen', 'archiviert'];

function getRankSortIndex(rank) {
  const normalizedRank = String(rank || '').trim().toLowerCase();
  const directIndex = rankOrder.indexOf(normalizedRank);
  if (directIndex !== -1) return directIndex;
  const partialIndex = rankOrder.findIndex(entry => normalizedRank.includes(entry));
  return partialIndex !== -1 ? partialIndex : rankOrder.length + 1;
}

function sortPersonnelEntries(entries) {
  return [...entries].sort((left, right) => {
    const rankDelta = getRankSortIndex(left.rank) - getRankSortIndex(right.rank);
    if (rankDelta !== 0) return rankDelta;
    const divisionDelta = String(left.division || '').localeCompare(String(right.division || ''), 'de', { sensitivity: 'base' });
    if (divisionDelta !== 0) return divisionDelta;
    return String(left.name || '').localeCompare(String(right.name || ''), 'de', { sensitivity: 'base' });
  });
}

function withSourceIndex(entries) {
  return entries.map((entry, index) => ({ entry, index }));
}

function sortIndexedPersonnelEntries(entries) {
  return [...entries].sort((left, right) => {
    const rankDelta = getRankSortIndex(left.entry.rank) - getRankSortIndex(right.entry.rank);
    if (rankDelta !== 0) return rankDelta;
    const divisionDelta = String(left.entry.division || '').localeCompare(String(right.entry.division || ''), 'de', { sensitivity: 'base' });
    if (divisionDelta !== 0) return divisionDelta;
    return String(left.entry.name || '').localeCompare(String(right.entry.name || ''), 'de', { sensitivity: 'base' });
  });
}

const ACCOUNT_STORAGE_KEY = 'heat_accounts';
const AUDIT_LOG_STORAGE_KEY = 'heat_audit_log';
const BOOTSTRAP_ADMIN_USERNAME = 'admin';
const BOOTSTRAP_ADMIN_PASSWORD = 'heat-command-bootstrap';
const BOOTSTRAP_ADMIN_BADGE = 'BOOT-ADMIN';
const COMMAND_THRESHOLD_INDEX = getRankSortIndex('commander');
const SUPERVISOR_THRESHOLD_INDEX = getRankSortIndex('sergeant i');
const ALL_OPERATIONAL_READ_SCOPES = ['reports-hub', 'patrol', 'incident', 'accident', 'gang', 'contraband', 'swat', 'air', 'k9', 'my-reports', 'documents', 'profile'];
const ALL_OPERATIONAL_WRITE_SCOPES = ['patrol', 'incident', 'accident', 'gang', 'contraband', 'swat', 'air', 'k9', 'documents', 'profile'];
const ALL_READ_SCOPES = [...ALL_OPERATIONAL_READ_SCOPES, 'fto', 'supervisor', 'personal', 'account-admin', 'audit-log'];
const ALL_WRITE_SCOPES = [...ALL_OPERATIONAL_WRITE_SCOPES, 'fto', 'supervisor', 'personal', 'account-admin', 'audit-log'];

/**
 * Normalizes identifiers for consistent comparison
 * @param {any} value - Value to normalize
 * @returns {string} Normalized lowercase identifier
 */
function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email || ''));
}

/**
 * Validates required fields in form data
 * @param {Object} obj - Object with form data
 * @param {Array<string>} requiredFields - Array of field names that are required
 * @returns {Object} {isValid: boolean, errors: Array<string>}
 */
function validateFormFields(obj, requiredFields) {
  const errors = requiredFields.filter(field => !obj[field] || String(obj[field]).trim() === '');
  return {
    isValid: errors.length === 0,
    errors: errors.map(field => `${field} ist erforderlich`)
  };
}

/**
 * Generates a unique account ID
 * @returns {string} Unique account ID
 */
function createAccountId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `acc_${timestamp}_${random}`;
}

/**
 * Loads all managed user accounts from storage
 * @returns {Array} Array of account objects
 */
function loadManagedAccounts() {
  try {
    const stored = readStorageJson(ACCOUNT_STORAGE_KEY, []);
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    ultraDebugLog('[ERROR] Failed to load managed accounts:', error);
    return [];
  }
}

/**
 * Saves managed user accounts to storage
 * @param {Array} accounts - Array of account objects to save
 * @returns {boolean} True if successful
 */
function saveManagedAccounts(accounts) {
  try {
    localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accounts));
    return true;
  } catch (error) {
    ultraDebugLog('[ERROR] Failed to save managed accounts:', error);
    showNotification('Fehler beim Speichern von Konten!', '#ff6b6b');
    return false;
  }
}

/**
 * Loads audit log entries from storage
 * @returns {Array} Array of audit log entries
 */
function loadAuditLog() {
  try {
    const stored = readStorageJson(AUDIT_LOG_STORAGE_KEY, []);
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    ultraDebugLog('[ERROR] Failed to load audit log:', error);
    return [];
  }
}

/**
 * Saves audit log entries to storage
 * @param {Array} entries - Array of audit log entries
 * @returns {boolean} True if successful
 */
function saveAuditLog(entries) {
  try {
    localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (error) {
    ultraDebugLog('[ERROR] Failed to save audit log:', error);
    return false;
  }
}

/**
 * Appends an action to the audit log
 * @param {string} action - Action description
 * @param {Object} details - Additional action details
 */
function appendAuditLog(action, details = {}) {
  try {
    const currentUser = readStorageJson('lspd_user', null);
    const entries = loadAuditLog();
    const entry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      actorName: currentUser?.name || currentUser?.username || 'System',
      actorBadge: currentUser?.dienstnummer || currentUser?.username || 'SYSTEM',
      actorRole: currentUser?.role || 'System',
      action: String(action || 'unknown'),
      details: details || {}
    };
    entries.unshift(entry);
    // Keep only last 500 entries
    saveAuditLog(entries.slice(0, 500));
    ultraDebugLog('Audit log entry added:', action);
  } catch (error) {
    ultraDebugLog('[ERROR] Failed to append audit log:', error);
  }
}

function getDefaultReviewDueDate() {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);
  return dueDate.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return '-';
  return String(value).replace('T', ' ').slice(0, 16);
}

function getReportModuleLabel(page) {
  const labels = {
    'einsatzbericht': 'Einsatzbericht',
    'einsatzbericht erstellen': 'Einsatzbericht',
    'einsatzberichte durchsuchen': 'Einsatzbericht',
    'patrol duty bericht': 'Patrol Duty Bericht',
    'neuer patrol duty bericht': 'Patrol Duty Bericht',
    'unfallbericht': 'Unfallbericht',
    'neuer unfallbericht': 'Unfallbericht',
    'gangmember bericht': 'Gangmember Bericht',
    'neuer gangmember bericht': 'Gangmember Bericht',
    'btm & waffen bericht': 'BTM & Waffen Bericht',
    'neuer btm & waffen bericht': 'BTM & Waffen Bericht',
    'swat einsatzbericht': 'SWAT Einsatzbericht',
    'neuer swat einsatzbericht': 'SWAT Einsatzbericht',
    'air patrol bericht': 'Air Patrol Bericht',
    'neuer air patrol bericht': 'Air Patrol Bericht',
    'k9 duty bericht': 'K9 Duty Bericht',
    'neuer k9 duty bericht': 'K9 Duty Bericht'
  };
  return labels[normalizePage(page)] || formatPageLabel(page);
}

function getReportReference(page, entry) {
  const normalizedPage = normalizePage(page);
  if (normalizedPage.includes('einsatzbericht')) return entry.titel || 'Einsatzbericht';
  if (normalizedPage.includes('patrol')) return `${entry.start || 'PATROL'}_${entry.partner || 'REPORT'}`;
  if (normalizedPage.includes('unfall')) return entry.fallnummer || 'Unfallbericht';
  if (normalizedPage.includes('gangmember')) return entry.alias || 'Gangbericht';
  if (normalizedPage.includes('btm')) return entry.beweisnummer || 'BTM-Bericht';
  if (specialReports[normalizedPage]) return entry.operation || specialReports[normalizedPage].entityLabel;
  return formatPageLabel(page);
}

function getReportSummary(page, entry) {
  const normalizedPage = normalizePage(page);
  if (normalizedPage.includes('einsatzbericht')) return entry.titel || 'Einsatzbericht';
  if (normalizedPage.includes('patrol')) return `Patrol mit ${entry.partner || 'n/a'}`;
  if (normalizedPage.includes('unfall')) return `${entry.ort || 'Ort offen'} / ${entry.schaden || 'Schaden offen'}`;
  if (normalizedPage.includes('gangmember')) return `${entry.alias || 'Alias offen'} / ${entry.gang || 'Gang offen'}`;
  if (normalizedPage.includes('btm')) return `${entry.art || 'Art offen'} / ${entry.ort || 'Ort offen'}`;
  if (specialReports[normalizedPage]) return entry.operation || specialReports[normalizedPage].entityLabel;
  return formatPageLabel(page);
}

function maybeCreateReviewFromReport(page, entry, currentUser) {
  if (!entry.createReviewCase) return false;
  const reportType = getReportModuleLabel(page);
  const reportReference = getReportReference(page, entry);
  const existing = supervisorFaelle.find(review => review.reportType === reportType && review.reportReference === reportReference && review.status !== 'archiviert');
  if (existing) {
    return false;
  }
  supervisorFaelle.push({
    reportType,
    reportReference,
    reportTitle: getReportSummary(page, entry),
    submittedBy: `${currentUser.name || currentUser.username} (${currentUser.dienstnummer || currentUser.username})`,
    reviewer: '',
    priority: 'mittel',
    dueDate: getDefaultReviewDueDate(),
    status: 'offen',
    decisionNotes: 'Automatisch aus Bericht erzeugt.'
  });
  saveSupervisorFaelle();
  appendAuditLog('auto_review_created', { reportType, reportReference, reportTitle: getReportSummary(page, entry) });
  return true;
}

function finalizeReportWorkflow(page, entry, currentUser) {
  const nextEntry = { ...entry };
  nextEntry.status = nextEntry.status || 'offen';
  const shouldCreateReview = Boolean(nextEntry.createReviewCase);
  delete nextEntry.createReviewCase;
  if (shouldCreateReview && maybeCreateReviewFromReport(page, nextEntry, currentUser)) {
    nextEntry.status = 'in review';
  }
  return nextEntry;
}

function renderReviewRequestFields(data = {}) {
  return `
    <div><label>Status<br>
      <select name="status">
        ${reportStatusCatalog.map(status => `<option value="${status}" ${data.status === status ? 'selected' : ''}>${status}</option>`).join('')}
      </select>
    </label></div>
    <div><label class="checkbox-row"><input type="checkbox" name="createReviewCase"> Direkt an Supervisor-Review uebergeben</label></div>
  `;
}

function isLinkedPersonnelEntry(entry) {
  return Boolean(entry?.accountId);
}

function getDerivedPersonnelEntries() {
  const accounts = loadManagedAccounts();
  const linkedRecords = accounts.map(account => {
    const existing = personalEintraege.find(entry => entry.accountId === account.id || normalizeIdentifier(entry.badge) === normalizeIdentifier(account.dienstnummer));
    return {
      accountId: account.id,
      name: account.name,
      badge: account.dienstnummer,
      rank: account.rank,
      division: account.department,
      status: existing?.status || 'aktiv',
      notes: existing?.notes || 'Verknuepftes Benutzerkonto',
      linked: true,
      sourceIndex: existing ? personalEintraege.findIndex(entry => entry.accountId === account.id || normalizeIdentifier(entry.badge) === normalizeIdentifier(account.dienstnummer)) : -1
    };
  });
  const standaloneRecords = personalEintraege
    .map((entry, sourceIndex) => ({ entry, sourceIndex }))
    .filter(({ entry }) => {
      if (entry.accountId && accounts.some(account => account.id === entry.accountId)) return false;
      if (accounts.some(account => normalizeIdentifier(account.dienstnummer) === normalizeIdentifier(entry.badge))) return false;
      return true;
    })
    .map(({ entry, sourceIndex }) => ({ ...entry, linked: false, sourceIndex }));
  return [...linkedRecords, ...standaloneRecords];
}

function renderProfileForm(user) {
  return `
    <form id="profile-form" class="stack-form compact-form">
      <div><label>Name<br><input value="${escapeHtml(user.name || '')}" readonly></label></div>
      <div><label>Dienstnummer<br><input value="${escapeHtml(user.dienstnummer || '')}" readonly></label></div>
      <div><label>Rank<br><input value="${escapeHtml(user.rank || '')}" readonly></label></div>
      <div><label>Department<br><input value="${escapeHtml(user.department || '')}" readonly></label></div>
      <div><label>Aktuelles Passwort<br><input name="currentPassword" type="password" required></label></div>
      <div><label>Neues Passwort<br><input name="newPassword" type="password" required></label></div>
      <div><label>Passwort bestaetigen<br><input name="confirmPassword" type="password" required></label></div>
      <div class="form-error form-feedback"></div>
      <div class="form-success form-feedback"></div>
      <button type="submit" class="primary-button">Passwort aktualisieren</button>
    </form>
  `;
}

function renderAuditLogList() {
  const search = window.auditSearch || '';
  const filtered = loadAuditLog().filter(entry => matchesSearch(entry, ['actorName', 'actorBadge', 'actorRole', 'action'], search) || matchesSearch(entry.details || {}, Object.keys(entry.details || {}), search));
  const rows = filtered.map(entry => `
    <tr>
      <td>${escapeHtml(formatDateTime(entry.timestamp))}</td>
      <td>${escapeHtml(entry.actorName)}</td>
      <td>${escapeHtml(entry.actorBadge)}</td>
      <td>${escapeHtml(entry.action)}</td>
      <td>${escapeHtml(JSON.stringify(entry.details || {}))}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="empty-state">Keine Audit-Eintraege vorhanden.</td></tr>';
  return `
    <div class="search-row">
      <input placeholder="Actor, Badge oder Aktion durchsuchen" value="${escapeHtml(search)}" oninput="window.auditSearch=this.value;renderApp()">
    </div>
    <table>
      <thead><tr><th>Zeit</th><th>Actor</th><th>Badge</th><th>Aktion</th><th>Details</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function isCommandRank(rank) {
  return getRankSortIndex(rank) <= COMMAND_THRESHOLD_INDEX;
}

function isSupervisorRank(rank) {
  return getRankSortIndex(rank) <= SUPERVISOR_THRESHOLD_INDEX;
}

function departmentIncludes(department, values) {
  const normalized = normalizeIdentifier(department);
  return values.some(value => normalized.includes(value));
}

function buildPermissionsForAccount(account) {
  if (isCommandRank(account.rank)) {
    return {
      read: [...ALL_READ_SCOPES],
      write: [...ALL_WRITE_SCOPES]
    };
  }

  const read = new Set(ALL_OPERATIONAL_READ_SCOPES);
  const write = new Set(ALL_OPERATIONAL_WRITE_SCOPES);

  if (departmentIncludes(account.department, ['records', 'personnel', 'personal', 'hr'])) {
    read.add('personal');
    write.add('personal');
  }

  if (departmentIncludes(account.department, ['training', 'fto', 'academy'])) {
    read.add('fto');
    write.add('fto');
  }

  if (isSupervisorRank(account.rank) || departmentIncludes(account.department, ['supervisor', 'internal affairs', 'command'])) {
    read.add('supervisor');
    write.add('supervisor');
    read.add('audit-log');
  }

  return {
    read: [...read],
    write: [...write]
  };
}

function deriveRoleFromAccount(account) {
  if (isCommandRank(account.rank)) return 'Command';
  if (departmentIncludes(account.department, ['records', 'personnel', 'personal', 'hr'])) return 'Personnel';
  if (isSupervisorRank(account.rank)) return 'Supervisor';
  return 'Officer';
}

function buildLabelFromAccount(account) {
  return `${account.rank || 'Officer'} · ${account.department || 'Department'}`;
}

function getBootstrapAdminSession() {
  return {
    accountId: 'bootstrap-admin',
    username: BOOTSTRAP_ADMIN_BADGE,
    name: 'System Administrator',
    dienstnummer: BOOTSTRAP_ADMIN_BADGE,
    rank: 'Commander',
    department: 'Command',
    role: 'Command',
    label: 'Bootstrap Setup',
    permissions: {
      read: [...ALL_READ_SCOPES],
      write: [...ALL_WRITE_SCOPES]
    },
    isBootstrapAdmin: true
  };
}

function hasCommandAccounts(accounts = loadManagedAccounts()) {
  return accounts.some(account => isCommandRank(account.rank));
}

function isUsableCommandAccount(account) {
  return isCommandRank(account?.rank)
    && Boolean(String(account?.dienstnummer || '').trim())
    && Boolean(String(account?.password || '').trim());
}

function hasUsableCommandAccounts(accounts = loadManagedAccounts()) {
  return accounts.some(account => isUsableCommandAccount(account));
}

function getManagedAccountByLogin(login) {
  const normalized = normalizeIdentifier(login);
  return loadManagedAccounts().find(account => {
    return normalizeIdentifier(account.dienstnummer) === normalized
      || normalizeIdentifier(account.name) === normalized;
  }) || null;
}

function getManagedAccountById(accountId) {
  return loadManagedAccounts().find(account => account.id === accountId) || null;
}

function getCommandRecoveryIssues(account) {
  const issues = [];
  if (!String(account?.dienstnummer || '').trim()) issues.push('Dienstnummer fehlt');
  if (!String(account?.password || '').trim()) issues.push('Passwort fehlt');
  if (!String(account?.department || '').trim()) issues.push('Department fehlt');
  return issues;
}

function getCommandRecoveryCandidates(accounts = loadManagedAccounts()) {
  return withSourceIndex(accounts)
    .filter(({ entry }) => isCommandRank(entry.rank) && !isUsableCommandAccount(entry))
    .map(({ entry, index }) => ({
      entry,
      index,
      issues: getCommandRecoveryIssues(entry)
    }));
}

function generateRecoveryDienstnummer(accounts, account) {
  const existingNumbers = new Set(accounts.map(entry => normalizeIdentifier(entry.dienstnummer)));
  const seed = String(account?.id || Date.now()).replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase() || 'ADMIN';
  let candidate = `CMD-${seed}`;
  let suffix = 1;
  while (existingNumbers.has(normalizeIdentifier(candidate))) {
    candidate = `CMD-${seed}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function generateRecoveryPassword() {
  return `heat-reset-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSessionFromAccount(account) {
  const permissions = buildPermissionsForAccount(account);
  const session = {
    accountId: account.id,
    username: account.dienstnummer,
    name: account.name,
    dienstnummer: account.dienstnummer,
    rank: account.rank,
    department: account.department,
    role: deriveRoleFromAccount(account),
    label: buildLabelFromAccount(account),
    permissions,
    isBootstrapAdmin: false
  };
  session.allowedCategories = categories
    .filter(category => {
      if (category.page && userCanReadPage(session, category.page)) return true;
      return (category.children || []).some(child => userCanReadPage(session, child.page));
    })
    .map(category => category.id);
  return session;
}

function authenticateUser(login, password) {
  const managedAccount = getManagedAccountByLogin(login);
  if (managedAccount && managedAccount.password === password) {
    return buildSessionFromAccount(managedAccount);
  }
  const normalizedLogin = normalizeIdentifier(login);
  if (!hasUsableCommandAccounts() && [BOOTSTRAP_ADMIN_USERNAME, normalizeIdentifier(BOOTSTRAP_ADMIN_BADGE)].includes(normalizedLogin) && password === BOOTSTRAP_ADMIN_PASSWORD) {
    return getBootstrapAdminSession();
  }
  return null;
}

const pagePermissions = {
  'berichte': { read: ['reports-hub'] },
  'patrol duty bericht': { read: ['patrol'] },
  'neuer patrol duty bericht': { read: ['patrol'], write: ['patrol'], writeRoute: true },
  'einsatzbericht': { read: ['incident'], write: ['incident'], writeRoute: true },
  'einsatzbericht erstellen': { read: ['incident'], write: ['incident'], writeRoute: true },
  'einsatzberichte durchsuchen': { read: ['incident'] },
  'unfallbericht': { read: ['accident'] },
  'neuer unfallbericht': { read: ['accident'], write: ['accident'], writeRoute: true },
  'gangmember bericht': { read: ['gang'] },
  'neuer gangmember bericht': { read: ['gang'], write: ['gang'], writeRoute: true },
  'btm & waffen bericht': { read: ['contraband'] },
  'neuer btm & waffen bericht': { read: ['contraband'], write: ['contraband'], writeRoute: true },
  'swat einsatzbericht': { read: ['swat'] },
  'neuer swat einsatzbericht': { read: ['swat'], write: ['swat'], writeRoute: true },
  'air patrol bericht': { read: ['air'] },
  'neuer air patrol bericht': { read: ['air'], write: ['air'], writeRoute: true },
  'k9 duty bericht': { read: ['k9'] },
  'neuer k9 duty bericht': { read: ['k9'], write: ['k9'], writeRoute: true },
  'meine berichte': { read: ['my-reports'] },
  'field training officer': { read: ['fto'] },
  'fto uebersicht': { read: ['fto'] },
  'neuer fto eintrag': { read: ['fto'], write: ['fto'], writeRoute: true },
  'supervisor': { read: ['supervisor'] },
  'review queue': { read: ['supervisor'] },
  'neuer supervisor fall': { read: ['supervisor'], write: ['supervisor'], writeRoute: true },
  'personal': { read: ['personal'] },
  'personalakten': { read: ['personal'] },
  'neuer personal eintrag': { read: ['personal'], write: ['personal'], writeRoute: true },
  'accountverwaltung': { read: ['account-admin'] },
  'neuer account': { read: ['account-admin'], write: ['account-admin'], writeRoute: true },
  'mein konto': { read: ['profile'], write: ['profile'], writeRoute: true },
  'audit log': { read: ['audit-log'] },
  'meine unterlagen': { read: ['documents'] },
  'unterlagen uebersicht': { read: ['documents'] },
  'neue unterlage': { read: ['documents'], write: ['documents'], writeRoute: true }
};

const ownershipScopedPages = new Set([
  'patrol duty bericht',
  'neuer patrol duty bericht',
  'einsatzbericht',
  'einsatzbericht erstellen',
  'einsatzberichte durchsuchen',
  'unfallbericht',
  'neuer unfallbericht',
  'gangmember bericht',
  'neuer gangmember bericht',
  'btm & waffen bericht',
  'neuer btm & waffen bericht',
  'swat einsatzbericht',
  'neuer swat einsatzbericht',
  'air patrol bericht',
  'neuer air patrol bericht',
  'k9 duty bericht',
  'neuer k9 duty bericht',
  'meine unterlagen',
  'unterlagen uebersicht',
  'neue unterlage'
]);

function getPagePermissionConfig(page) {
  return pagePermissions[page.toLowerCase()] || { read: [], write: [] };
}

function userHasPermission(user, action, requiredScopes) {
  if (!user || !user.permissions) return false;
  if (!requiredScopes || requiredScopes.length === 0) return true;
  const userScopes = user.permissions[action] || [];
  return requiredScopes.some(scope => userScopes.includes(scope));
}

function userCanReadPage(user, page) {
  const config = getPagePermissionConfig(page);
  return userHasPermission(user, 'read', config?.read);
}

function userCanWritePage(user, page) {
  const config = getPagePermissionConfig(page);
  return userHasPermission(user, 'write', config?.write);
}

function userCanAccessPage(user, page) {
  return userCanReadPage(user, page);
}

function pageRequiresWriteAccess(page) {
  const config = getPagePermissionConfig(page);
  return config?.write && config.write.length > 0;
}

function getDefaultPageForUser(user) {
  const preferredPages = ['berichte', 'einsatzberichte durchsuchen', 'patrol duty bericht', 'meine berichte', 'unterlagen uebersicht'];
  const preferredMatch = preferredPages.find(page => userCanAccessPage(user, page));
  if (preferredMatch) return preferredMatch;
  for (const category of categories) {
    if (category.page && userCanAccessPage(user, category.page)) {
      return category.page;
    }
    const matchingChild = (category.children || []).find(child => userCanAccessPage(user, child.page));
    if (matchingChild) {
      return matchingChild.page;
    }
  }
  return 'berichte';
}

function getEntryOwnershipState(user, page, entry) {
  if (!entry) return 'create';
  const normalizedPage = normalizePage(page);
  if (user?.role !== 'Officer' || !ownershipScopedPages.has(normalizedPage)) {
    return 'manager';
  }
  if (!entry.createdBy) {
    return 'unassigned';
  }
  return entry.createdBy === user.username ? 'own' : 'foreign';
}

function canManageEntry(user, page, entry) {
  if (!userCanWritePage(user, page)) return false;
  if (!entry) return true;
  return ['manager', 'own'].includes(getEntryOwnershipState(user, page, entry));
}

function getCurrentUser() {
  const raw = readStorageJson('lspd_user', null);
  if (!raw) return null;
  if (raw.isBootstrapAdmin) {
    if (hasUsableCommandAccounts()) {
      window.localStorage.removeItem('lspd_user');
      return null;
    }
    return getBootstrapAdminSession();
  }
  const account = loadManagedAccounts().find(entry => entry.id === raw.accountId || normalizeIdentifier(entry.dienstnummer) === normalizeIdentifier(raw.dienstnummer));
  if (!account) {
    window.localStorage.removeItem('lspd_user');
    return null;
  }
  const session = buildSessionFromAccount(account);
  window.localStorage.setItem('lspd_user', JSON.stringify(session));
  return session;
}

function getOperationalReportCount() {
  return einsatzberichte.length
    + unfallBerichte.length
    + gangBerichte.length
    + btmWaffenBerichte.length
    + specialReports['swat einsatzbericht'].entries.length
    + specialReports['air patrol bericht'].entries.length
    + specialReports['k9 duty bericht'].entries.length;
}

function showWriteDenied(page, form = null, entry = null) {
  const user = getCurrentUser();
  const ownershipState = getEntryOwnershipState(user, page, entry);
  const message = ['foreign', 'unassigned'].includes(ownershipState)
    ? 'Officers duerfen nur eigene Berichte und eigene Unterlagen bearbeiten.'
    : 'Schreibrechte fuer diesen Bereich fehlen.';
  if (form) {
    showFormError(form, message);
  }
  showNotification(message, '#ff6b6b');
}

function ensureWriteAccess(page, form = null, entry = null) {
  const user = getCurrentUser();
  if (canManageEntry(user, page, entry)) return true;
  showWriteDenied(page, form, entry);
  return false;
}

function renderPageButton({ page, label, className = 'primary-button', requiresWrite = false }) {
  const user = getCurrentUser();
  if (!userCanReadPage(user, page)) {
    return '';
  }
  if (requiresWrite && !userCanWritePage(user, page)) {
    return '';
  }
  return `<button type="button" class="${className}" onclick="navigate('${page}')">${label}</button>`;
}

function renderEntryActions({ page, entry, editAction, deleteAction }) {
  const user = getCurrentUser();
  const ownershipState = getEntryOwnershipState(user, page, entry);
  if (!canManageEntry(user, page, entry)) {
    if (ownershipState === 'foreign') {
      return '<span class="status-badge status-open">Fremder Eintrag</span>';
    }
    if (ownershipState === 'unassigned') {
      return '<span class="status-badge status-open">Legacy / Nur Ansicht</span>';
    }
    return '<span class="status-badge status-open">Nur Ansicht</span>';
  }
  return `
    <div class="action-group">
      <button class="secondary-button action-button" onclick="${editAction}">Bearbeiten</button>
      <button class="danger-button action-button" onclick="${deleteAction}">Loeschen</button>
    </div>
  `;
}

function renderAccessDenied(page, reason = 'read') {
  const main = document.getElementById('main');
  if (!main) return;
  const detail = reason === 'write'
    ? 'Die Seite ist sichtbar, aber Aenderungen sind fuer deinen Account in diesem Modul nicht freigegeben.'
    : `Der Bereich ${escapeHtml(formatPageLabel(page))} ist fuer deinen aktuellen Account nicht freigeschaltet.`;
  main.innerHTML = renderPageShell({
    kicker: 'Access Restricted',
    title: 'Zugriff verweigert',
    intro: detail,
    body: `
      <div class="console-grid">
        <section class="console-card">
          <h3>Freigabe erforderlich</h3>
          <p>HEAT trennt jetzt Leserechte und Schreibrechte pro Modul. Einige Accounts duerfen Bereiche sehen, aber nicht bearbeiten. Fuer Verwaltungsbereiche wie Supervisor, Personal oder die Accountverwaltung brauchst du zusaetzliche Freigaben.</p>
        </section>
        <section class="console-card">
          <h3>Verfuegbare Logins</h3>
          <p>Benutzer melden sich mit Dienstnummer und Passwort an. Solange noch kein Command-Account existiert, steht zusaetzlich der Bootstrap-Login <b>${BOOTSTRAP_ADMIN_USERNAME}</b> / <b>${BOOTSTRAP_ADMIN_PASSWORD}</b> fuer die Ersteinrichtung bereit.</p>
        </section>
      </div>
      <div class="page-actions">
        ${renderPageButton({ page: 'berichte', label: 'Zu Berichte', className: 'secondary-button' })}
        ${renderPageButton({ page: 'meine unterlagen', label: 'Zu Meine Unterlagen', className: 'secondary-button' })}
      </div>
    `
  });
}

function renderPageShell({ kicker, title, intro = '', actions = '', body = '' }) {
  return `
    <div id="main-content">
      ${kicker ? `<div class="page-kicker">${kicker}</div>` : ''}
      <h2>${title}</h2>
      ${intro ? `<p class="page-intro">${intro}</p>` : ''}
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
      ${body}
    </div>
  `;
}

function renderModuleCard(card) {
  const clickable = card.page ? ' clickable' : '';
  const clickAttr = card.page ? ` onclick="navigate('${card.page}')"` : '';
  return `
    <section class="module-card${clickable}"${clickAttr}>
      <div class="module-eyebrow">${card.eyebrow}</div>
      <div class="module-title">${card.title}</div>
      <p class="module-copy">${card.copy}</p>
      ${card.footer ? `<div class="module-footer">${card.footer}</div>` : ''}
    </section>
  `;
}

function renderModuleGrid(cards) {
  return `<div class="module-grid">${cards.map(renderModuleCard).join('')}</div>`;
}

/**
 * Clears all feedback messages from a form
 * @param {HTMLFormElement} form - Form to clear
 */
function clearFormFeedback(form) {
  if (!form) return;
  const error = form.querySelector('.form-error');
  const success = form.querySelector('.form-success');
  if (error) error.textContent = '';
  if (success) success.textContent = '';
}

/**
 * Shows error message in form feedback element
 * @param {HTMLFormElement} form - Form element
 * @param {string} message - Error message to display
 */
function showFormError(form, message) {
  if (!form) return;
  const error = form.querySelector('.form-error');
  if (error) {
    error.textContent = message;
    error.style.display = 'block';
  }
}

/**
 * Shows success message in form feedback element
 * @param {HTMLFormElement} form - Form element
 * @param {string} message - Success message to display
 */
function showFormSuccess(form, message) {
  if (!form) return;
  const success = form.querySelector('.form-success');
  if (success) {
    success.textContent = message;
    success.style.display = 'block';
  }
}

function renderEinsatzberichtForm(editData = null) {
  const data = editData || { titel: '', zeit: '', typ: '', beschreibung: '', anhang: '', status: 'offen' };
  return renderPageShell({
    kicker: 'Incident Intake',
    title: editData ? 'Einsatzbericht bearbeiten' : 'Einsatzbericht erstellen',
    intro: 'Erfasse operative Vorfaelle, sichere Anhaenge und dokumentiere den Einsatzverlauf in einer konsistenten internen Struktur.',
    actions: `<button type="button" class="secondary-button" onclick="navigate('einsatzberichte durchsuchen')">Berichte durchsuchen</button>`,
    body: `
      <form id="einsatzbericht-form" class="stack-form">
        <div><label>Titel<br><input name="titel" required value="${escapeHtml(data.titel || '')}"></label></div>
        <div><label>Zeitpunkt<br><input name="zeit" type="datetime-local" required value="${escapeHtml(data.zeit || '')}"></label></div>
        <div><label>Einsatztyp<br><input name="typ" required value="${escapeHtml(data.typ || '')}" placeholder="z. B. Traffic Stop, Raid, Pursuit"></label></div>
        ${renderReviewRequestFields(data)}
        <div><label>Beschreibung<br><textarea name="beschreibung" required placeholder="Einsatzverlauf, beteiligte Einheiten, Massnahmen und Ergebnis festhalten.">${escapeHtml(data.beschreibung || '')}</textarea></label></div>
        <div>
          <label>Dateianhang (optional)</label>
          <div id="dropzone" class="dropzone">Hier klicken oder Datei hierher ziehen</div>
          <input id="anhang-input" type="file" hidden>
          <div id="anhang-preview" class="attachment-preview"></div>
        </div>
        <div class="form-error form-feedback"></div>
        <div class="form-success form-feedback"></div>
        <button type="submit" class="primary-button">${editData ? 'Aenderungen speichern' : 'Bericht speichern'}</button>
      </form>
    `
  });
}

// --- Notification System ---
/**
 * Shows a temporary notification to the user
 * @param {string} msg - Message to display
 * @param {string} color - CSS color for notification background
 * @param {number} duration - Duration in ms (default 3200)
 */
function showNotification(msg, color = '#2196f3', duration = 3200) {
  ultraDebugLog('showNotification', msg, color);
  let n = document.getElementById('lspd-notification');
  if (!n) {
    n = document.createElement('div');
    n.id = 'lspd-notification';
    n.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:4px;color:#fff;font-weight:600;z-index:9999;transition:opacity 300ms;';
    document.body.appendChild(n);
  }
  n.textContent = msg;
  n.style.background = color;
  n.style.opacity = '1';
  const timeoutId = setTimeout(() => { n.style.opacity = '0'; }, duration);
  // Allow canceling previous timeout
  if (n.dataset.timeoutId) clearTimeout(Number(n.dataset.timeoutId));
  n.dataset.timeoutId = String(timeoutId);
}
// Dummy-Daten für Patrol Duty Berichte
let patrolBerichte = readStorageJson('patrolBerichte', []);
function savePatrolBerichte() {
    ultraDebugLog('savePatrolBerichte', patrolBerichte);
  localStorage.setItem('patrolBerichte', JSON.stringify(patrolBerichte));
}

function renderPatrolForm(editData = null) {
  const data = editData || { start: '', ende: '', partner: '', festnahmen: '', angriff: 'Nein', notizen: '', status: 'offen' };
  return renderPageShell({
    kicker: 'Patrol Intake',
    title: editData ? 'Patrol Duty Bericht bearbeiten' : 'Patrol Duty Bericht erfassen',
    intro: 'Halte Streifenbeginn, Ende, Partner und besondere Vorkommnisse in einer eigenen Patrol-Akte fest.',
    actions: renderPageButton({ page: 'patrol duty bericht', label: 'Zur Uebersicht', className: 'secondary-button' }),
    body: `
      <form id="patrol-form" class="stack-form compact-form">
        <div><label>Beginn<br><input name="start" type="datetime-local" required value="${escapeHtml(data.start || '')}"></label></div>
        <div><label>Ende<br><input name="ende" type="datetime-local" required value="${escapeHtml(data.ende || '')}"></label></div>
        <div><label>Streifenpartner<br><input name="partner" required value="${escapeHtml(data.partner || '')}"></label></div>
        <div><label>Festnahmen<br><input name="festnahmen" value="${escapeHtml(data.festnahmen || '')}" placeholder="0"></label></div>
        ${renderReviewRequestFields(data)}
        <div><label>Angegriffen<br>
          <select name="angriff">
            <option value="Nein" ${data.angriff === 'Nein' ? 'selected' : ''}>Nein</option>
            <option value="Ja" ${data.angriff === 'Ja' ? 'selected' : ''}>Ja</option>
          </select>
        </label></div>
        <div><label>Notizen<br><textarea name="notizen" placeholder="Streifenverlauf, Kontrollen, Auffaelligkeiten">${escapeHtml(data.notizen || '')}</textarea></label></div>
        <div class="form-error form-feedback"></div>
        <div class="form-success form-feedback"></div>
        <button type="submit" class="primary-button">${editData ? 'Aenderungen speichern' : 'Patrolbericht speichern'}</button>
      </form>
    `
  });
}

function renderPatrolList(filter = {}) {
    ultraDebugLog('renderPatrolList', filter);
  let search = filter.search || '';
  let filtered = withSourceIndex(patrolBerichte);
  if (filter.partner) filtered = filtered.filter(({ entry }) => entry.partner && entry.partner.toLowerCase().includes(filter.partner.toLowerCase()));
  if (filter.von) filtered = filtered.filter(({ entry }) => entry.start >= filter.von);
  if (filter.bis) filtered = filtered.filter(({ entry }) => entry.ende <= filter.bis);
  if (search) {
    filtered = filtered.filter(({ entry }) =>
      (entry.partner && entry.partner.toLowerCase().includes(search.toLowerCase())) ||
      (entry.start && entry.start.toLowerCase().includes(search.toLowerCase())) ||
      (entry.ende && entry.ende.toLowerCase().includes(search.toLowerCase())) ||
      (entry.festnahmen && String(entry.festnahmen).includes(search)) ||
      (entry.angriff && entry.angriff.toLowerCase().includes(search.toLowerCase()))
    );
  }
  let rows = filtered.map(({ entry: b, index }) => `
    <tr>
      <td>${b.start?.replace('T',' ').slice(0,16)||''}</td>
      <td>${b.ende?.replace('T',' ').slice(0,16)||''}</td>
      <td>${b.partner||''}</td>
      <td>${b.festnahmen||''}</td>
      <td>${b.angriff||''}</td>
      <td><span class="${statusClass(b.status)}">${escapeHtml(b.status || 'offen')}</span></td>
      <td>${renderEntryActions({ page: 'patrol duty bericht', entry: b, editAction: `editPatrol(${index})`, deleteAction: `deletePatrol(${index})` })}</td>
    </tr>
  `).join('');
  if(!rows) rows = '<tr><td colspan="7" class="empty-state">Keine Berichte gefunden.</td></tr>';
  return `
    <form id="patrolfilterform" class="filter-form">
      <div><label>Streifenpartner<br><input name="partner"></label></div>
      <div><label>Von<br><input name="von" type="datetime-local"></label></div>
      <div><label>Bis<br><input name="bis" type="datetime-local"></label></div>
      <div class="grow"></div>
      <div><input name="search" placeholder="Suchen..." value="${search||''}" oninput="this.form.dispatchEvent(new Event('submit'))"></div>
      <button type="submit" class="secondary-button">Filtern</button>
    </form>
    <table>
      <thead>
        <tr><th>Beginn</th><th>Ende</th><th>Partner</th><th>Festnahmen</th><th>Angegriffen</th><th>Status</th><th>Aktion</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

window.editPatrol = function(idx) {
    ultraDebugLog('editPatrol', idx);
  if (!ensureWriteAccess('patrol duty bericht', null, patrolBerichte[idx])) return;
  window.localStorage.setItem('lspd_page','neuer patrol duty bericht');
  setTimeout(()=>renderApp(patrolBerichte[idx],idx),10);
}
window.deletePatrol = function(idx) {
    ultraDebugLog('deletePatrol', idx);
  if (!ensureWriteAccess('patrol duty bericht', null, patrolBerichte[idx])) return;
  if(confirm('Diesen Bericht wirklich löschen?')) {
    appendAuditLog('report_deleted', { type: 'Patrol Duty Bericht', reference: getReportReference('patrol duty bericht', patrolBerichte[idx]) });
    patrolBerichte.splice(idx,1);
    savePatrolBerichte();
    renderApp();
  }
}
// Dummy-Daten für Berichte
let einsatzberichte = readStorageJson('einsatzberichte', []);

function saveBerichte() {
    ultraDebugLog('saveBerichte', einsatzberichte);
  localStorage.setItem('einsatzberichte', JSON.stringify(einsatzberichte));
}

function renderBerichteList(filter = {}) {
    ultraDebugLog('renderBerichteList', filter);
  let search = filter.search || '';
  let filtered = withSourceIndex(einsatzberichte);
  if (filter.typ) filtered = filtered.filter(({ entry: b }) => b.typ === filter.typ);
  if (filter.von) filtered = filtered.filter(({ entry: b }) => b.zeit >= filter.von);
  if (filter.bis) filtered = filtered.filter(({ entry: b }) => b.zeit <= filter.bis);
  if (search) {
    filtered = filtered.filter(({ entry: b }) =>
      (b.titel && b.titel.toLowerCase().includes(search.toLowerCase())) ||
      (b.typ && b.typ.toLowerCase().includes(search.toLowerCase())) ||
      (b.zeit && b.zeit.toLowerCase().includes(search.toLowerCase())) ||
      (b.beschreibung && b.beschreibung.toLowerCase().includes(search.toLowerCase()))
    );
  }
  let rows = filtered.map(({ entry: b, index }) => `
    <tr>
      <td>${b.titel}</td>
      <td>${b.typ||''}</td>
      <td>${b.zeit.replace('T',' ').slice(0,16)}</td>
      <td><span class="${statusClass(b.status)}">${escapeHtml(b.status || 'offen')}</span></td>
      <td>${renderEntryActions({ page: 'einsatzberichte durchsuchen', entry: b, editAction: `editBericht(${index})`, deleteAction: `deleteBericht(${index})` })}</td>
    </tr>
  `).join('');
  if(!rows) rows = '<tr><td colspan="5" class="empty-state">Keine Berichte gefunden.</td></tr>';
  return `
    <div class="toolbar">
      <button type="button" class="utility-button" onclick="exportBerichteCSV()">Export CSV</button>
      <button type="button" class="secondary-button" onclick="printBerichteList()">Drucken</button>
    </div>
    <form id="filterform" class="filter-form">
      <div><label>Einsatztyp<br><input name="typ"></label></div>
      <div><label>Von<br><input name="von" type="datetime-local"></label></div>
      <div><label>Bis<br><input name="bis" type="datetime-local"></label></div>
      <div class="grow"></div>
      <div><input name="search" placeholder="Suchen..." value="${search||''}" oninput="this.form.dispatchEvent(new Event('submit'))"></div>
      <button type="submit" class="secondary-button">Filtern</button>
    </form>
    <table id="berichte-table">
      <thead>
        <tr><th>Titel</th><th>Typ</th><th>Datum</th><th>Status</th><th>Aktion</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
// Export Berichte als CSV
window.exportBerichteCSV = function() {
    ultraDebugLog('exportBerichteCSV');
  let csv = 'Titel,Typ,Datum,Beschreibung\n';
  einsatzberichte.forEach(b => {
    csv += `"${(b.titel||'').replace(/"/g,'""')}","${(b.typ||'').replace(/"/g,'""')}","${(b.zeit||'').replace(/"/g,'""')}","${(b.beschreibung||'').replace(/"/g,'""')}"\n`;
  });
  const blob = new Blob([csv], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'einsatzberichte.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Drucken der Berichte-Liste
window.printBerichteList = function() {
    ultraDebugLog('printBerichteList');
  const table = document.getElementById('berichte-table');
  if (!table) return;
  const win = window.open('', '', 'width=900,height=700');
  win.document.write('<html><head><title>Einsatzberichte</title>');
  win.document.write('<style>body{font-family:sans-serif;background:#fff;color:#222;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #888;padding:8px;}th{background:#ffe600;color:#181c23;}tr:nth-child(even){background:#f5f5f5;}</style>');
  win.document.write('</head><body >');
  win.document.write('<h2>Einsatzberichte</h2>');
  win.document.write(table.outerHTML);
  win.document.write('</body></html>');
  win.document.close();
  win.focus();
  win.print();
  win.close();
}
}

let ftoEintraege = readStorageJson('ftoEintraege', []);
function saveFtoEintraege() {
  localStorage.setItem('ftoEintraege', JSON.stringify(ftoEintraege));
}

function renderFtoForm(editData = null) {
  const data = editData || { trainee: '', badge: '', trainer: '', phase: 'Phase 1', reviewDate: '', status: 'offen', notes: '' };
  return `
    <form id="fto-form" class="stack-form compact-form">
      <div><label>Trainee<br><input name="trainee" required value="${escapeHtml(data.trainee || '')}"></label></div>
      <div><label>Badge / Dienstnummer<br><input name="badge" required value="${escapeHtml(data.badge || '')}"></label></div>
      <div><label>Trainer<br><input name="trainer" required value="${escapeHtml(data.trainer || '')}"></label></div>
      <div><label>Phase<br>
        <select name="phase">
          <option value="Phase 1" ${data.phase === 'Phase 1' ? 'selected' : ''}>Phase 1</option>
          <option value="Phase 2" ${data.phase === 'Phase 2' ? 'selected' : ''}>Phase 2</option>
          <option value="Phase 3" ${data.phase === 'Phase 3' ? 'selected' : ''}>Phase 3</option>
          <option value="Shadow" ${data.phase === 'Shadow' ? 'selected' : ''}>Shadow</option>
          <option value="Final" ${data.phase === 'Final' ? 'selected' : ''}>Final</option>
        </select>
      </label></div>
      <div><label>Review-Termin<br><input name="reviewDate" type="date" value="${escapeHtml(data.reviewDate || '')}"></label></div>
      <div><label>Status<br>
        <select name="status">
          <option value="offen" ${data.status === 'offen' ? 'selected' : ''}>offen</option>
          <option value="aktiv" ${data.status === 'aktiv' ? 'selected' : ''}>aktiv</option>
          <option value="freigegeben" ${data.status === 'freigegeben' ? 'selected' : ''}>freigegeben</option>
          <option value="verlaengert" ${data.status === 'verlaengert' ? 'selected' : ''}>verlaengert</option>
        </select>
      </label></div>
      <div><label>Notizen<br><textarea name="notes" placeholder="Bewertung, Defizite, naechste Schritte">${escapeHtml(data.notes || '')}</textarea></label></div>
      <div class="form-error form-feedback"></div>
      <div class="form-success form-feedback"></div>
      <button type="submit" class="primary-button">${editData ? 'Aenderungen speichern' : 'FTO-Eintrag speichern'}</button>
    </form>
  `;
}

function renderFtoList() {
  const search = window.ftoSearch || '';
  const filtered = withSourceIndex(ftoEintraege).filter(({ entry }) => matchesSearch(entry, ['trainee', 'badge', 'trainer', 'phase', 'status', 'notes'], search));
  const rows = filtered.map(({ entry, index }) => `
    <tr>
      <td>${escapeHtml(entry.trainee)}</td>
      <td>${escapeHtml(entry.badge)}</td>
      <td>${escapeHtml(entry.trainer)}</td>
      <td>${escapeHtml(entry.phase)}</td>
      <td><span class="${statusClass(entry.status)}">${escapeHtml(entry.status)}</span></td>
      <td>${escapeHtml(entry.reviewDate || '-')}</td>
      <td>${renderEntryActions({ page: 'fto uebersicht', entry, editAction: `editFto(${index})`, deleteAction: `deleteFto(${index})` })}</td>
    </tr>
  `).join('') || '<tr><td colspan="7" class="empty-state">Keine FTO-Eintraege vorhanden.</td></tr>';
  return `
    <div class="search-row">
      <input placeholder="Trainee, Trainer oder Phase durchsuchen" value="${escapeHtml(search)}" oninput="window.ftoSearch=this.value;renderApp()">
    </div>
    <table>
      <thead>
        <tr><th>Trainee</th><th>Badge</th><th>Trainer</th><th>Phase</th><th>Status</th><th>Review</th><th>Aktion</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

window.editFto = function(index) {
  if (!ensureWriteAccess('fto uebersicht', null, ftoEintraege[index])) return;
  window.localStorage.setItem('lspd_page', 'neuer fto eintrag');
  setTimeout(() => renderApp(ftoEintraege[index], index), 10);
};

window.deleteFto = function(index) {
  if (!ensureWriteAccess('fto uebersicht', null, ftoEintraege[index])) return;
  if (confirm('Diesen FTO-Eintrag wirklich loeschen?')) {
    ftoEintraege.splice(index, 1);
    saveFtoEintraege();
    renderApp();
  }
};

let supervisorFaelle = readStorageJson('supervisorFaelle', []);
function saveSupervisorFaelle() {
  localStorage.setItem('supervisorFaelle', JSON.stringify(supervisorFaelle));
}

function renderSupervisorForm(editData = null) {
  const data = editData || {
    reportType: 'Einsatzbericht',
    reportReference: '',
    reportTitle: '',
    submittedBy: '',
    reviewer: '',
    priority: 'mittel',
    dueDate: '',
    status: 'offen',
    decisionNotes: ''
  };
  return `
    <form id="supervisor-form" class="stack-form compact-form">
      <div><label>Berichtstyp<br>
        <select name="reportType">
          <option value="Einsatzbericht" ${data.reportType === 'Einsatzbericht' ? 'selected' : ''}>Einsatzbericht</option>
          <option value="Patrol Duty Bericht" ${data.reportType === 'Patrol Duty Bericht' ? 'selected' : ''}>Patrol Duty Bericht</option>
          <option value="Unfallbericht" ${data.reportType === 'Unfallbericht' ? 'selected' : ''}>Unfallbericht</option>
          <option value="Gangmember Bericht" ${data.reportType === 'Gangmember Bericht' ? 'selected' : ''}>Gangmember Bericht</option>
          <option value="BTM & Waffen Bericht" ${data.reportType === 'BTM & Waffen Bericht' ? 'selected' : ''}>BTM & Waffen Bericht</option>
          <option value="SWAT Einsatzbericht" ${data.reportType === 'SWAT Einsatzbericht' ? 'selected' : ''}>SWAT Einsatzbericht</option>
          <option value="Air Patrol Bericht" ${data.reportType === 'Air Patrol Bericht' ? 'selected' : ''}>Air Patrol Bericht</option>
          <option value="K9 Duty Bericht" ${data.reportType === 'K9 Duty Bericht' ? 'selected' : ''}>K9 Duty Bericht</option>
        </select>
      </label></div>
      <div><label>Berichtsnummer / Referenz<br><input name="reportReference" required value="${escapeHtml(data.reportReference || '')}" placeholder="z. B. INC-24019"></label></div>
      <div><label>Berichtstitel<br><input name="reportTitle" required value="${escapeHtml(data.reportTitle || '')}" placeholder="Kurzbeschreibung des gemeldeten Vorfalls"></label></div>
      <div><label>Eingereicht von<br><input name="submittedBy" required value="${escapeHtml(data.submittedBy || '')}" placeholder="Officer / Badge"></label></div>
      <div><label>Pruefender Supervisor<br><input name="reviewer" value="${escapeHtml(data.reviewer || '')}" placeholder="Supervisor / Command"></label></div>
      <div><label>Prioritaet<br>
        <select name="priority">
          <option value="niedrig" ${data.priority === 'niedrig' ? 'selected' : ''}>niedrig</option>
          <option value="mittel" ${data.priority === 'mittel' ? 'selected' : ''}>mittel</option>
          <option value="hoch" ${data.priority === 'hoch' ? 'selected' : ''}>hoch</option>
          <option value="kritisch" ${data.priority === 'kritisch' ? 'selected' : ''}>kritisch</option>
        </select>
      </label></div>
      <div><label>Faelligkeit<br><input name="dueDate" type="date" value="${escapeHtml(data.dueDate || '')}"></label></div>
      <div><label>Status<br>
        <select name="status">
          <option value="offen" ${data.status === 'offen' ? 'selected' : ''}>offen</option>
          <option value="aktiv" ${data.status === 'aktiv' ? 'selected' : ''}>aktiv</option>
          <option value="rueckfrage" ${data.status === 'rueckfrage' ? 'selected' : ''}>rueckfrage</option>
          <option value="freigegeben" ${data.status === 'freigegeben' ? 'selected' : ''}>freigegeben</option>
          <option value="abgeschlossen" ${data.status === 'abgeschlossen' ? 'selected' : ''}>abgeschlossen</option>
          <option value="archiviert" ${data.status === 'archiviert' ? 'selected' : ''}>archiviert</option>
        </select>
      </label></div>
      <div><label>Review-Notizen<br><textarea name="decisionNotes" placeholder="Freigabehinweise, Rueckfragen, Korrekturen, Eskalationen">${escapeHtml(data.decisionNotes || data.notes || '')}</textarea></label></div>
      <div class="form-error form-feedback"></div>
      <div class="form-success form-feedback"></div>
      <button type="submit" class="primary-button">${editData ? 'Review aktualisieren' : 'Review-Fall speichern'}</button>
    </form>
  `;
}

function renderSupervisorList() {
  const search = window.supervisorSearch || '';
  const filtered = withSourceIndex(supervisorFaelle).filter(({ entry }) => matchesSearch(entry, ['reportType', 'reportReference', 'reportTitle', 'submittedBy', 'reviewer', 'priority', 'status', 'decisionNotes', 'notes'], search));
  const rows = filtered.map(({ entry, index }) => `
    <tr>
      <td>${escapeHtml(entry.reportType || 'Bericht')}</td>
      <td>${escapeHtml(entry.reportReference || '-')}</td>
      <td>${escapeHtml(entry.reportTitle || entry.title || '-')}</td>
      <td>${escapeHtml(entry.submittedBy || entry.owner || '-')}</td>
      <td>${escapeHtml(entry.reviewer || '-')}</td>
      <td>${escapeHtml(entry.priority)}</td>
      <td>${escapeHtml(entry.dueDate || '-')}</td>
      <td><span class="${statusClass(entry.status)}">${escapeHtml(entry.status)}</span></td>
      <td>${renderEntryActions({ page: 'review queue', entry, editAction: `editSupervisor(${index})`, deleteAction: `deleteSupervisor(${index})` })}</td>
    </tr>
  `).join('') || '<tr><td colspan="9" class="empty-state">Keine Review-Faelle vorhanden.</td></tr>';
  return `
    <div class="search-row">
      <input placeholder="Berichtstyp, Referenz, Officer oder Supervisor durchsuchen" value="${escapeHtml(search)}" oninput="window.supervisorSearch=this.value;renderApp()">
    </div>
    <table>
      <thead>
        <tr><th>Typ</th><th>Referenz</th><th>Titel</th><th>Eingereicht von</th><th>Supervisor</th><th>Prioritaet</th><th>Faellig</th><th>Status</th><th>Aktion</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

window.editSupervisor = function(index) {
  if (!ensureWriteAccess('review queue', null, supervisorFaelle[index])) return;
  window.localStorage.setItem('lspd_page', 'neuer supervisor fall');
  setTimeout(() => renderApp(supervisorFaelle[index], index), 10);
};

window.deleteSupervisor = function(index) {
  if (!ensureWriteAccess('review queue', null, supervisorFaelle[index])) return;
  if (confirm('Diesen Supervisor-Fall wirklich loeschen?')) {
    appendAuditLog('review_deleted', {
      type: supervisorFaelle[index].reportType || 'Review-Fall',
      reference: supervisorFaelle[index].reportReference || '-'
    });
    supervisorFaelle.splice(index, 1);
    saveSupervisorFaelle();
    renderApp();
  }
};

let personalEintraege = readStorageJson('personalEintraege', []);
function savePersonalEintraege() {
  localStorage.setItem('personalEintraege', JSON.stringify(personalEintraege));
}

function getManagedAccountsWithIndex(search = '') {
  const indexedAccounts = withSourceIndex(loadManagedAccounts()).filter(({ entry }) => {
    return matchesSearch(entry, ['name', 'dienstnummer', 'rank', 'department'], search);
  });
  return [...indexedAccounts].sort((left, right) => {
    const rankDelta = getRankSortIndex(left.entry.rank) - getRankSortIndex(right.entry.rank);
    if (rankDelta !== 0) return rankDelta;
    const departmentDelta = String(left.entry.department || '').localeCompare(String(right.entry.department || ''), 'de', { sensitivity: 'base' });
    if (departmentDelta !== 0) return departmentDelta;
    return String(left.entry.name || '').localeCompare(String(right.entry.name || ''), 'de', { sensitivity: 'base' });
  });
}

function getCommandAccountCount(accounts = loadManagedAccounts()) {
  return accounts.filter(account => isCommandRank(account.rank)).length;
}

function ensureAccountAdmin(form = null) {
  if (userCanWritePage(getCurrentUser(), 'accountverwaltung')) return true;
  showWriteDenied('accountverwaltung', form);
  return false;
}

function upsertPersonnelFromAccount(account, previousBadge = null) {
  const lookupBadge = previousBadge || account.dienstnummer;
  const existingIndex = personalEintraege.findIndex(entry => normalizeIdentifier(entry.badge) === normalizeIdentifier(lookupBadge));
  const existing = existingIndex !== -1 ? personalEintraege[existingIndex] : null;
  const record = {
    accountId: account.id,
    name: account.name,
    badge: account.dienstnummer,
    rank: account.rank,
    division: account.department,
    status: existing?.status && existing.status !== 'archiviert' ? existing.status : 'aktiv',
    notes: existing?.notes || 'Verknuepftes Benutzerkonto'
  };
  if (existingIndex !== -1) {
    personalEintraege[existingIndex] = { ...existing, ...record };
  } else {
    personalEintraege.push(record);
  }
  savePersonalEintraege();
}

function archivePersonnelForAccount(account) {
  const existingIndex = personalEintraege.findIndex(entry => normalizeIdentifier(entry.badge) === normalizeIdentifier(account.dienstnummer));
  if (existingIndex === -1) return;
  const existing = personalEintraege[existingIndex];
  personalEintraege[existingIndex] = {
    ...existing,
    status: 'archiviert',
    notes: existing.notes ? `${existing.notes} | Benutzerkonto geloescht` : 'Benutzerkonto geloescht'
  };
  savePersonalEintraege();
}

function renderAccountRecoveryPanel() {
  const currentUser = getCurrentUser();
  if (!currentUser?.isBootstrapAdmin) return '';
  const recoveryCandidates = getCommandRecoveryCandidates();
  const latestRecovery = window.commandRecoveryResult;
  const latestRecoveryMarkup = latestRecovery ? `
    <div class="form-success form-feedback" style="display:block; margin: 0 0 16px 0;">
      Recovery abgeschlossen fuer <b>${escapeHtml(latestRecovery.name || latestRecovery.accountId)}</b>.
      Login: <b>${escapeHtml(latestRecovery.dienstnummer)}</b>.
      Temp Passwort: <b>${escapeHtml(latestRecovery.password)}</b>
    </div>
  ` : '';
  if (!recoveryCandidates.length) {
    return latestRecoveryMarkup;
  }
  const rows = recoveryCandidates.map(({ entry, index, issues }) => `
    <tr>
      <td>${escapeHtml(entry.name || 'Unbenannter Command-Account')}</td>
      <td>${escapeHtml(entry.dienstnummer || '-')}</td>
      <td>${escapeHtml(entry.rank || '-')}</td>
      <td>${escapeHtml(issues.join(', '))}</td>
      <td><button type="button" class="secondary-button action-button" onclick="recoverCommandAccount(${index})">Recovery</button></td>
    </tr>
  `).join('');
  return `
    <div class="toolbar" style="margin-bottom:16px; align-items:flex-start; flex-direction:column; gap:12px;">
      <span class="admin-pill">Recovery<strong>Bootstrap Admin</strong></span>
      <div>Unbenutzbare Command-Konten koennen hier mit neuer Dienstnummer und temporaerem Passwort repariert werden.</div>
    </div>
    ${latestRecoveryMarkup}
    <table>
      <thead>
        <tr><th>Name</th><th>Dienstnummer</th><th>Rank</th><th>Problem</th><th>Aktion</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderAccountForm(editData = null) {
  const data = editData || { name: '', dienstnummer: '', rank: '', department: '', password: '' };
  return `
    <form id="account-form" class="stack-form compact-form">
      <div><label>Name<br><input name="name" required value="${escapeHtml(data.name || '')}"></label></div>
      <div><label>Dienstnummer<br><input name="dienstnummer" required value="${escapeHtml(data.dienstnummer || '')}"></label></div>
      <div><label>Rank<br><select name="rank" required>${renderOptionList(rankCatalog, data.rank || rankCatalog[0])}</select></label></div>
      <div><label>Department<br><select name="department" required>${renderOptionList(departmentCatalog, data.department || departmentCatalog[0])}</select></label></div>
      <div><label>Passwort<br><input name="password" type="password" ${editData ? '' : 'required'} placeholder="${editData ? 'Leer lassen, um das Passwort nicht zu aendern' : 'Initiales Passwort'}"></label></div>
      <div class="form-error form-feedback"></div>
      <div class="form-success form-feedback"></div>
      <button type="submit" class="primary-button">${editData ? 'Account aktualisieren' : 'Account erstellen'}</button>
    </form>
  `;
}

function renderAccountList() {
  const search = window.accountSearch || '';
  const filtered = getManagedAccountsWithIndex(search);
  const recoveryPanel = renderAccountRecoveryPanel();
  const rows = filtered.map(({ entry, index }) => {
    const derivedRole = deriveRoleFromAccount(entry);
    return `
      <tr>
        <td>${escapeHtml(entry.name)}</td>
        <td>${escapeHtml(entry.dienstnummer)}</td>
        <td>${escapeHtml(entry.rank)}</td>
        <td>${escapeHtml(entry.department)}</td>
        <td>${escapeHtml(derivedRole)}</td>
        <td>${renderEntryActions({ page: 'accountverwaltung', entry, editAction: `editAccount(${index})`, deleteAction: `deleteAccount(${index})` })}</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="6" class="empty-state">Keine Benutzerkonten vorhanden.</td></tr>';
  return `
    ${recoveryPanel}
    <div class="search-row">
      <input placeholder="Name, Dienstnummer, Rank oder Department durchsuchen" value="${escapeHtml(search)}" oninput="window.accountSearch=this.value;renderApp()">
    </div>
    <div class="toolbar">
      <span class="admin-pill">Login<strong>Dienstnummer</strong></span>
      <span class="admin-pill">Verwaltung<strong>Commander+</strong></span>
    </div>
    <table>
      <thead>
        <tr><th>Name</th><th>Dienstnummer</th><th>Rank</th><th>Department</th><th>Rolle</th><th>Aktion</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

window.editAccount = function(index) {
  const accounts = loadManagedAccounts();
  if (!ensureAccountAdmin()) return;
  window.localStorage.setItem('lspd_page', 'neuer account');
  setTimeout(() => renderApp(accounts[index], index), 10);
};

window.recoverCommandAccount = function(index) {
  if (!ensureAccountAdmin()) return;
  const currentUser = getCurrentUser();
  if (!currentUser?.isBootstrapAdmin) {
    showNotification('Diese Recovery-Funktion ist nur fuer den Bootstrap-Admin freigegeben.', '#ff6b6b');
    return;
  }
  const accounts = loadManagedAccounts();
  const account = accounts[index];
  if (!account || !isCommandRank(account.rank)) {
    showNotification('Kein reparierbarer Command-Account gefunden.', '#ff6b6b');
    return;
  }
  const issues = getCommandRecoveryIssues(account);
  if (!issues.length && isUsableCommandAccount(account)) {
    showNotification('Dieser Command-Account ist bereits benutzbar.', '#47c98b');
    return;
  }
  if (!String(account.name || '').trim()) {
    account.name = 'Recovered Command Account';
  }
  if (!String(account.department || '').trim()) {
    account.department = 'Command';
  }
  if (!String(account.dienstnummer || '').trim()) {
    account.dienstnummer = generateRecoveryDienstnummer(accounts, account);
  }
  const temporaryPassword = generateRecoveryPassword();
  account.password = temporaryPassword;
  accounts[index] = account;
  saveManagedAccounts(accounts);
  upsertPersonnelFromAccount(account);
  window.commandRecoveryResult = {
    accountId: account.id,
    name: account.name,
    dienstnummer: account.dienstnummer,
    password: temporaryPassword
  };
  appendAuditLog('command_account_recovered', {
    accountId: account.id,
    dienstnummer: account.dienstnummer,
    name: account.name,
    repairedIssues: issues
  });
  showNotification(`Command-Account repariert: ${account.dienstnummer}`, '#47c98b');
  renderApp();
};

window.deleteAccount = function(index) {
  if (!ensureAccountAdmin()) return;
  const accounts = loadManagedAccounts();
  const account = accounts[index];
  if (!account) return;
  if (isCommandRank(account.rank) && getCommandAccountCount(accounts) <= 1) {
    showNotification('Der letzte Command-Account kann nicht geloescht werden.', '#ff6b6b');
    return;
  }
  if (confirm(`Den Account von ${account.name} wirklich loeschen?`)) {
    accounts.splice(index, 1);
    saveManagedAccounts(accounts);
    archivePersonnelForAccount(account);
    appendAuditLog('account_deleted', { accountId: account.id, dienstnummer: account.dienstnummer, name: account.name, rank: account.rank, department: account.department });
    const currentUser = getCurrentUser();
    if (currentUser?.accountId === account.id) {
      window.localStorage.removeItem('lspd_user');
      renderApp();
      return;
    }
    renderApp();
  }
};

function renderPersonalForm(editData = null) {
  const data = editData || { name: '', badge: '', rank: '', division: '', status: 'aktiv', notes: '' };
  const linked = isLinkedPersonnelEntry(data);
  return `
    <form id="personal-form" class="stack-form compact-form">
      <div><label>Name<br><input name="name" required value="${escapeHtml(data.name || '')}" ${linked ? 'readonly' : ''}></label></div>
      <div><label>Dienstnummer<br><input name="badge" required value="${escapeHtml(data.badge || '')}" ${linked ? 'readonly' : ''}></label></div>
      <div><label>Rang<br><select name="rank" ${linked ? 'disabled' : ''}>${renderOptionList(rankCatalog, data.rank || rankCatalog[0])}</select>${linked ? `<input type="hidden" name="rank" value="${escapeHtml(data.rank || '')}">` : ''}</label></div>
      <div><label>Division / Einheit<br><select name="division" ${linked ? 'disabled' : ''}>${renderOptionList(departmentCatalog, data.division || departmentCatalog[0])}</select>${linked ? `<input type="hidden" name="division" value="${escapeHtml(data.division || '')}">` : ''}</label></div>
      <div><label>Status<br>
        <select name="status">
          <option value="aktiv" ${data.status === 'aktiv' ? 'selected' : ''}>aktiv</option>
          <option value="offen" ${data.status === 'offen' ? 'selected' : ''}>offen</option>
          <option value="gesperrt" ${data.status === 'gesperrt' ? 'selected' : ''}>gesperrt</option>
          <option value="archiviert" ${data.status === 'archiviert' ? 'selected' : ''}>archiviert</option>
        </select>
      </label></div>
      <div><label>Vermerk<br><textarea name="notes" placeholder="Laufbahn, interne Hinweise, Sonderfunktionen">${escapeHtml(data.notes || '')}</textarea></label></div>
      ${linked ? '<div class="form-success form-feedback">Verknuepfte Personalakten uebernehmen Name, Dienstnummer, Rang und Department direkt aus der Accountverwaltung.</div>' : ''}
      <div class="form-error form-feedback"></div>
      ${linked ? '' : '<div class="form-success form-feedback"></div>'}
      <button type="submit" class="primary-button">${editData ? 'Aenderungen speichern' : 'Personalakte speichern'}</button>
    </form>
  `;
}

function renderPersonalList() {
  const search = window.personalSearch || '';
  const filtered = sortIndexedPersonnelEntries(
    withSourceIndex(getDerivedPersonnelEntries()).filter(({ entry }) => matchesSearch(entry, ['name', 'badge', 'rank', 'division', 'status', 'notes'], search))
  );
  const rows = filtered.map(({ entry, index }) => `
    <tr>
      <td>${escapeHtml(entry.name)}</td>
      <td>${escapeHtml(entry.badge)}</td>
      <td>${escapeHtml(entry.rank)}</td>
      <td>${escapeHtml(entry.division)}</td>
      <td><span class="${statusClass(entry.status)}">${escapeHtml(entry.status)}</span></td>
      <td>${entry.linked ? '<span class="status-badge status-open">Account-verknuepft</span>' : renderEntryActions({ page: 'personalakten', entry, editAction: `editPersonal(${index})`, deleteAction: `deletePersonal(${index})` })}</td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="empty-state">Keine Personalakten vorhanden.</td></tr>';
  return `
    <div class="search-row">
      <input placeholder="Name, Rang oder Division durchsuchen" value="${escapeHtml(search)}" oninput="window.personalSearch=this.value;renderApp()">
    </div>
    <div class="toolbar">
      <span class="admin-pill">Sortierung<strong>Dienstgrad</strong></span>
      <span class="admin-pill">Sekundaer<strong>Abteilung</strong></span>
    </div>
    <table>
      <thead>
        <tr><th>Name</th><th>Dienstnummer</th><th>Rang</th><th>Division</th><th>Status</th><th>Aktion</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

window.editPersonal = function(index) {
  const entries = getDerivedPersonnelEntries();
  if (!ensureWriteAccess('personalakten', null, entries[index])) return;
  if (entries[index]?.linked) {
    showNotification('Verknuepfte Personaldaten werden ueber die Accountverwaltung gepflegt.', '#ffb347');
  }
  window.localStorage.setItem('lspd_page', 'neuer personal eintrag');
  setTimeout(() => renderApp(entries[index], index), 10);
};

window.deletePersonal = function(index) {
  const entries = getDerivedPersonnelEntries();
  if (!ensureWriteAccess('personalakten', null, entries[index])) return;
  if (entries[index]?.linked) {
    showNotification('Verknuepfte Personaldaten koennen nicht separat geloescht werden.', '#ff6b6b');
    return;
  }
  if (confirm('Diesen Personaleintrag wirklich loeschen?')) {
    personalEintraege.splice(entries[index].sourceIndex, 1);
    savePersonalEintraege();
    renderApp();
  }
};

let unterlagenEintraege = readStorageJson('unterlagenEintraege', []);
function saveUnterlagenEintraege() {
  localStorage.setItem('unterlagenEintraege', JSON.stringify(unterlagenEintraege));
}

function renderUnterlagenForm(editData = null) {
  const data = editData || { title: '', category: 'Nachweis', reference: '', validUntil: '', status: 'offen', notes: '' };
  return `
    <form id="unterlagen-form" class="stack-form compact-form">
      <div><label>Titel<br><input name="title" required value="${escapeHtml(data.title || '')}"></label></div>
      <div><label>Kategorie<br>
        <select name="category">
          <option value="Nachweis" ${data.category === 'Nachweis' ? 'selected' : ''}>Nachweis</option>
          <option value="Zertifikat" ${data.category === 'Zertifikat' ? 'selected' : ''}>Zertifikat</option>
          <option value="Antrag" ${data.category === 'Antrag' ? 'selected' : ''}>Antrag</option>
          <option value="Vermerk" ${data.category === 'Vermerk' ? 'selected' : ''}>Vermerk</option>
        </select>
      </label></div>
      <div><label>Referenz / Aktenzeichen<br><input name="reference" value="${escapeHtml(data.reference || '')}"></label></div>
      <div><label>Gueltig bis<br><input name="validUntil" type="date" value="${escapeHtml(data.validUntil || '')}"></label></div>
      <div><label>Status<br>
        <select name="status">
          <option value="offen" ${data.status === 'offen' ? 'selected' : ''}>offen</option>
          <option value="gueltig" ${data.status === 'gueltig' ? 'selected' : ''}>gueltig</option>
          <option value="abgelaufen" ${data.status === 'abgelaufen' ? 'selected' : ''}>abgelaufen</option>
          <option value="archiviert" ${data.status === 'archiviert' ? 'selected' : ''}>archiviert</option>
        </select>
      </label></div>
      <div><label>Notiz<br><textarea name="notes" placeholder="Ablageort, Rueckfragen, Freigaben">${escapeHtml(data.notes || '')}</textarea></label></div>
      <div class="form-error form-feedback"></div>
      <div class="form-success form-feedback"></div>
      <button type="submit" class="primary-button">${editData ? 'Aenderungen speichern' : 'Unterlage speichern'}</button>
    </form>
  `;
}

function renderUnterlagenList() {
  const search = window.unterlagenSearch || '';
  const filtered = withSourceIndex(unterlagenEintraege).filter(({ entry }) => matchesSearch(entry, ['title', 'category', 'reference', 'status', 'notes'], search));
  const rows = filtered.map(({ entry, index }) => `
    <tr>
      <td>${escapeHtml(entry.title)}</td>
      <td>${escapeHtml(entry.category)}</td>
      <td>${escapeHtml(entry.reference || '-')}</td>
      <td>${escapeHtml(entry.validUntil || '-')}</td>
      <td><span class="${statusClass(entry.status)}">${escapeHtml(entry.status)}</span></td>
      <td>${renderEntryActions({ page: 'unterlagen uebersicht', entry, editAction: `editUnterlage(${index})`, deleteAction: `deleteUnterlage(${index})` })}</td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="empty-state">Keine Unterlagen vorhanden.</td></tr>';
  return `
    <div class="search-row">
      <input placeholder="Titel, Kategorie oder Referenz durchsuchen" value="${escapeHtml(search)}" oninput="window.unterlagenSearch=this.value;renderApp()">
    </div>
    <table>
      <thead>
        <tr><th>Titel</th><th>Kategorie</th><th>Referenz</th><th>Gueltig bis</th><th>Status</th><th>Aktion</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

window.editUnterlage = function(index) {
  if (!ensureWriteAccess('unterlagen uebersicht', null, unterlagenEintraege[index])) return;
  window.localStorage.setItem('lspd_page', 'neue unterlage');
  setTimeout(() => renderApp(unterlagenEintraege[index], index), 10);
};

window.deleteUnterlage = function(index) {
  if (!ensureWriteAccess('unterlagen uebersicht', null, unterlagenEintraege[index])) return;
  if (confirm('Diese Unterlage wirklich loeschen?')) {
    appendAuditLog('document_deleted', { title: unterlagenEintraege[index].title, reference: unterlagenEintraege[index].reference || '' });
    unterlagenEintraege.splice(index, 1);
    saveUnterlagenEintraege();
    renderApp();
  }
};

window.editBericht = function(idx) {
    ultraDebugLog('editBericht', idx);
  if (!ensureWriteAccess('einsatzberichte durchsuchen', null, einsatzberichte[idx])) return;
  const b = einsatzberichte[idx];
  window.localStorage.setItem('lspd_page','einsatzbericht erstellen');
  setTimeout(()=>renderApp(b,idx),10);
}
window.deleteBericht = function(idx) {
    ultraDebugLog('deleteBericht', idx);
  if (!ensureWriteAccess('einsatzberichte durchsuchen', null, einsatzberichte[idx])) return;
  if(confirm('Diesen Bericht wirklich löschen?')) {
    appendAuditLog('report_deleted', { type: 'Einsatzbericht', reference: getReportReference('einsatzberichte durchsuchen', einsatzberichte[idx]) });
    einsatzberichte.splice(idx,1);
    saveBerichte();
    renderApp();
  }
}

let unfallBerichte = readStorageJson('unfallBerichte', []);
function saveUnfallBerichte() {
  localStorage.setItem('unfallBerichte', JSON.stringify(unfallBerichte));
}

function renderUnfallForm(editData = null) {
  const data = editData || { fallnummer: '', zeit: '', ort: '', beteiligte: '', schaden: '', beschreibung: '', status: 'offen' };
  return renderPageShell({
    kicker: 'Collision Intake',
    title: editData ? 'Unfallbericht bearbeiten' : 'Unfallbericht erfassen',
    intro: 'Dokumentiere Verkehrsunfaelle mit Fallnummer, Ort, Beteiligten und Schadenbild in einer eigenen Berichtsstrecke.',
    actions: `<button type="button" class="secondary-button" onclick="navigate('unfallbericht')">Zur Uebersicht</button>`,
    body: `
      <form id="unfall-form" class="stack-form">
        <div><label>Fallnummer<br><input name="fallnummer" required value="${escapeHtml(data.fallnummer || '')}"></label></div>
        <div><label>Zeitpunkt<br><input name="zeit" type="datetime-local" required value="${escapeHtml(data.zeit || '')}"></label></div>
        <div><label>Ort<br><input name="ort" required value="${escapeHtml(data.ort || '')}"></label></div>
        <div><label>Beteiligte Parteien<br><input name="beteiligte" required value="${escapeHtml(data.beteiligte || '')}"></label></div>
        <div><label>Schadenbild<br><input name="schaden" required value="${escapeHtml(data.schaden || '')}"></label></div>
        ${renderReviewRequestFields(data)}
        <div><label>Beschreibung<br><textarea name="beschreibung" required>${escapeHtml(data.beschreibung || '')}</textarea></label></div>
        <div class="form-error form-feedback"></div>
        <div class="form-success form-feedback"></div>
        <button type="submit" class="primary-button">${editData ? 'Aenderungen speichern' : 'Unfallbericht speichern'}</button>
      </form>
    `
  });
}

function renderUnfallList() {
  const search = window.unfallSearch || '';
  const filtered = withSourceIndex(unfallBerichte).filter(({ entry }) => matchesSearch(entry, ['fallnummer', 'ort', 'beteiligte', 'schaden', 'beschreibung'], search));
  const rows = filtered.map(({ entry, index }) => `
    <tr>
      <td>${escapeHtml(entry.fallnummer)}</td>
      <td>${escapeHtml(entry.zeit?.replace('T', ' ').slice(0, 16) || '')}</td>
      <td>${escapeHtml(entry.ort)}</td>
      <td>${escapeHtml(entry.schaden)}</td>
      <td><span class="${statusClass(entry.status)}">${escapeHtml(entry.status || 'offen')}</span></td>
      <td>${renderEntryActions({ page: 'unfallbericht', entry, editAction: `editUnfall(${index})`, deleteAction: `deleteUnfall(${index})` })}</td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="empty-state">Keine Unfallberichte vorhanden.</td></tr>';
  return `
    <div class="search-row">
      <input placeholder="Fallnummer, Ort oder Beteiligte durchsuchen" value="${escapeHtml(search)}" oninput="window.unfallSearch=this.value;renderApp()">
    </div>
    <table>
      <thead><tr><th>Fallnummer</th><th>Zeit</th><th>Ort</th><th>Schaden</th><th>Status</th><th>Aktion</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

window.editUnfall = function(index) {
  if (!ensureWriteAccess('unfallbericht', null, unfallBerichte[index])) return;
  window.localStorage.setItem('lspd_page', 'neuer unfallbericht');
  setTimeout(() => renderApp(unfallBerichte[index], index), 10);
};

window.deleteUnfall = function(index) {
  if (!ensureWriteAccess('unfallbericht', null, unfallBerichte[index])) return;
  if (confirm('Diesen Unfallbericht wirklich loeschen?')) {
    appendAuditLog('report_deleted', { type: 'Unfallbericht', reference: getReportReference('unfallbericht', unfallBerichte[index]) });
    unfallBerichte.splice(index, 1);
    saveUnfallBerichte();
    renderApp();
  }
};

let gangBerichte = readStorageJson('gangBerichte', []);
function saveGangBerichte() {
  localStorage.setItem('gangBerichte', JSON.stringify(gangBerichte));
}

function renderGangForm(editData = null) {
  const data = editData || { alias: '', gang: '', gebiet: '', officer: '', status: 'offen', notizen: '' };
  return renderPageShell({
    kicker: 'Gang Intel',
    title: editData ? 'Gangmember Bericht bearbeiten' : 'Gangmember Bericht erfassen',
    intro: 'Sammle strukturierte Informationen zu Gangmitgliedern, Gebieten und internem Bearbeitungsstand.',
    actions: `<button type="button" class="secondary-button" onclick="navigate('gangmember bericht')">Zur Uebersicht</button>`,
    body: `
      <form id="gang-form" class="stack-form">
        <div><label>Alias / Name<br><input name="alias" required value="${escapeHtml(data.alias || '')}"></label></div>
        <div><label>Gangzuordnung<br><input name="gang" required value="${escapeHtml(data.gang || '')}"></label></div>
        <div><label>Gebiet / Turf<br><input name="gebiet" required value="${escapeHtml(data.gebiet || '')}"></label></div>
        <div><label>Zustaendiger Officer<br><input name="officer" required value="${escapeHtml(data.officer || '')}"></label></div>
        ${renderReviewRequestFields(data)}
        <div><label>Notizen<br><textarea name="notizen" required>${escapeHtml(data.notizen || '')}</textarea></label></div>
        <div class="form-error form-feedback"></div>
        <div class="form-success form-feedback"></div>
        <button type="submit" class="primary-button">${editData ? 'Aenderungen speichern' : 'Gangbericht speichern'}</button>
      </form>
    `
  });
}

function renderGangList() {
  const search = window.gangSearch || '';
  const filtered = withSourceIndex(gangBerichte).filter(({ entry }) => matchesSearch(entry, ['alias', 'gang', 'gebiet', 'officer', 'status', 'notizen'], search));
  const rows = filtered.map(({ entry, index }) => `
    <tr>
      <td>${escapeHtml(entry.alias)}</td>
      <td>${escapeHtml(entry.gang)}</td>
      <td>${escapeHtml(entry.gebiet)}</td>
      <td>${escapeHtml(entry.officer)}</td>
      <td><span class="${statusClass(entry.status)}">${escapeHtml(entry.status)}</span></td>
      <td>${renderEntryActions({ page: 'gangmember bericht', entry, editAction: `editGang(${index})`, deleteAction: `deleteGang(${index})` })}</td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="empty-state">Keine Gangberichte vorhanden.</td></tr>';
  return `
    <div class="search-row">
      <input placeholder="Alias, Gang oder Gebiet durchsuchen" value="${escapeHtml(search)}" oninput="window.gangSearch=this.value;renderApp()">
    </div>
    <table>
      <thead><tr><th>Alias</th><th>Gang</th><th>Gebiet</th><th>Officer</th><th>Status</th><th>Aktion</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

window.editGang = function(index) {
  if (!ensureWriteAccess('gangmember bericht', null, gangBerichte[index])) return;
  window.localStorage.setItem('lspd_page', 'neuer gangmember bericht');
  setTimeout(() => renderApp(gangBerichte[index], index), 10);
};

window.deleteGang = function(index) {
  if (!ensureWriteAccess('gangmember bericht', null, gangBerichte[index])) return;
  if (confirm('Diesen Gangbericht wirklich loeschen?')) {
    appendAuditLog('report_deleted', { type: 'Gangmember Bericht', reference: getReportReference('gangmember bericht', gangBerichte[index]) });
    gangBerichte.splice(index, 1);
    saveGangBerichte();
    renderApp();
  }
};

let btmWaffenBerichte = readStorageJson('btmWaffenBerichte', []);
function saveBtmWaffenBerichte() {
  localStorage.setItem('btmWaffenBerichte', JSON.stringify(btmWaffenBerichte));
}

function renderBtmForm(editData = null) {
  const data = editData || { beweisnummer: '', zeit: '', ort: '', art: '', menge: '', status: 'offen', notizen: '' };
  return renderPageShell({
    kicker: 'Contraband Intake',
    title: editData ? 'BTM & Waffen Bericht bearbeiten' : 'BTM & Waffen Bericht erfassen',
    intro: 'Halte Beschlagnahmungen mit Beweisnummer, Art, Menge und Bearbeitungsstatus in einer separaten Akte fest.',
    actions: `<button type="button" class="secondary-button" onclick="navigate('btm & waffen bericht')">Zur Uebersicht</button>`,
    body: `
      <form id="btm-form" class="stack-form">
        <div><label>Beweisnummer<br><input name="beweisnummer" required value="${escapeHtml(data.beweisnummer || '')}"></label></div>
        <div><label>Zeitpunkt<br><input name="zeit" type="datetime-local" required value="${escapeHtml(data.zeit || '')}"></label></div>
        <div><label>Ort<br><input name="ort" required value="${escapeHtml(data.ort || '')}"></label></div>
        <div><label>Art / Gegenstand<br><input name="art" required value="${escapeHtml(data.art || '')}"></label></div>
        <div><label>Menge / Anzahl<br><input name="menge" required value="${escapeHtml(data.menge || '')}"></label></div>
        ${renderReviewRequestFields(data)}
        <div><label>Notizen<br><textarea name="notizen" required>${escapeHtml(data.notizen || '')}</textarea></label></div>
        <div class="form-error form-feedback"></div>
        <div class="form-success form-feedback"></div>
        <button type="submit" class="primary-button">${editData ? 'Aenderungen speichern' : 'BTM-/Waffenbericht speichern'}</button>
      </form>
    `
  });
}

function renderBtmList() {
  const search = window.btmSearch || '';
  const filtered = withSourceIndex(btmWaffenBerichte).filter(({ entry }) => matchesSearch(entry, ['beweisnummer', 'ort', 'art', 'menge', 'status', 'notizen'], search));
  const rows = filtered.map(({ entry, index }) => `
    <tr>
      <td>${escapeHtml(entry.beweisnummer)}</td>
      <td>${escapeHtml(entry.zeit?.replace('T', ' ').slice(0, 16) || '')}</td>
      <td>${escapeHtml(entry.art)}</td>
      <td>${escapeHtml(entry.menge)}</td>
      <td><span class="${statusClass(entry.status)}">${escapeHtml(entry.status)}</span></td>
      <td>${renderEntryActions({ page: 'btm & waffen bericht', entry, editAction: `editBtm(${index})`, deleteAction: `deleteBtm(${index})` })}</td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="empty-state">Keine BTM-/Waffenberichte vorhanden.</td></tr>';
  return `
    <div class="search-row">
      <input placeholder="Beweisnummer, Art oder Ort durchsuchen" value="${escapeHtml(search)}" oninput="window.btmSearch=this.value;renderApp()">
    </div>
    <table>
      <thead><tr><th>Beweisnummer</th><th>Zeit</th><th>Art</th><th>Menge</th><th>Status</th><th>Aktion</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

window.editBtm = function(index) {
  if (!ensureWriteAccess('btm & waffen bericht', null, btmWaffenBerichte[index])) return;
  window.localStorage.setItem('lspd_page', 'neuer btm & waffen bericht');
  setTimeout(() => renderApp(btmWaffenBerichte[index], index), 10);
};

window.deleteBtm = function(index) {
  if (!ensureWriteAccess('btm & waffen bericht', null, btmWaffenBerichte[index])) return;
  if (confirm('Diesen BTM-/Waffenbericht wirklich loeschen?')) {
    appendAuditLog('report_deleted', { type: 'BTM & Waffen Bericht', reference: getReportReference('btm & waffen bericht', btmWaffenBerichte[index]) });
    btmWaffenBerichte.splice(index, 1);
    saveBtmWaffenBerichte();
    renderApp();
  }
};

function collectOwnReports(username) {
  const own = [];
  const pushEntries = (entries, type, titleBuilder, dateField = 'zeit') => {
    entries.forEach((entry, index) => {
      if (entry.createdBy === username) {
        own.push({
          type,
          title: titleBuilder(entry),
          date: entry[dateField] || '',
          status: entry.status || 'offen',
          index
        });
      }
    });
  };
  pushEntries(einsatzberichte, 'Einsatzbericht', entry => entry.titel || 'Einsatzbericht');
  pushEntries(unfallBerichte, 'Unfallbericht', entry => entry.fallnummer || 'Unfallbericht');
  pushEntries(gangBerichte, 'Gangmember Bericht', entry => entry.alias || 'Gangmember Bericht', 'zeit');
  pushEntries(btmWaffenBerichte, 'BTM & Waffen Bericht', entry => entry.beweisnummer || 'BTM & Waffen Bericht');
  pushEntries(specialReports['swat einsatzbericht'].entries, 'SWAT Einsatzbericht', entry => entry.operation || 'SWAT Einsatzbericht');
  pushEntries(specialReports['air patrol bericht'].entries, 'Air Patrol Bericht', entry => entry.operation || 'Air Patrol Bericht');
  pushEntries(specialReports['k9 duty bericht'].entries, 'K9 Duty Bericht', entry => entry.operation || 'K9 Duty Bericht');
  pushEntries(patrolBerichte, 'Patrol Duty Bericht', entry => entry.partner || 'Patrol Duty Bericht', 'start');
  return own.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function renderMeineBerichteList(username) {
  const ownReports = collectOwnReports(username);
  const rows = ownReports.map(entry => `
    <tr>
      <td>${escapeHtml(entry.type)}</td>
      <td>${escapeHtml(entry.title)}</td>
      <td>${escapeHtml(entry.date ? entry.date.replace('T', ' ').slice(0, 16) : '-')}</td>
      <td><span class="${statusClass(entry.status)}">${escapeHtml(entry.status)}</span></td>
    </tr>
  `).join('') || '<tr><td colspan="4" class="empty-state">Fuer diesen Account wurden noch keine eigenen Berichte gespeichert.</td></tr>';
  return `
    <table>
      <thead><tr><th>Typ</th><th>Titel / Referenz</th><th>Datum</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

const specialReportConfigs = {
  'swat einsatzbericht': {
    storageKey: 'swatBerichte',
    kicker: 'Tactical Operations',
    title: 'SWAT Einsatzbericht',
    intro: 'Dokumentiere taktische Zugriffe, Einsatzleitung und Lageentwicklung fuer Hochrisikooperationen in einer separaten Akte.',
    createLabel: 'Neuen SWAT-Bericht',
    entityLabel: 'SWAT-Bericht'
  },
  'air patrol bericht': {
    storageKey: 'airPatrolBerichte',
    kicker: 'Air Support',
    title: 'Air Patrol Bericht',
    intro: 'Fuehre Luftunterstuetzung, Fluggebiet und Missionsstatus in einer eigenen Air-Support-Dokumentation.',
    createLabel: 'Neuen Air-Patrol-Bericht',
    entityLabel: 'Air-Patrol-Bericht'
  },
  'k9 duty bericht': {
    storageKey: 'k9Berichte',
    kicker: 'K9 Deployment',
    title: 'K9 Duty Bericht',
    intro: 'Erfasse Hundefuehrer, Einsatzgebiet und Ergebnis in einer klar getrennten K9-Deployment-Akte.',
    createLabel: 'Neuen K9-Bericht',
    entityLabel: 'K9-Bericht'
  }
};

const specialReports = Object.fromEntries(Object.entries(specialReportConfigs).map(([page, config]) => [page, {
  ...config,
  entries: readStorageJson(config.storageKey, [])
}]));

function saveSpecialReports(page) {
  const config = specialReports[page];
  if (!config) return;
  localStorage.setItem(config.storageKey, JSON.stringify(config.entries));
}

function renderSpecialReportForm(page, editData = null) {
  const config = specialReports[page];
  const data = editData || { operation: '', zeit: '', lead: '', location: '', status: 'offen', summary: '' };
  return renderPageShell({
    kicker: config.kicker,
    title: editData ? `${config.title} bearbeiten` : `${config.title} erfassen`,
    intro: config.intro,
    actions: `<button type="button" class="secondary-button" onclick="navigate('${page}')">Zur Uebersicht</button>`,
    body: `
      <form id="special-report-form" class="stack-form">
        <div><label>Operation / Callout<br><input name="operation" required value="${escapeHtml(data.operation || '')}"></label></div>
        <div><label>Zeitpunkt<br><input name="zeit" type="datetime-local" required value="${escapeHtml(data.zeit || '')}"></label></div>
        <div><label>Lead / Handler<br><input name="lead" required value="${escapeHtml(data.lead || '')}"></label></div>
        <div><label>Ort / Gebiet<br><input name="location" required value="${escapeHtml(data.location || '')}"></label></div>
        ${renderReviewRequestFields(data)}
        <div><label>Zusammenfassung<br><textarea name="summary" required>${escapeHtml(data.summary || '')}</textarea></label></div>
        <div class="form-error form-feedback"></div>
        <div class="form-success form-feedback"></div>
        <button type="submit" class="primary-button">${editData ? 'Aenderungen speichern' : `${config.entityLabel} speichern`}</button>
      </form>
    `
  });
}

function renderSpecialReportList(page) {
  const config = specialReports[page];
  const key = `${page.replace(/[^a-z0-9]+/gi, '_')}_search`;
  const search = window[key] || '';
  const filtered = withSourceIndex(config.entries).filter(({ entry }) => matchesSearch(entry, ['operation', 'lead', 'location', 'status', 'summary'], search));
  const rows = filtered.map(({ entry, index }) => `
    <tr>
      <td>${escapeHtml(entry.operation)}</td>
      <td>${escapeHtml(entry.lead)}</td>
      <td>${escapeHtml(entry.location)}</td>
      <td><span class="${statusClass(entry.status)}">${escapeHtml(entry.status || 'offen')}</span></td>
      <td>${renderEntryActions({ page, entry, editAction: `editSpecialReport('${page}', ${index})`, deleteAction: `deleteSpecialReport('${page}', ${index})` })}</td>
    </tr>
  `).join('') || `<tr><td colspan="5" class="empty-state">Keine ${config.entityLabel.toLowerCase()}e vorhanden.</td></tr>`;
  return `
    <div class="search-row">
      <input placeholder="Operation, Lead oder Ort durchsuchen" value="${escapeHtml(search)}" oninput="window.${key}=this.value;renderApp()">
    </div>
    <table>
      <thead><tr><th>Operation</th><th>Lead</th><th>Ort</th><th>Status</th><th>Aktion</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

window.editSpecialReport = function(page, index) {
  if (!ensureWriteAccess(page, null, specialReports[page].entries[index])) return;
  window.localStorage.setItem('lspd_page', `neuer ${page}`);
  setTimeout(() => renderApp(specialReports[page].entries[index], index), 10);
};

window.deleteSpecialReport = function(page, index) {
  const config = specialReports[page];
  if (!ensureWriteAccess(page, null, config.entries[index])) return;
  if (confirm(`Diesen ${config.entityLabel} wirklich loeschen?`)) {
    appendAuditLog('report_deleted', {
      type: getReportModuleLabel(page),
      reference: getReportReference(page, config.entries[index])
    });
    config.entries.splice(index, 1);
    saveSpecialReports(page);
    renderApp();
  }
};
// Kategorien für Sidebar
const categories = [
  {
    id: 1, name: 'Berichte', page: 'berichte', children: [
      { id: 101, name: 'Patrol Duty Bericht', page: 'patrol duty bericht' },
      { id: 102, name: 'Einsatzberichte', page: 'einsatzberichte durchsuchen' },
      { id: 103, name: 'Unfallbericht', page: 'unfallbericht' },
      { id: 104, name: 'Gangmember Bericht', page: 'gangmember bericht' },
      { id: 105, name: 'BTM & Waffen Bericht', page: 'btm & waffen bericht' },
      { id: 106, name: 'SWAT Einsatzbericht', page: 'swat einsatzbericht' },
      { id: 107, name: 'Air Patrol Bericht', page: 'air patrol bericht' },
      { id: 108, name: 'K9 Duty Bericht', page: 'k9 duty bericht' },
      { id: 109, name: 'Meine Berichte', page: 'meine berichte' }
    ]
  },
  { id: 2, name: 'Field Training Officer', page: 'fto uebersicht', children: [] },
  {
    id: 3,
    name: 'Supervisor',
    page: 'review queue',
    children: [
      { id: 301, name: 'Review Queue', page: 'review queue' },
      { id: 302, name: 'Audit Log', page: 'audit log' }
    ]
  },
  {
    id: 4,
    name: 'Personal',
    page: 'personalakten',
    children: [
      { id: 401, name: 'Personalliste', page: 'personalakten' },
      { id: 402, name: 'Accountverwaltung', page: 'accountverwaltung' },
      { id: 403, name: 'Mein Konto', page: 'mein konto' }
    ]
  },
  { id: 5, name: 'Meine Unterlagen', page: 'unterlagen uebersicht', children: [] }
];
function renderLogin() {
    ultraDebugLog('renderLogin');
  const bootstrapEnabled = !hasUsableCommandAccounts();
  const recoveryMode = bootstrapEnabled && hasCommandAccounts();
  document.getElementById('main').innerHTML = `
    <div class="loginbox login-branded">
      <div class="login-shell">
        <section class="login-media">
          <div class="login-media-badge"></div>
          <h3>LSPD Internal Console</h3>
          <p>HEAT verbindet Reports, Review-Flows und sensible interne Daten in einer abgeschotteten Arbeitsoberflaeche. Banner und Badge sind jetzt direkt Teil des Dashboards statt nur Kopfzeilen-Details.</p>
          <div class="hero-chip-row">
            <span class="hero-chip">Hidden Internal Tool</span>
            <span class="hero-chip">Role-Based Access</span>
            <span class="hero-chip">LSPD Branded</span>
          </div>
        </section>
        <section class="login-panel">
          <div class="login-kicker">Restricted Access</div>
          <h2>LSPD HEAT Login</h2>
          <p class="login-subcopy">Melde dich mit Dienstnummer oder Namen und Passwort an, um auf Berichte und interne Verwaltungsbereiche zuzugreifen. Diese Oberfläche bleibt bewusst isoliert und ist nicht Teil der öffentlichen Websites.</p>
          <div class="login-field">
            <input id="login-user" placeholder="Dienstnummer oder Name" autocomplete="username" autofocus />
          </div>
          <div class="password-wrap login-field">
            <input id="login-pass" type="password" placeholder="Passwort" autocomplete="current-password" />
            <button id="showpass" class="password-toggle" type="button">Anzeigen</button>
          </div>
          <button id="login-btn" class="primary-button">Login</button>
          <div class="error" id="login-error"></div>
          <div class="demo-note">${bootstrapEnabled ? `Bootstrap Admin aktiv: <b>${BOOTSTRAP_ADMIN_USERNAME}</b> / <b>${BOOTSTRAP_ADMIN_PASSWORD}</b>. Sobald ein benutzbarer Command-Account mit Passwort hinterlegt wurde, wird dieser Setup-Login deaktiviert.` : 'Aktive Nutzer melden sich mit Dienstnummer und dem vergebenen Passwort an.'}${recoveryMode ? ' Ein vorhandener Command-Eintrag ist derzeit nicht benutzbar; der Bootstrap-Login bleibt deshalb als Recovery aktiv.' : ''}</div>
        </section>
      </div>
    </div>
  `;
  document.getElementById('sidebar').innerHTML = '';
  document.getElementById('adminbar').innerHTML = '';
  const userInput = document.getElementById('login-user');
  const passInput = document.getElementById('login-pass');
  const errorDiv = document.getElementById('login-error');
  document.getElementById('showpass').onclick = () => {
    passInput.type = passInput.type === 'password' ? 'text' : 'password';
    document.getElementById('showpass').textContent = passInput.type === 'password' ? 'Anzeigen' : 'Verbergen';
  };
  function tryLogin() {
    const user = userInput.value.trim();
    const pass = passInput.value;
    if(!user || !pass) {
      errorDiv.textContent = 'Bitte alle Felder ausfüllen!';
      return;
    }
    const session = authenticateUser(user, pass);
    if(session) {
      if (session.isBootstrapAdmin) {
        window.localStorage.setItem('lspd_page', 'accountverwaltung');
      } else {
        const storedPage = window.localStorage.getItem('lspd_page');
        if (!storedPage || !userCanAccessPage(session, storedPage)) {
          window.localStorage.setItem('lspd_page', getDefaultPageForUser(session));
        }
      }
      window.localStorage.setItem('lspd_user', JSON.stringify(session));
      renderApp();
    } else {
      errorDiv.textContent = 'Falsche Zugangsdaten!';
    }
  }
  document.getElementById('login-btn').onclick = tryLogin;
  userInput.addEventListener('keydown', e => { if(e.key==='Enter') passInput.focus(); });
  passInput.addEventListener('keydown', e => { if(e.key==='Enter') tryLogin(); });
}

let openDropdown = 1;
function renderSidebar(user, active) {
    ultraDebugLog('renderSidebar', user, active);
  const sidebar = document.getElementById('sidebar');
  sidebar.className = 'sidebar';
  const visibleCategories = categories.filter(category => {
    if (category.page && userCanReadPage(user, category.page)) {
      return true;
    }
    return (category.children || []).some(child => userCanReadPage(user, child.page));
  });
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <img src="LSPD.webp" alt="LSPD Logo" class="sidebar-logo" />
      <div>
        <div class="sidebar-kicker">Internal Console</div>
        <div class="sidebar-wordmark">HEAT</div>
        <div class="sidebar-meta">Los Santos Police Department</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <ul>
        ${visibleCategories.map(cat => {
          const isOpen = openDropdown === cat.id;
          const isActive = active && (active === cat.page || cat.children?.some(child => active === child.page));
          const visibleChildren = (cat.children || []).filter(child => userCanAccessPage(user, child.page));
          const targetPage = cat.page || cat.name.toLowerCase();
          return `
            <li class="${isOpen ? 'open' : ''} ${isActive ? 'active' : ''}">
              <div class="sidebar-main" onclick="${visibleChildren.length > 0 ? `toggleDropdown(${cat.id})` : `navigate('${targetPage}')`} ">
                <span class="sidebar-main-label"><span class="sidebar-bullet"></span><span>${cat.name}</span></span>
                ${visibleChildren.length > 0 ? `<span class="arrow">▼</span>` : ''}
              </div>
              ${visibleChildren.length > 0 ? `<ul>${visibleChildren.map(child => `
                <li class="${active === child.page ? 'active' : ''}" onclick="navigate('${child.page}');event.stopPropagation();">${child.name}</li>
              `).join('')}</ul>` : ''}
            </li>
          `;
        }).join('')}
      </ul>
    </nav>
    <button class="sidebar-logout" onclick="logout()">Abmelden</button>
    <div class="sidebar-user">Eingeloggt als <b>${escapeHtml(user.name || user.username)}</b><br>${escapeHtml(user.dienstnummer || user.username)} · ${escapeHtml(user.role || 'Officer')} · ${escapeHtml(user.label || 'Access')}</div>
  `;
}
window.toggleDropdown = function(id) {
  openDropdown = openDropdown === id ? null : id;
  renderApp();
}

function renderAdminBar(page) {
    ultraDebugLog('renderAdminBar', page);
  document.getElementById('adminbar').innerHTML = `
    <div class="adminbar-group">
      <span class="admin-pill">Bereich<strong>Internal</strong></span>
      <span class="admin-pill">Seite<strong>${escapeHtml(formatPageLabel(page || 'übersicht'))}</strong></span>
    </div>
    <div class="adminbar-group">
      <span class="admin-pill">Rolle<strong>${escapeHtml(getCurrentUser()?.role || 'Officer')}</strong></span>
      <span class="admin-pill">Reports<strong>${getOperationalReportCount()}</strong></span>
      <span class="admin-pill">Patrol<strong>${patrolBerichte.length}</strong></span>
    </div>
  `;
}

function renderPage(page, editData = null, editIdx = null, filter = {}) {
  const user = getCurrentUser();
  if (!user) {
    renderLogin();
    return;
  }
  if (!userCanReadPage(user, page)) {
    renderSidebar(user, page);
    renderAdminBar(page);
    renderAccessDenied(page, 'read');
    return;
  }
  if (pageRequiresWriteAccess(page) && !userCanWritePage(user, page)) {
    renderSidebar(user, page);
    renderAdminBar(page);
    renderAccessDenied(page, 'write');
    return;
  }
  if (editData && !canManageEntry(user, page, editData)) {
    renderSidebar(user, page);
    renderAdminBar(page);
    renderAccessDenied(page, 'write');
    return;
  }
  renderSidebar(user, page);
  renderAdminBar(page);
  if(page==='einsatzbericht' || page==='einsatzbericht erstellen') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderEinsatzberichtForm(editData, editIdx);
    // Drag & drop logic
    const dropzone = document.getElementById('dropzone');
    const input = document.getElementById('anhang-input');
    let anhangData = editData && editData.anhang ? editData.anhang : null;
    function showPreview(dataUrl) {
      const preview = document.getElementById('anhang-preview');
      if (dataUrl) {
        preview.innerHTML = `<img src="${dataUrl}"><button type='button' id='remove-anhang' class='danger-button action-button'>Entfernen</button>`;
        document.getElementById('remove-anhang').onclick = function() {
          anhangData = null;
          preview.innerHTML = '';
        };
      } else {
        preview.innerHTML = '';
      }
    }
    showPreview(anhangData);
    dropzone.onclick = () => input.click();
    dropzone.ondragover = e => { e.preventDefault(); dropzone.classList.add('is-over'); };
    dropzone.ondragleave = e => { e.preventDefault(); dropzone.classList.remove('is-over'); };
    dropzone.ondrop = e => {
      e.preventDefault();
      dropzone.classList.remove('is-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    };
    input.onchange = e => {
      const file = e.target.files[0];
      if (file) handleFile(file);
    };
    function handleFile(file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        anhangData = evt.target.result;
        showPreview(anhangData);
      };
      reader.readAsDataURL(file);
    }
    document.getElementById('einsatzbericht-form').onsubmit = function(e) {
      e.preventDefault();
      clearFormFeedback(this);
      if (!ensureWriteAccess(page, this, editData)) return;
      const fd = new FormData(this);
      let obj = Object.fromEntries(fd.entries());
      obj.anhang = anhangData;
      obj.createdBy = editData?.createdBy || user.username;
      obj = finalizeReportWorkflow(page, obj, user);
      // Validation
      if (!obj.titel || !obj.zeit || !obj.typ || !obj.beschreibung) {
        showFormError(this, 'Bitte alle Pflichtfelder ausfüllen!');
        return;
      }
      if(editData && editIdx!=null) {
        einsatzberichte[editIdx] = obj;
        showNotification('Einsatzbericht geändert!', '#4caf50');
      } else {
        einsatzberichte.push(obj);
        showNotification('Neuer Einsatzbericht gespeichert!', '#2196f3');
      }
      saveBerichte();
      showFormSuccess(this, 'Einsatzbericht gespeichert!');
      this.reset();
      setTimeout(()=>{
        clearFormFeedback(this);
        renderApp();
      },1200);
    };
    return;
  }
  // Only declare user and page if not already passed as arguments
  if (!user) {
    renderLogin();
    return;
  }
  if(page==='patrol duty bericht') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Patrol Review',
      title: 'Patrol Duty Berichte',
      intro: 'Durchsuche vorhandene Streifenberichte und filtere nach Partner, Zeitraum oder freien Suchbegriffen.',
      actions: renderPageButton({ page: 'neuer patrol duty bericht', label: 'Neuen Patrolbericht', requiresWrite: true }),
      body: renderPatrolList(filter)
    });
    document.getElementById('patrolfilterform').onsubmit = function(e) {
      e.preventDefault();
      const fd = new FormData(this);
      renderPage('patrol duty bericht', null, null, Object.fromEntries(fd.entries()));
    };
    return;
  }
  if(page==='neuer patrol duty bericht') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPatrolForm(editData);
    const form = document.getElementById('patrol-form');
    form.onsubmit = function(e) {
      e.preventDefault();
      clearFormFeedback(this);
      if (!ensureWriteAccess('neuer patrol duty bericht', this, editData)) return;
      let obj = Object.fromEntries(new FormData(this).entries());
      obj.createdBy = editData?.createdBy || user.username;
      obj = finalizeReportWorkflow('neuer patrol duty bericht', obj, user);
      if (!obj.start || !obj.ende || !obj.partner) {
        showFormError(this, 'Bitte Beginn, Ende und Streifenpartner ausfuellen!');
        return;
      }
      if (editData && editIdx != null) {
        patrolBerichte[editIdx] = obj;
        showNotification('Patrolbericht aktualisiert!', '#47c98b');
      } else {
        patrolBerichte.push(obj);
        showNotification('Patrolbericht gespeichert!', '#2196f3');
      }
      savePatrolBerichte();
      showFormSuccess(this, 'Patrolbericht gespeichert!');
      setTimeout(() => navigate('patrol duty bericht'), 900);
    };
    return;
  }
  if(page==='unfallbericht') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Collision Reports',
      title: 'Unfallbericht',
      intro: 'Verwalte Verkehrsunfaelle mit eigener Fallnummer, Schadenbild und strukturierter Dokumentation.',
      actions: renderPageButton({ page: 'neuer unfallbericht', label: 'Neuen Unfallbericht', requiresWrite: true }),
      body: renderUnfallList()
    });
    return;
  }
  if(page==='neuer unfallbericht') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderUnfallForm(editData);
    const form = document.getElementById('unfall-form');
    form.onsubmit = function(e) {
      e.preventDefault();
      clearFormFeedback(this);
      if (!ensureWriteAccess('neuer unfallbericht', this, editData)) return;
      let obj = Object.fromEntries(new FormData(this).entries());
      obj.createdBy = editData?.createdBy || user.username;
      obj = finalizeReportWorkflow('neuer unfallbericht', obj, user);
      if (!obj.fallnummer || !obj.zeit || !obj.ort || !obj.beteiligte || !obj.schaden || !obj.beschreibung) {
        showFormError(this, 'Bitte alle Pflichtfelder ausfuellen!');
        return;
      }
      if (editData && editIdx != null) {
        unfallBerichte[editIdx] = obj;
        showNotification('Unfallbericht aktualisiert!', '#47c98b');
      } else {
        unfallBerichte.push(obj);
        showNotification('Unfallbericht gespeichert!', '#2196f3');
      }
      saveUnfallBerichte();
      showFormSuccess(this, 'Unfallbericht gespeichert!');
      setTimeout(() => navigate('unfallbericht'), 900);
    };
    return;
  }
  if(page==='gangmember bericht') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Gang Intelligence',
      title: 'Gangmember Bericht',
      intro: 'Fuehre Alias, Gebietszuordnung und aktuellen Bearbeitungsstand in einer eigenen Intelligence-Ansicht.',
      actions: renderPageButton({ page: 'neuer gangmember bericht', label: 'Neuen Gangbericht', requiresWrite: true }),
      body: renderGangList()
    });
    return;
  }
  if(page==='neuer gangmember bericht') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderGangForm(editData);
    const form = document.getElementById('gang-form');
    form.onsubmit = function(e) {
      e.preventDefault();
      clearFormFeedback(this);
      if (!ensureWriteAccess('neuer gangmember bericht', this, editData)) return;
      let obj = Object.fromEntries(new FormData(this).entries());
      obj.createdBy = editData?.createdBy || user.username;
      obj = finalizeReportWorkflow('neuer gangmember bericht', obj, user);
      if (!obj.alias || !obj.gang || !obj.gebiet || !obj.officer || !obj.notizen) {
        showFormError(this, 'Bitte alle Pflichtfelder ausfuellen!');
        return;
      }
      if (editData && editIdx != null) {
        gangBerichte[editIdx] = obj;
        showNotification('Gangbericht aktualisiert!', '#47c98b');
      } else {
        gangBerichte.push(obj);
        showNotification('Gangbericht gespeichert!', '#2196f3');
      }
      saveGangBerichte();
      showFormSuccess(this, 'Gangbericht gespeichert!');
      setTimeout(() => navigate('gangmember bericht'), 900);
    };
    return;
  }
  if(page==='btm & waffen bericht') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Contraband Reports',
      title: 'BTM & Waffen Bericht',
      intro: 'Verwalte Beschlagnahmungen mit Beweisnummer, Fundort, Menge und Status in einer separaten Beweisakte.',
      actions: renderPageButton({ page: 'neuer btm & waffen bericht', label: 'Neuen BTM-/Waffenbericht', requiresWrite: true }),
      body: renderBtmList()
    });
    return;
  }
  if(page==='neuer btm & waffen bericht') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderBtmForm(editData);
    const form = document.getElementById('btm-form');
    form.onsubmit = function(e) {
      e.preventDefault();
      clearFormFeedback(this);
      if (!ensureWriteAccess('neuer btm & waffen bericht', this, editData)) return;
      let obj = Object.fromEntries(new FormData(this).entries());
      obj.createdBy = editData?.createdBy || user.username;
      obj = finalizeReportWorkflow('neuer btm & waffen bericht', obj, user);
      if (!obj.beweisnummer || !obj.zeit || !obj.ort || !obj.art || !obj.menge || !obj.notizen) {
        showFormError(this, 'Bitte alle Pflichtfelder ausfuellen!');
        return;
      }
      if (editData && editIdx != null) {
        btmWaffenBerichte[editIdx] = obj;
        showNotification('BTM-/Waffenbericht aktualisiert!', '#47c98b');
      } else {
        btmWaffenBerichte.push(obj);
        showNotification('BTM-/Waffenbericht gespeichert!', '#2196f3');
      }
      saveBtmWaffenBerichte();
      showFormSuccess(this, 'BTM-/Waffenbericht gespeichert!');
      setTimeout(() => navigate('btm & waffen bericht'), 900);
    };
    return;
  }
  if(page==='meine berichte') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Personal Report Archive',
      title: 'Meine Berichte',
      intro: 'Zeigt alle fuer den aktuellen Account gespeicherten Einsatz-, Unfall-, Gang- und Beweismittelberichte in einer persoenlichen Uebersicht.',
      body: renderMeineBerichteList(user.username)
    });
    return;
  }
  if (specialReports[page]) {
    const main = document.getElementById('main');
    if (!main) return;
    const config = specialReports[page];
    main.innerHTML = renderPageShell({
      kicker: config.kicker,
      title: config.title,
      intro: config.intro,
      actions: renderPageButton({ page: `neuer ${page}`, label: config.createLabel, requiresWrite: true }),
      body: renderSpecialReportList(page)
    });
    return;
  }
  if (page.startsWith('neuer ') && specialReports[page.replace(/^neuer /, '')]) {
    const basePage = page.replace(/^neuer /, '');
    const config = specialReports[basePage];
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderSpecialReportForm(basePage, editData);
    const form = document.getElementById('special-report-form');
    form.onsubmit = function(e) {
      e.preventDefault();
      clearFormFeedback(this);
      if (!ensureWriteAccess(page, this, editData)) return;
      let obj = Object.fromEntries(new FormData(this).entries());
      obj.createdBy = editData?.createdBy || user.username;
      obj = finalizeReportWorkflow(page, obj, user);
      if (!obj.operation || !obj.zeit || !obj.lead || !obj.location || !obj.summary) {
        showFormError(this, 'Bitte alle Pflichtfelder ausfuellen!');
        return;
      }
      if (editData && editIdx != null) {
        specialReports[basePage].entries[editIdx] = obj;
        showNotification(`${config.entityLabel} aktualisiert!`, '#47c98b');
      } else {
        specialReports[basePage].entries.push(obj);
        showNotification(`${config.entityLabel} gespeichert!`, '#2196f3');
      }
      saveSpecialReports(basePage);
      showFormSuccess(this, `${config.entityLabel} gespeichert!`);
      setTimeout(() => navigate(basePage), 900);
    };
    return;
  }
  if(page==='einsatzberichte durchsuchen') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Report Search',
      title: 'Einsatzberichte durchsuchen',
      intro: 'Filtere Berichte nach Einsatztyp, Zeitraum und Suchbegriffen oder exportiere die Liste direkt als CSV.',
      actions: renderPageButton({ page: 'einsatzbericht', label: 'Neuen Bericht erfassen', requiresWrite: true }),
      body: renderBerichteList(filter)
    });
    document.getElementById('filterform').onsubmit = function(e) {
      e.preventDefault();
      const fd = new FormData(this);
      renderApp(null,null,Object.fromEntries(fd.entries()));
    }
    return;
  }
  if(page==='field training officer' || page==='fto uebersicht') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Training Control',
      title: 'Field Training Officer',
      intro: 'Fuehre Trainees, dokumentiere Review-Termine und halte Freigaben oder Verlaengerungen im FTO-Workflow fest.',
      actions: renderPageButton({ page: 'neuer fto eintrag', label: 'Neuen FTO-Eintrag', requiresWrite: true }),
      body: renderFtoList()
    });
    return;
  }
  if(page==='neuer fto eintrag') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Training Intake',
      title: editData ? 'FTO-Eintrag bearbeiten' : 'Neuer FTO-Eintrag',
      intro: 'Lege Ausbildungsphasen, Trainerzuordnung und Review-Status fuer einen Trainee zentral an.',
      actions: `<button type="button" class="secondary-button" onclick="navigate('fto uebersicht')">Zur Uebersicht</button>`,
      body: renderFtoForm(editData)
    });
    const form = document.getElementById('fto-form');
    form.onsubmit = function(e) {
      e.preventDefault();
      clearFormFeedback(this);
      if (!ensureWriteAccess('neuer fto eintrag', this, editData)) return;
      const obj = Object.fromEntries(new FormData(this).entries());
      if (!obj.trainee || !obj.badge || !obj.trainer) {
        showFormError(this, 'Bitte Trainee, Dienstnummer und Trainer ausfuellen!');
        return;
      }
      if (editData && editIdx != null) {
        ftoEintraege[editIdx] = obj;
        showNotification('FTO-Eintrag aktualisiert!', '#47c98b');
      } else {
        ftoEintraege.push(obj);
        showNotification('FTO-Eintrag gespeichert!', '#2196f3');
      }
      saveFtoEintraege();
      showFormSuccess(this, 'FTO-Eintrag gespeichert!');
      setTimeout(() => navigate('fto uebersicht'), 900);
    };
    return;
  }
  if(page==='supervisor' || page==='review queue') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Review Queue',
      title: 'Supervisor',
      intro: 'Supervisors pruefen hier eingereichte Berichte, setzen Rueckfragen, dokumentieren Freigaben und halten den Review-Status zentral fest.',
      actions: renderPageButton({ page: 'neuer supervisor fall', label: 'Neuen Review-Fall', requiresWrite: true }),
      body: renderSupervisorList()
    });
    return;
  }
  if(page==='audit log') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Accountability',
      title: 'Audit Log',
      intro: 'Nachvollziehbarkeit fuer sensible Aktionen wie Account-Aenderungen, Report-Loeschungen und Freigaben.',
      body: renderAuditLogList()
    });
    return;
  }
  if(page==='neuer supervisor fall') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Review Intake',
      title: editData ? 'Review-Fall bearbeiten' : 'Neuer Review-Fall',
      intro: 'Lege einen Bericht zur Supervisor-Pruefung an, inklusive Referenz, einreichendem Officer und Review-Status.',
      actions: `<button type="button" class="secondary-button" onclick="navigate('review queue')">Zur Review Queue</button>`,
      body: renderSupervisorForm(editData)
    });
    const form = document.getElementById('supervisor-form');
    form.onsubmit = function(e) {
      e.preventDefault();
      clearFormFeedback(this);
      if (!ensureWriteAccess('neuer supervisor fall', this, editData)) return;
      const obj = Object.fromEntries(new FormData(this).entries());
      if (!obj.reportType || !obj.reportReference || !obj.reportTitle || !obj.submittedBy) {
        showFormError(this, 'Bitte Berichtstyp, Referenz, Titel und einreichenden Officer ausfuellen!');
        return;
      }
      if (editData && editIdx != null) {
        supervisorFaelle[editIdx] = obj;
        appendAuditLog('review_updated', {
          type: obj.reportType,
          reference: obj.reportReference,
          status: obj.status
        });
        showNotification('Review-Fall aktualisiert!', '#47c98b');
      } else {
        supervisorFaelle.push(obj);
        appendAuditLog('review_created', {
          type: obj.reportType,
          reference: obj.reportReference,
          status: obj.status
        });
        showNotification('Review-Fall gespeichert!', '#2196f3');
      }
      saveSupervisorFaelle();
      showFormSuccess(this, 'Review-Fall gespeichert!');
      setTimeout(() => navigate('review queue'), 900);
    };
    return;
  }
  if(page==='personal' || page==='personalakten') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Personnel Records',
      title: 'Personal',
      intro: 'Fuehre die Personalliste mit Dienstgrad, Abteilungszugehoerigkeit, Dienstnummer und internem Status in einer sortierten Verwaltungsansicht.',
      actions: `${renderPageButton({ page: 'neuer personal eintrag', label: 'Neuen Personal-Eintrag', requiresWrite: true })}${renderPageButton({ page: 'accountverwaltung', label: 'Accountverwaltung', className: 'secondary-button' })}`,
      body: renderPersonalList()
    });
    return;
  }
  if(page==='neuer personal eintrag') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Personnel Intake',
      title: editData ? 'Personal-Eintrag bearbeiten' : 'Neuer Personal-Eintrag',
      intro: 'Erfasse Rang, Dienstnummer, Einheit und interne Vermerke fuer die laufende Personalverwaltung.',
      actions: `<button type="button" class="secondary-button" onclick="navigate('personalakten')">Zu den Personalakten</button>`,
      body: renderPersonalForm(editData)
    });
    const form = document.getElementById('personal-form');
    form.onsubmit = function(e) {
      e.preventDefault();
      clearFormFeedback(this);
      if (!ensureWriteAccess('neuer personal eintrag', this, editData)) return;
      const obj = Object.fromEntries(new FormData(this).entries());
      if (!obj.name || !obj.badge || !obj.rank || !obj.division) {
        showFormError(this, 'Bitte Name, Dienstnummer, Rang und Division ausfuellen!');
        return;
      }
      if (editData?.accountId) {
        const linkedIndex = personalEintraege.findIndex(entry => entry.accountId === editData.accountId || normalizeIdentifier(entry.badge) === normalizeIdentifier(editData.badge));
        const account = getManagedAccountById(editData.accountId);
        const linkedRecord = {
          accountId: editData.accountId,
          name: account?.name || editData.name,
          badge: account?.dienstnummer || editData.badge,
          rank: account?.rank || editData.rank,
          division: account?.department || editData.division,
          status: obj.status,
          notes: obj.notes
        };
        if (linkedIndex !== -1) {
          personalEintraege[linkedIndex] = linkedRecord;
        } else {
          personalEintraege.push(linkedRecord);
        }
        showNotification('Verknuepfte Personalakte aktualisiert!', '#47c98b');
      } else if (editData && editIdx != null) {
        personalEintraege[editIdx] = obj;
        showNotification('Personalakte aktualisiert!', '#47c98b');
      } else {
        personalEintraege.push(obj);
        showNotification('Personalakte gespeichert!', '#2196f3');
      }
      savePersonalEintraege();
      showFormSuccess(this, 'Personalakte gespeichert!');
      setTimeout(() => navigate('personalakten'), 900);
    };
    return;
  }
  if(page==='accountverwaltung') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Command Access',
      title: 'Accountverwaltung',
      intro: 'Command-Level erstellt hier Nutzerkonten mit Name, Dienstnummer, Rank, Department und Passwort. Commander und hoeher koennen Accounts jederzeit bearbeiten oder loeschen.',
      actions: renderPageButton({ page: 'neuer account', label: 'Neuen Account erstellen', requiresWrite: true }),
      body: renderAccountList()
    });
    return;
  }
  if(page==='mein konto') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Profile',
      title: 'Mein Konto',
      intro: 'Verwalte dein eigenes Passwort, ohne dass Command eingreifen muss.',
      body: renderProfileForm(user)
    });
    const form = document.getElementById('profile-form');
    form.onsubmit = function(e) {
      e.preventDefault();
      clearFormFeedback(this);
      const obj = Object.fromEntries(new FormData(this).entries());
      const account = getManagedAccountById(user.accountId);
      if (!account) {
        showFormError(this, 'Das zugehoerige Konto wurde nicht gefunden.');
        return;
      }
      if (account.password !== obj.currentPassword) {
        showFormError(this, 'Das aktuelle Passwort ist nicht korrekt.');
        return;
      }
      if (!obj.newPassword || obj.newPassword !== obj.confirmPassword) {
        showFormError(this, 'Neues Passwort und Bestaetigung stimmen nicht ueberein.');
        return;
      }
      account.password = obj.newPassword;
      const accounts = loadManagedAccounts().map(entry => entry.id === account.id ? account : entry);
      saveManagedAccounts(accounts);
      appendAuditLog('password_changed', { accountId: account.id, dienstnummer: account.dienstnummer });
      showFormSuccess(this, 'Passwort aktualisiert!');
      showNotification('Passwort aktualisiert!', '#47c98b');
      form.reset();
    };
    return;
  }
  if(page==='neuer account') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Account Intake',
      title: editData ? 'Account bearbeiten' : 'Neuer Account',
      intro: 'Lege Benutzer mit Name, Dienstnummer, Rank, Department und Passwort an. Die Rechte werden aus Rank und Department automatisch abgeleitet.',
      actions: `<button type="button" class="secondary-button" onclick="navigate('accountverwaltung')">Zur Accountverwaltung</button>`,
      body: renderAccountForm(editData)
    });
    const form = document.getElementById('account-form');
    form.onsubmit = function(e) {
      e.preventDefault();
      clearFormFeedback(this);
      if (!ensureAccountAdmin(this)) return;
      const accounts = loadManagedAccounts();
      const sessionBeforeSave = readStorageJson('lspd_user', null);
      const obj = Object.fromEntries(new FormData(this).entries());
      const trimmed = {
        name: obj.name.trim(),
        dienstnummer: obj.dienstnummer.trim(),
        rank: obj.rank.trim(),
        department: obj.department.trim(),
        password: obj.password
      };
      if (!trimmed.name || !trimmed.dienstnummer || !trimmed.rank || !trimmed.department) {
        showFormError(this, 'Bitte Name, Dienstnummer, Rank und Department ausfuellen!');
        return;
      }
      const duplicate = accounts.find((account, index) => {
        if (editIdx != null && index === editIdx) return false;
        return normalizeIdentifier(account.dienstnummer) === normalizeIdentifier(trimmed.dienstnummer);
      });
      if (duplicate) {
        showFormError(this, 'Diese Dienstnummer ist bereits vergeben.');
        return;
      }
      if (!editData && !trimmed.password) {
        showFormError(this, 'Bitte ein Passwort fuer den neuen Account vergeben.');
        return;
      }
      if (editData && isCommandRank(editData.rank) && !isCommandRank(trimmed.rank) && getCommandAccountCount(accounts) <= 1) {
        showFormError(this, 'Der letzte Command-Account kann nicht auf ein niedrigeres Rank-Level gesetzt werden.');
        return;
      }
      const nextAccount = {
        ...(editData || {}),
        id: editData?.id || createAccountId(),
        name: trimmed.name,
        dienstnummer: trimmed.dienstnummer,
        rank: trimmed.rank,
        department: trimmed.department,
        password: trimmed.password || editData?.password || ''
      };
      if (editData && editIdx != null) {
        accounts[editIdx] = nextAccount;
        showNotification('Account aktualisiert!', '#47c98b');
        appendAuditLog('account_updated', { accountId: nextAccount.id, dienstnummer: nextAccount.dienstnummer, name: nextAccount.name, rank: nextAccount.rank, department: nextAccount.department });
      } else {
        accounts.push(nextAccount);
        showNotification('Account erstellt!', '#2196f3');
        appendAuditLog('account_created', { accountId: nextAccount.id, dienstnummer: nextAccount.dienstnummer, name: nextAccount.name, rank: nextAccount.rank, department: nextAccount.department });
      }
      saveManagedAccounts(accounts);
      upsertPersonnelFromAccount(nextAccount, editData?.dienstnummer || null);
      showFormSuccess(this, editData ? 'Account aktualisiert!' : 'Account erstellt!');
      if (sessionBeforeSave?.isBootstrapAdmin && hasUsableCommandAccounts()) {
        window.localStorage.removeItem('lspd_user');
        window.localStorage.setItem('lspd_page', 'berichte');
        showNotification('Erster Command-Account erstellt. Bootstrap-Login wurde deaktiviert.', '#47c98b');
        setTimeout(() => renderApp(), 900);
        return;
      }
      setTimeout(() => navigate('accountverwaltung'), 900);
    };
    return;
  }
  if(page==='meine unterlagen' || page==='unterlagen uebersicht') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Document Vault',
      title: 'Meine Unterlagen',
      intro: 'Verwalte persoenliche Nachweise, Zertifikate und interne Dokumente mit Referenz und Gueltigkeit.',
      actions: renderPageButton({ page: 'neue unterlage', label: 'Neue Unterlage', requiresWrite: true }),
      body: renderUnterlagenList()
    });
    return;
  }
  if(page==='neue unterlage') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Document Intake',
      title: editData ? 'Unterlage bearbeiten' : 'Neue Unterlage',
      intro: 'Lege persoenliche Dokumente, Nachweise oder Zertifikate mit Status und Ablaufdatum strukturiert ab.',
      actions: `<button type="button" class="secondary-button" onclick="navigate('unterlagen uebersicht')">Zur Uebersicht</button>`,
      body: renderUnterlagenForm(editData)
    });
    const form = document.getElementById('unterlagen-form');
    form.onsubmit = function(e) {
      e.preventDefault();
      clearFormFeedback(this);
      if (!ensureWriteAccess('neue unterlage', this, editData)) return;
      const obj = Object.fromEntries(new FormData(this).entries());
      obj.createdBy = editData?.createdBy || user.username;
      if (!obj.title || !obj.category) {
        showFormError(this, 'Bitte mindestens Titel und Kategorie ausfuellen!');
        return;
      }
      if (editData && editIdx != null) {
        unterlagenEintraege[editIdx] = obj;
        showNotification('Unterlage aktualisiert!', '#47c98b');
      } else {
        unterlagenEintraege.push(obj);
        showNotification('Unterlage gespeichert!', '#2196f3');
      }
      saveUnterlagenEintraege();
      showFormSuccess(this, 'Unterlage gespeichert!');
      setTimeout(() => navigate('unterlagen uebersicht'), 900);
    };
    return;
  }
  if(page==='berichte') {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = renderPageShell({
      kicker: 'Reports Hub',
      title: 'Berichte und Auswertung',
      intro: 'Die zentrale Schaltflaeche fuer Patrol-Dokumentation, operative Einsatzberichte und die weitere Spezialisierung der Report-Module.',
      body: `
        <div class="dashboard-hero">
          <section class="hero-panel">
            <h3>Operational Picture</h3>
            <p>Das LSPD-Banner bildet jetzt die visuelle Klammer fuer das gesamte Reports-Hub. Von hier aus springen Einsatz-, Tactical-, Air- und K9-Berichte direkt in ihre jeweilige Fachstrecke.</p>
            <div class="hero-chip-row">
              <span class="hero-chip">Reports ${einsatzberichte.length + unfallBerichte.length + gangBerichte.length + btmWaffenBerichte.length}</span>
              <span class="hero-chip">All Reports ${getOperationalReportCount()}</span>
              <span class="hero-chip">Special Units ${specialReports['swat einsatzbericht'].entries.length + specialReports['air patrol bericht'].entries.length + specialReports['k9 duty bericht'].entries.length}</span>
            </div>
          </section>
          <section class="hero-badge-panel">
            <h3>Department Badge</h3>
            <p>Interne Einsatz- und Speziallagen bleiben in HEAT getrennt, aber visuell unter derselben LSPD-Identitaet gebuendelt.</p>
          </section>
        </div>
        ${renderModuleGrid([
        { eyebrow: 'Patrol', title: 'Patrol Duty Bericht', copy: 'Vorhandene Streifenberichte pruefen und nach Zeitraeumen oder Partnern filtern.', footer: `${patrolBerichte.length} Eintraege`, page: 'patrol duty bericht' },
        { eyebrow: 'Incident', title: 'Einsatzberichte', copy: 'Einsatzberichte durchsuchen, exportieren und bei Bedarf neue Vorfaelle erfassen.', footer: `${einsatzberichte.length} Berichte`, page: 'einsatzberichte durchsuchen' },
        { eyebrow: 'Collision', title: 'Unfallbericht', copy: 'Verkehrsunfaelle mit Fallnummer, Ort und Schadenbild separat dokumentieren.', footer: `${unfallBerichte.length} Berichte`, page: 'unfallbericht' },
        { eyebrow: 'Intel', title: 'Gangmember Bericht', copy: 'Alias, Gebiet und Officer-Zuordnung in einer eigenen Gang-Intel-Akte verwalten.', footer: `${gangBerichte.length} Berichte`, page: 'gangmember bericht' },
        { eyebrow: 'Evidence', title: 'BTM & Waffen Bericht', copy: 'Beschlagnahmungen mit Beweisnummer, Ort und Status separat archivieren.', footer: `${btmWaffenBerichte.length} Berichte`, page: 'btm & waffen bericht' },
        { eyebrow: 'Tactical', title: 'SWAT Einsatzbericht', copy: 'Taktische Hochrisiko-Lagen mit Lead, Ort und Status in einer Spezialakte fuehren.', footer: `${specialReports['swat einsatzbericht'].entries.length} Berichte`, page: 'swat einsatzbericht' },
        { eyebrow: 'Air Support', title: 'Air Patrol Bericht', copy: 'Luftunterstuetzung, Fluggebiet und Missionsstatus separat nachhalten.', footer: `${specialReports['air patrol bericht'].entries.length} Berichte`, page: 'air patrol bericht' },
        { eyebrow: 'K9', title: 'K9 Duty Bericht', copy: 'K9-Deployments mit Handler, Lage und Ergebnis dokumentieren.', footer: `${specialReports['k9 duty bericht'].entries.length} Berichte`, page: 'k9 duty bericht' },
        { eyebrow: 'Archive', title: 'Meine Berichte', copy: 'Persoenliche Uebersicht ueber alle selbst erfassten Berichte des aktuellen Accounts.', footer: `${collectOwnReports(user.username).length} Eigene Berichte`, page: 'meine berichte' }
      ])}
      `
    });
    return;
  }
  // Fallback/default: always render something in #main for unknown pages
  const main = document.getElementById('main');
  if (main) {
    const moduleCards = [
      { eyebrow: 'Reports', title: 'Berichte', copy: 'Sammelpunkt fuer Patrol Logs, Einsatzberichte und operative Dokumentation.', footer: `${einsatzberichte.length + patrolBerichte.length} Report-Eintraege`, page: 'berichte' },
      { eyebrow: 'Training', title: 'Field Training Officer', copy: 'Startpunkt fuer Auswertung, Status und interne Ausbildungsprozesse.', footer: 'Modul-Landingpage', page: 'field training officer' },
      { eyebrow: 'Review', title: 'Supervisor', copy: 'Uebersicht fuer Review- und Freigabeprozesse mit klarer Modultrennung.', footer: 'Modul-Landingpage', page: 'supervisor' },
      { eyebrow: 'Records', title: 'Personal', copy: 'Interne Personal- und Laufbahnverwaltung in einer separaten Arbeitsflaeche.', footer: 'Modul-Landingpage', page: 'personal' },
      { eyebrow: 'Archive', title: 'Meine Unterlagen', copy: 'Persoenliche Dokumente, eigene Vorgaenge und interne Nachweise sammeln.', footer: 'Modul-Landingpage', page: 'meine unterlagen' }
    ];
    main.innerHTML = renderPageShell({
      kicker: 'Operations Overview',
      title: page ? `${formatPageLabel(page)} Modul` : 'Willkommen beim LSPD HEAT Tool',
      intro: 'Diese interne Oberflaeche buendelt Berichte, Review-Prozesse und Personalverwaltung in einer eigenstaendigen Command-Console. Die Startseite bietet direkte Einstiege in alle Hauptmodule.',
      body: `
        <div class="dashboard-hero">
          <section class="hero-panel">
            <h3>Command Surface</h3>
            <p>Das lokale LSPD-Banner und das Department-Badge tragen die App jetzt nicht nur im Header, sondern direkt im operativen Dashboard. So wirkt die gesamte Konsole wie ein zusammenhaengendes internes Tool.</p>
            <div class="hero-chip-row">
              <span class="hero-chip">${user.role || 'Officer'}</span>
              <span class="hero-chip">${user.label || 'Access'}</span>
              <span class="hero-chip">Reports Hub Ready</span>
            </div>
          </section>
          <section class="hero-badge-panel">
            <h3>Los Santos Police Department</h3>
            <p>HEAT bleibt unsichtbar fuer die oeffentlichen Seiten, verwendet aber jetzt das gleiche starke Bildmaterial direkt in Login und Dashboard.</p>
          </section>
        </div>
        <div class="console-grid">
          <section class="console-card">
            <span class="console-metric">${einsatzberichte.length}</span>
            <h3>Einsatzberichte</h3>
            <p>Operative Vorfaelle erfassen, durchsuchen und fuer Reviews exportieren.</p>
          </section>
          <section class="console-card">
            <span class="console-metric">${patrolBerichte.length}</span>
            <h3>Patrol Log</h3>
            <p>Streifenverlaeufe, Partner und besondere Vorkommnisse im Blick behalten.</p>
          </section>
          <section class="console-card">
            <span class="console-metric">${loadManagedAccounts().length}</span>
            <h3>Accounts</h3>
            <p>Benutzerkonten, Dienstnummern und Command-Verwaltung zentral fuehren.</p>
          </section>
        </div>
        ${renderModuleGrid(moduleCards)}
        <div class="console-tags">
          <span class="console-tag">Hidden Internal Tool</span>
          <span class="console-tag">LSPD Console</span>
          <span class="console-tag">No Public Navigation</span>
        </div>
      `
    });
  }
}


// --- Restore renderApp and origRenderPage ---
function renderApp(editData = null, editIdx = null, filter = {}) {
  const user = getCurrentUser();
  if (!user) {
    renderLogin();
    return;
  }
  const page = window.localStorage.getItem('lspd_page') || getDefaultPageForUser(user);
  if (!userCanAccessPage(user, page)) {
    const fallbackPage = getDefaultPageForUser(user);
    window.localStorage.setItem('lspd_page', fallbackPage);
    renderPage(fallbackPage, editData, editIdx, filter);
    return;
  }
  renderPage(page, editData, editIdx, filter);
}

// Save the original renderPage logic as origRenderPage
const origRenderPage = function(page, editData = null, editIdx = null, filter = {}) {
  try {
    ultraDebugLog('origRenderPage', page, editData, editIdx, filter);
    const main = document.getElementById('main');
    if (!main) {
      ultraDebugLog("FEHLER: #main Element nicht gefunden in origRenderPage");
      return;
    }
    main.innerHTML = `
      <div id="main-content">
        <div class="page-kicker">Overview</div>
        <h2>Willkommen beim LSPD HEAT Tool</h2>
        <p class="page-intro">Bitte wähle eine Kategorie in der Sidebar aus, um mit Berichten, Personal oder Review-Prozessen zu arbeiten.</p>
      </div>
    `;
  } catch (e) {
    ultraDebugLog('ULTRA ERROR in origRenderPage', e);
    showNotification('ULTRA FEHLER in origRenderPage: ' + e.message, '#ff4d4d');
    setTimeout(()=>location.reload(), 2000);
  }
};

window.renderApp = renderApp;
window.navigate = function(page) {
  const user = getCurrentUser();
  if (user && !userCanAccessPage(user, page)) {
    showNotification('Zugriff fuer diesen Account nicht freigegeben.', '#ff6b6b');
    renderSidebar(user, page);
    renderAdminBar(page);
    renderAccessDenied(page);
    return;
  }
  if (user && pageRequiresWriteAccess(page) && !userCanWritePage(user, page)) {
    showNotification('Schreibrechte fuer diesen Bereich fehlen.', '#ff6b6b');
    renderSidebar(user, page);
    renderAdminBar(page);
    renderAccessDenied(page, 'write');
    return;
  }
  window.localStorage.setItem('lspd_page', page);
  renderApp();
};
window.logout = function() {
  window.localStorage.removeItem('lspd_user');
  window.localStorage.removeItem('lspd_page');
  renderApp();
};
window.onload = function() {
  initThemeToggle();
  const actions = createHeaderActionArea();
  const toggle = document.getElementById('theme-toggle');
  if (actions && toggle) {
    actions.prepend(toggle);
  }
  renderApp();
};

// --- Multilingual Support (DE/EN) ---
window.lspdLang = localStorage.getItem('lspd_lang') || 'de';
window.lspdTranslations = {
  de: {
    dashboard: 'Dashboard',
    profile: 'Mein Profil',
    logout: 'Abmelden',
    search: 'Suchen...',
    save: 'Speichern',
    edit: 'Bearbeiten',
    delete: 'Löschen',
    reports: 'Einsatzberichte',
    patrols: 'Streifenberichte',
    type: 'Typ',
    date: 'Datum',
    action: 'Aktion',
    title: 'Titel',
    description: 'Beschreibung',
    attachment: 'Dateianhang (optional):',
    dropHere: 'Hier klicken oder Datei hierher ziehen',
    remove: 'Entfernen',
    login: 'Login',
    username: 'Benutzername',
    password: 'Passwort',
    role: 'Rolle',
    newPassword: 'Neues Passwort',
    confirmPassword: 'Passwort bestätigen',
    open: 'Offen',
    accepted: 'Angenommen',
    rejected: 'Abgelehnt',
    // ...add more as needed
  },
  en: {
    dashboard: 'Dashboard',
    profile: 'My Profile',
    logout: 'Logout',
    search: 'Search...',
    save: 'Save',
    edit: 'Edit',
    delete: 'Delete',
    reports: 'Reports',
    patrols: 'Patrol Reports',
    type: 'Type',
    date: 'Date',
    action: 'Action',
    title: 'Title',
    description: 'Description',
    attachment: 'Attachment (optional):',
    dropHere: 'Click or drop file here',
    remove: 'Remove',
    login: 'Login',
    username: 'Username',
    password: 'Password',
    role: 'Role',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    open: 'Open',
    accepted: 'Accepted',
    rejected: 'Rejected',
    // ...add more as needed
  }
};
window.t = function(key) {
  return (window.lspdTranslations[window.lspdLang] && window.lspdTranslations[window.lspdLang][key]) || key;
};

// Add language toggle button to header
window.addEventListener('DOMContentLoaded', () => {
  const actions = createHeaderActionArea();
  let btn = document.getElementById('lang-toggle');
  if (!btn && actions) {
    btn = document.createElement('button');
    btn.id = 'lang-toggle';
    btn.className = 'theme-toggle';
    btn.textContent = window.lspdLang === 'de' ? 'EN' : 'DE';
    actions.appendChild(btn);
  }
  btn.onclick = () => {
    window.lspdLang = window.lspdLang === 'de' ? 'en' : 'de';
    localStorage.setItem('lspd_lang', window.lspdLang);
    btn.textContent = window.lspdLang === 'de' ? 'EN' : 'DE';
    renderApp();
  };
});

// --- Auto-Logout on Inactivity (10 min) ---
(function(){
  let logoutTimer;
  const TIMEOUT = 10 * 60 * 1000; // 10 minutes
  function resetLogoutTimer() {
    if (logoutTimer) clearTimeout(logoutTimer);
    logoutTimer = setTimeout(() => {
      showNotification(window.t ? window.t('logout')+': Inaktivität' : 'Abgemeldet wegen Inaktivität', '#ff4d4d');
      setTimeout(() => {
        window.localStorage.removeItem('lspd_user');
        renderApp();
      }, 1200);
    }, TIMEOUT);
  }
  ['click','mousemove','keydown','scroll','touchstart'].forEach(evt => {
    window.addEventListener(evt, resetLogoutTimer, true);
  });
  resetLogoutTimer();
})();
 