/**
 * Admin API Layer
 * Handles all API calls to the backend
 */

const API_BASE = '/api/admin';

class AdminAPI {
    constructor() {
        this.token = localStorage.getItem('admin_token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('admin_token', token);
        } else {
            localStorage.removeItem('admin_token');
        }
    }

    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (response.status === 401) {
                this.setToken(null);
                window.location.hash = '#login';
                throw new Error('Unauthorized');
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Request failed' }));
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Auth
    async login(password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ password }),
        });
        this.setToken(data.token);
        return data;
    }

    logout() {
        this.setToken(null);
    }

    // Dashboard
    async getStats() {
        return this.request('/stats');
    }

    async getRecentUsers() {
        return this.request('/users/recent');
    }

    async getActiveUsers() {
        return this.request('/users/active');
    }

    // Invites
    async getInvites() {
        return this.request('/invites');
    }

    async generateInvites(data) {
        return this.request('/invites/generate', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async disableInvite(code) {
        return this.request(`/invites/${code}/disable`, {
            method: 'POST',
        });
    }

    async deleteInvite(code) {
        return this.request(`/invites/${code}`, {
            method: 'DELETE',
        });
    }

    // Users
    async getUsers(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/users${query ? '?' + query : ''}`);
    }

    async getUserDetail(userId) {
        return this.request(`/users/${userId}`);
    }

    async backupUser(userId) {
        return this.request(`/users/${userId}/backup`, {
            method: 'POST',
        });
    }

    // Backups
    async getBackups() {
        return this.request('/backups');
    }

    async createFullBackup() {
        return this.request('/backups/full', {
            method: 'POST',
        });
    }

    async downloadBackup(backupId) {
        const url = `${API_BASE}/backups/${backupId}/download`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Download failed');
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `backup-${backupId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
    }
}

// Create global API instance
window.adminAPI = new AdminAPI();
