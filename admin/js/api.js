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
                throw new Error(error.message || error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Auth
    async login(password) {
        const data = await this.request('/login', {
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
        const data = await this.request('/users/recent');
        return data.users || [];
    }

    async getActiveUsers() {
        const data = await this.request('/users/active');
        return data.users || [];
    }

    // Invites
    async getInvites() {
        const data = await this.request('/invites');
        return data.invites || [];
    }

    async generateInvites(formData) {
        const expiresInDays = parseInt(formData.expiresIn) || 30;
        const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();

        return this.request('/invites', {
            method: 'POST',
            body: JSON.stringify({
                count: parseInt(formData.count) || 1,
                label: formData.label || '',
                maxUses: parseInt(formData.maxUses) || 1,
                expiresAt,
            }),
        });
    }

    async disableInvite(id) {
        return this.request(`/invites/${id}`, {
            method: 'DELETE',
        });
    }

    async deleteInvite(id) {
        return this.request(`/invites/${id}`, {
            method: 'DELETE',
        });
    }

    // Users
    async getUsers(params = {}) {
        const query = new URLSearchParams(params).toString();
        const data = await this.request(`/users${query ? '?' + query : ''}`);
        return data.users || [];
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
        const data = await this.request('/backups');
        return data.backups || [];
    }

    async createFullBackup() {
        return this.request('/backup/all', {
            method: 'POST',
            body: JSON.stringify({ note: 'Admin full backup' }),
        });
    }

    async downloadBackup() {
        const url = `${API_BASE}/backup/all`;
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
        a.download = `calorie-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
    }
}

// Create global API instance
window.adminAPI = new AdminAPI();
