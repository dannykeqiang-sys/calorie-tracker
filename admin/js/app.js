/**
 * Main Application - Router and View Management
 */

class AdminApp {
    constructor() {
        this.currentView = null;
        this.init();
    }

    init() {
        // Setup hash routing
        window.addEventListener('hashchange', () => this.handleRoute());

        // Setup logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            window.adminAPI.logout();
            window.location.hash = '#login';
        });

        // Setup navigation active states
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });

        // Initial route
        this.handleRoute();
    }

    handleRoute() {
        const hash = window.location.hash.slice(1) || 'login';

        // Check authentication
        if (hash !== 'login' && !window.adminAPI.token) {
            window.location.hash = '#login';
            return;
        }

        // Show/hide screens
        const loginScreen = document.getElementById('login-screen');
        const app = document.getElementById('app');

        if (hash === 'login') {
            loginScreen.classList.remove('hidden');
            app.classList.add('hidden');
        } else {
            loginScreen.classList.add('hidden');
            app.classList.remove('hidden');
        }

        // Render view
        this.renderView(hash);
    }

    renderView(viewName) {
        const content = document.getElementById('content');
        const pageTitle = document.getElementById('page-title');

        // Update navigation active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === `#${viewName}`) {
                item.classList.add('active');
            }
        });

        // Update page title
        const titles = {
            login: '登录',
            dashboard: '仪表盘',
            invites: '邀请码管理',
            users: '用户管理',
            backups: '数据备份',
        };
        pageTitle.textContent = titles[viewName] || '管理后台';

        // Render view
        switch (viewName) {
            case 'login':
                LoginView.render();
                break;
            case 'dashboard':
                DashboardView.render(content);
                break;
            case 'invites':
                InvitesView.render(content);
                break;
            case 'users':
                UsersView.render(content);
                break;
            case 'backups':
                BackupsView.render(content);
                break;
            default:
                content.innerHTML = '<div class="text-center py-12 text-gray-400">页面不存在</div>';
        }

        this.currentView = viewName;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    showLoading(container) {
        container.innerHTML = `
            <div class="flex items-center justify-center py-12">
                <div class="spinner"></div>
            </div>
        `;
    }

    showError(container, message) {
        container.innerHTML = `
            <div class="text-center py-12">
                <svg class="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-red-400 text-lg">${message}</p>
            </div>
        `;
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.adminApp = new AdminApp();
    });
} else {
    window.adminApp = new AdminApp();
}
