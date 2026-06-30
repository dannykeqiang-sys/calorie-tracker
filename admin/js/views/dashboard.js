/**
 * Dashboard View
 */

const DashboardView = {
    async render(container) {
        window.adminApp.showLoading(container);

        try {
            const [statsData, recentUsers, activeUsers] = await Promise.all([
                window.adminAPI.getStats(),
                window.adminAPI.getRecentUsers(),
                window.adminAPI.getActiveUsers(),
            ]);

            const stats = statsData.stats || {};

            container.innerHTML = `
                <div class="fade-in space-y-6">
                    <!-- Stats Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        ${this.renderStatCard('总用户数', stats.totalUsers || 0, 'users', '#3b82f6')}
                        ${this.renderStatCard('活跃用户 (7天)', stats.activeUsersLast7Days || 0, 'activity', '#22c55e')}
                        ${this.renderStatCard('总记录天数', stats.totalRecords || 0, 'calendar', '#f97316')}
                        ${this.renderStatCard('邀请码剩余', (stats.totalInviteCodes || 0) - (stats.usedInviteCodes || 0), 'key', '#a855f7')}
                    </div>

                    <!-- Recent Users Lists -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- Recent Registered -->
                        <div class="bg-gray-800 rounded-xl border border-gray-700 p-6">
                            <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                                </svg>
                                最近注册
                            </h3>
                            <div class="space-y-3">
                                ${recentUsers.length > 0 ? recentUsers.map(user => this.renderUserItem(user)).join('') : '<p class="text-gray-400 text-center py-4">暂无用户</p>'}
                            </div>
                        </div>

                        <!-- Recent Active -->
                        <div class="bg-gray-800 rounded-xl border border-gray-700 p-6">
                            <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                </svg>
                                最近活跃
                            </h3>
                            <div class="space-y-3">
                                ${activeUsers.length > 0 ? activeUsers.map(user => this.renderUserItem(user)).join('') : '<p class="text-gray-400 text-center py-4">暂无活跃用户</p>'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            window.adminApp.showError(container, '加载仪表盘失败: ' + error.message);
        }
    },

    renderStatCard(title, value, icon, color) {
        const icons = {
            users: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>',
            activity: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>',
            calendar: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>',
            key: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>',
        };

        return `
            <div class="stat-card bg-gray-800 rounded-xl border border-gray-700 p-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="w-12 h-12 rounded-lg flex items-center justify-center" style="background-color: ${color}20">
                        <svg class="w-6 h-6" style="color: ${color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            ${icons[icon]}
                        </svg>
                    </div>
                </div>
                <h3 class="text-3xl font-bold text-white mb-1">${value}</h3>
                <p class="text-gray-400 text-sm">${title}</p>
            </div>
        `;
    },

    renderUserItem(user) {
        const nickname = user.nickname || '未命名';
        const initials = nickname.charAt(0).toUpperCase();
        return `
            <div class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer" onclick="window.location.hash='#users/detail/${user.id}'">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                    ${initials}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-white font-medium truncate">${nickname}</p>
                    <p class="text-gray-400 text-sm">${user.invite_code || '无邀请码'}</p>
                </div>
                <div class="text-right">
                    <p class="text-gray-400 text-xs">${this.formatDate(user.created_at)}</p>
                </div>
            </div>
        `;
    },

    formatDate(dateStr) {
        if (!dateStr) return '未知';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        return date.toLocaleDateString('zh-CN');
    }
};
