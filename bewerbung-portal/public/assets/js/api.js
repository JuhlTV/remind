/**
 * API Client für Bewerbungsportal
 */

const API_BASE_URL = (() => {
    const configuredBaseUrl =
        window.__API_BASE_URL__ ||
        document.querySelector('meta[name="api-base-url"]')?.content;

    if (configuredBaseUrl) {
        return configuredBaseUrl.replace(/\/+$/, '');
    }

    return `${window.location.origin}/api`;
})();

class APIClient {
    constructor() {
        this.token = localStorage.getItem('token');
        this.baseUrl = API_BASE_URL;
        this.baseUrlChecked = false;
        this.baseUrlResolvePromise = null;
        this.requestTimeoutMs = 15000;
        this.maxRetries = 1;
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    shouldRetry(method, status, error) {
        const normalizedMethod = String(method || 'GET').toUpperCase();
        const idempotentMethods = ['GET', 'HEAD', 'OPTIONS'];

        if (!idempotentMethods.includes(normalizedMethod)) {
            return false;
        }

        if (error?.name === 'TypeError' || error?.name === 'AbortError') {
            return true;
        }

        return [502, 503, 504].includes(Number(status));
    }

    parseResponseBody(raw, contentType) {
        const text = raw?.trim() || '';
        const isJson = contentType.includes('application/json');

        if (!text) {
            return {};
        }

        if (isJson) {
            try {
                return JSON.parse(text);
            } catch {
                return {
                    message: 'Ungültige JSON-Antwort vom Server erhalten',
                    raw: text.slice(0, 500)
                };
            }
        }

        return { message: text };
    }

    getBaseUrlCandidates() {
        const origin = window.location.origin;
        const persistedBaseUrl = localStorage.getItem('apiBaseUrl') || '';
        const configuredBaseUrl =
            window.__API_BASE_URL__ ||
            document.querySelector('meta[name="api-base-url"]')?.content ||
            '';

        const baseRoots = [
            configuredBaseUrl,
            persistedBaseUrl,
            this.baseUrl,
            origin,
            `${origin}/bewerbung-portal`,
            `${origin}/backend`,
            `${origin}/bewerbung-portal/backend`
        ].filter(Boolean);

        const toApiBase = (url) => {
            const normalized = String(url).replace(/\/+$/, '');
            return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
        };

        return [...new Set(baseRoots.map(toApiBase))];
    }

    async probeHealth(baseUrl) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(`${baseUrl}/health`, {
                method: 'GET',
                headers: {
                    Accept: 'application/json'
                },
                signal: controller.signal
            });

            return response.ok;
        } catch {
            return false;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async ensureBaseUrl() {
        if (this.baseUrlChecked) {
            return this.baseUrl;
        }

        if (this.baseUrlResolvePromise) {
            return this.baseUrlResolvePromise;
        }

        this.baseUrlResolvePromise = (async () => {
            const candidates = this.getBaseUrlCandidates();

            for (const candidate of candidates) {
                const healthy = await this.probeHealth(candidate);
                if (healthy) {
                    this.baseUrl = candidate;
                    localStorage.setItem('apiBaseUrl', candidate);
                    this.baseUrlChecked = true;
                    return this.baseUrl;
                }
            }

            this.baseUrlChecked = true;
            return this.baseUrl;
        })();

        try {
            return await this.baseUrlResolvePromise;
        } finally {
            this.baseUrlResolvePromise = null;
        }
    }

    async checkHealth() {
        await this.ensureBaseUrl();
        return this.probeHealth(this.baseUrl);
    }

    /**
     * Generische Fetch Funktion
     */
    async request(endpoint, options = {}) {
        await this.ensureBaseUrl();

        const url = `${this.baseUrl}${endpoint}`;
        const requestOptions = {
            headers: {
                ...options.headers
            },
            ...options
        };

        const hasBody = Object.prototype.hasOwnProperty.call(requestOptions, 'body');
        const isFormData = typeof FormData !== 'undefined' && requestOptions.body instanceof FormData;
        if (hasBody && !isFormData && !requestOptions.headers['Content-Type']) {
            requestOptions.headers['Content-Type'] = 'application/json';
        }

        const method = String(requestOptions.method || 'GET').toUpperCase();

        // Füge Token zu Authorization Header ein, wenn vorhanden
        if (this.token) {
            requestOptions.headers.Authorization = `Bearer ${this.token}`;
        }

        for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

            try {
                const response = await fetch(url, {
                    ...requestOptions,
                    signal: controller.signal
                });
                const contentType = response.headers.get('content-type') || '';
                const raw = await response.text();
                const data = this.parseResponseBody(raw, contentType);

                if (!response.ok) {
                    if (this.shouldRetry(method, response.status) && attempt < this.maxRetries) {
                        await this.sleep(300 * (attempt + 1));
                        continue;
                    }

                    if (response.status === 401) {
                        this.logout();
                    }

                    throw {
                        status: response.status,
                        ...data
                    };
                }

                return data;
            } catch (error) {
                if (this.shouldRetry(method, undefined, error) && attempt < this.maxRetries) {
                    await this.sleep(300 * (attempt + 1));
                    continue;
                }

                if (error?.name === 'AbortError') {
                    throw {
                        status: 408,
                        message: 'Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.'
                    };
                }

                if (error?.name === 'TypeError') {
                    throw {
                        status: 0,
                        message: 'Netzwerkfehler: Server nicht erreichbar oder CORS blockiert'
                    };
                }

                console.error(`API Fehler [${endpoint}]:`, error);
                throw error;
            } finally {
                clearTimeout(timeoutId);
            }
        }

        throw {
            status: 500,
            message: 'Unbekannter API-Fehler'
        };
    }

    /**
     * POST /api/applications
     * Bewerbung einreichen
     */
    async submitApplication(formData) {
        return this.request('/applications', {
            method: 'POST',
            body: JSON.stringify(formData)
        });
    }

    /**
     * POST /api/auth/login
     * Admin Login
     */
    async login(username, password) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (response.success) {
            this.token = response.token;
            localStorage.setItem('token', response.token);
            localStorage.setItem('admin', JSON.stringify(response.admin));
        }

        return response;
    }

    /**
     * GET /api/auth/me
     * Aktuellen Admin inkl. Rolle abrufen
     */
    async getMe() {
        return this.request('/auth/me', {
            method: 'GET'
        });
    }

    /**
     * GET /api/auth/roles
     * Verfügbare Rollen abrufen
     */
    async getRoles() {
        return this.request('/auth/roles', {
            method: 'GET'
        });
    }

    /**
     * GET /api/auth/admins
     * Admin-Liste abrufen
     */
    async getAdmins() {
        return this.request('/auth/admins', {
            method: 'GET'
        });
    }

    /**
     * POST /api/auth/admins
     * Neuen Admin erstellen
     */
    async createAdmin(payload) {
        return this.request('/auth/admins', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    /**
     * PATCH /api/auth/admins/:id/role
     * Rolle eines Admins ändern
     */
    async updateAdminRole(adminId, role) {
        return this.request(`/auth/admins/${adminId}/role`, {
            method: 'PATCH',
            body: JSON.stringify({ role })
        });
    }

    /**
     * GET /api/applications
     * Bewerbungen abrufen (nur Admin)
     */
    async getApplications(filters = {}) {
        const cleanFilters = Object.fromEntries(
            Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== '')
        );
        const params = new URLSearchParams(cleanFilters);
        return this.request(`/applications?${params.toString()}`, {
            method: 'GET'
        });
    }

    async bulkReviewApplications(payload) {
        return this.request('/applications/bulk/review', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async getApplicationHistory(applicationId) {
        return this.request(`/applications/${applicationId}/history`, {
            method: 'GET'
        });
    }

    async undoApplicationReview(applicationId) {
        return this.request(`/applications/${applicationId}/undo`, {
            method: 'POST'
        });
    }

    async getActivityLog(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/applications/activity?${params.toString()}`, {
            method: 'GET'
        });
    }

    async exportApplicationsCsv(filters = {}) {
        await this.ensureBaseUrl();
        const params = new URLSearchParams(
            Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ''))
        );
        const url = `${this.baseUrl}/applications/export/csv?${params.toString()}`;

        const headers = {};
        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            throw new Error('CSV Export fehlgeschlagen');
        }

        const blob = await response.blob();
        return {
            blob,
            filename: `applications-${Date.now()}.csv`
        };
    }

    /**
     * GET /api/applications/:id
     * Einzelne Bewerbung abrufen (nur Admin)
     */
    async getApplication(id) {
        return this.request(`/applications/${id}`, {
            method: 'GET'
        });
    }

    /**
     * PATCH /api/applications/:id
     * Bewerbung bewerten (nur Admin)
     */
    async reviewApplication(id, status, notes = '') {
        return this.request(`/applications/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status, notes })
        });
    }

    /**
     * DELETE /api/applications/:id
     * Bewerbung löschen (nur Admin)
     */
    async deleteApplication(id) {
        return this.request(`/applications/${id}`, {
            method: 'DELETE'
        });
    }

    /**
     * GET /api/applications/stats/summary
     * Statistiken abrufen (nur Admin)
     */
    async getStats() {
        return this.request('/applications/stats/summary', {
            method: 'GET'
        });
    }

    /**
     * Admin Logout
     */
    logout() {
        this.token = null;
        localStorage.removeItem('token');
        localStorage.removeItem('admin');
    }

    /**
     * Prüfe ob Admin angemeldet ist
     */
    isAuthenticated() {
        return !!this.token;
    }

    /**
     * Hole aktuellen Admin
     */
    getCurrentAdmin() {
        const admin = localStorage.getItem('admin');
        return admin ? JSON.parse(admin) : null;
    }
}

// Erstelle globale API Client Instanz
const api = new APIClient();
