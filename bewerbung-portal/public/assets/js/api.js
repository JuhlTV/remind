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
    }

    /**
     * Generische Fetch Funktion
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Füge Token zu Authorization Header ein, wenn vorhanden
        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw {
                    status: response.status,
                    ...data
                };
            }

            return data;
        } catch (error) {
            console.error(`API Fehler [${endpoint}]:`, error);
            throw error;
        }
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
        const params = new URLSearchParams(filters);
        return this.request(`/applications?${params.toString()}`, {
            method: 'GET'
        });
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
