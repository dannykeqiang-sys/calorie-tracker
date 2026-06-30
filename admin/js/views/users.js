/**
 * Users View - User Management
 */

const UsersView = {
    async render(container) {
        // Check if we're showing detail view
        const hash = window.location.hash;
        if (hash.startsWith('#users/detail/')) {
            const userId = hash.split('/')[2];
            await this.renderDetail(container, userId);
            return;
        }

        await this.renderList(container);
    },

    async renderList(container) {
        window.adminApp.showLoading(container);

        try {
            const users = await window.adminAPI.getUsers();

            container.innerHTML = `
                <div class="fade-in space-y-6">
                    <!-- Search and Filter -->
                    <div class="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        <div class="flex flex-col md:flex-row gap-4">
                            <div class="flex-1">
                                <input
                                    type="text"
                                    id="search-input"
                                    placeholder="搜索用户昵称或邀请码..."
                                    class="input-field w-full"
                                >
                            </div>
                            <div>
                                <select id="status-filter" class="input-field w-full md:w-auto">
                                    <option value="">所有状态</option>
                                    <option value="active">活跃</option>
                                    <option value="inactive">不活跃</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Users Table -->
                    <div class="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        <h3 class="text-lg font-bold text-white mb-4">用户列表</h3>
                        <div class="overflow-x-auto">
                            <table class="w-full">
                                <thead>
                                    <tr class="text-left text-gray-400 text-sm border-b border-gray-700">
                                        <th class="pb-3 font-medium">用户</th>
                                        <th class="pb-3 font-medium">邀请码</th>
                                        <th class="pb-3 font-medium">注册时间</th>
                                        <th class="pb-3 font-medium">最后登录</th>
                                        <th class="pb-3 font-medium">记录天数</th>
                                        <th class="pb-3 font-medium">状态</th>
                                        <th class="pb-3 font-medium">操作</th>
                                    </tr>
                                </thead>
                                <tbody id="users-tbody" class="divide-y divide-gray-700">
                                    ${users.map(user => this.renderUserRow(user)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            this.attachListHandlers(users);
        } catch (error) {
            window.adminApp.showError(container, '加载用户列表失败: ' + error.message);
        }
    },

    renderUserRow(user) {
        // Backend fields: id, nickname, invite_code, created_at, last_login_at, is_active, record_count
        const nickname = user.nickname || '未命名';
        const initials = nickname.charAt(0).toUpperCase();
        const isActive = this.isRecentlyActive(user.last_login_at);

        return `
            <tr class="table-row">
                <td class="py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                            ${initials}
                        </div>
                        <div>
                            <p class="text-white font-medium">${nickname}</p>
                            <p class="text-gray-400 text-sm">ID: ${user.id}</p>
                        </div>
                    </div>
                </td>
                <td class="py-4">
                    <code class="text-orange-400 font-mono text-sm">${user.invite_code || '-'}</code>
                </td>
                <td class="py-4 text-gray-400 text-sm">${user.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '-'}</td>
                <td class="py-4 text-gray-400 text-sm">${user.last_login_at ? new Date(user.last_login_at).toLocaleDateString('zh-CN') : '从未登录'}</td>
                <td class="py-4">
                    <span class="text-white font-semibold">${user.record_count || 0}</span>
                    <span class="text-gray-400 text-sm"> 天</span>
                </td>
                <td class="py-4">
                    <span class="status-badge ${isActive ? 'active' : 'inactive'}">${isActive ? '活跃' : '不活跃'}</span>
                </td>
                <td class="py-4">
                    <button class="btn-secondary text-sm view-detail-btn" data-user-id="${user.id}">
                        查看详情
                    </button>
                </td>
            </tr>
        `;
    },

    isRecentlyActive(lastLogin) {
        if (!lastLogin) return false;
        const diff = Date.now() - new Date(lastLogin).getTime();
        return diff < 7 * 24 * 60 * 60 * 1000; // 7 days
    },

    attachListHandlers(users) {
        // Search
        const searchInput = document.getElementById('search-input');
        const tbody = document.getElementById('users-tbody');

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const statusFilter = document.getElementById('status-filter').value;
            this.filterUsers(users, query, statusFilter, tbody);
        });

        // Status filter
        document.getElementById('status-filter').addEventListener('change', (e) => {
            const query = searchInput.value.toLowerCase();
            this.filterUsers(users, query, e.target.value, tbody);
        });

        // View detail buttons
        document.querySelectorAll('.view-detail-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.dataset.userId;
                window.location.hash = `#users/detail/${userId}`;
            });
        });
    },

    filterUsers(users, query, statusFilter, tbody) {
        let filtered = users;

        if (query) {
            filtered = filtered.filter(user =>
                (user.nickname && user.nickname.toLowerCase().includes(query)) ||
                (user.invite_code && user.invite_code.toLowerCase().includes(query))
            );
        }

        if (statusFilter) {
            filtered = filtered.filter(user => {
                const isActive = this.isRecentlyActive(user.last_login_at);
                return statusFilter === 'active' ? isActive : !isActive;
            });
        }

        tbody.innerHTML = filtered.map(user => this.renderUserRow(user)).join('');

        // Re-attach detail handlers
        document.querySelectorAll('.view-detail-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.dataset.userId;
                window.location.hash = `#users/detail/${userId}`;
            });
        });
    },

    async renderDetail(container, userId) {
        window.adminApp.showLoading(container);

        try {
            const data = await window.adminAPI.getUserDetail(userId);
            // Backend returns: { user: {...}, recentRecords: [...] }
            const user = data.user || {};
            const recentRecords = data.recentRecords || [];

            const nickname = user.nickname || '未命名';
            const initials = nickname.charAt(0).toUpperCase();

            container.innerHTML = `
                <div class="fade-in space-y-6">
                    <!-- Back Button -->
                    <button onclick="window.location.hash='#users'" class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                        </svg>
                        返回列表
                    </button>

                    <!-- User Profile -->
                    <div class="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        <div class="flex items-start gap-6">
                            <div class="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold">
                                ${initials}
                            </div>
                            <div class="flex-1">
                                <h2 class="text-2xl font-bold text-white mb-2">${nickname}</h2>
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <p class="text-gray-400">用户 ID</p>
                                        <p class="text-white">${user.id}</p>
                                    </div>
                                    <div>
                                        <p class="text-gray-400">邀请码</p>
                                        <p class="text-orange-400 font-mono">${user.invite_code || '无'}</p>
                                    </div>
                                    <div>
                                        <p class="text-gray-400">注册时间</p>
                                        <p class="text-white">${user.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : '-'}</p>
                                    </div>
                                    <div>
                                        <p class="text-gray-400">最后登录</p>
                                        <p class="text-white">${user.last_login_at ? new Date(user.last_login_at).toLocaleString('zh-CN') : '从未'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Stats -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="bg-gray-800 rounded-xl border border-gray-700 p-6">
                            <h3 class="text-gray-400 text-sm mb-2">记录天数</h3>
                            <p class="text-3xl font-bold text-white">${user.record_count || 0}</p>
                        </div>
                        <div class="bg-gray-800 rounded-xl border border-gray-700 p-6">
                            <h3 class="text-gray-400 text-sm mb-2">账号状态</h3>
                            <p class="text-3xl font-bold ${user.is_active ? 'text-green-400' : 'text-red-400'}">${user.is_active ? '正常' : '已禁用'}</p>
                        </div>
                    </div>

                    <!-- Recent Records -->
                    <div class="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        <h3 class="text-lg font-bold text-white mb-4">最近 10 天记录</h3>
                        <div class="space-y-3">
                            ${recentRecords.length > 0
                                ? recentRecords.map(record => this.renderRecordItem(record)).join('')
                                : '<p class="text-gray-400 text-center py-8">暂无记录</p>'
                            }
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        <h3 class="text-lg font-bold text-white mb-4">操作</h3>
                        <div class="flex gap-4">
                            <button class="btn-primary" id="backup-user-btn">
                                创建用户备份
                            </button>
                        </div>
                    </div>
                </div>
            `;

            this.attachDetailHandlers(userId);
        } catch (error) {
            window.adminApp.showError(container, '加载用户详情失败: ' + error.message);
        }
    },

    renderRecordItem(record) {
        // Backend returns: { date, data: {...}, updated_at }
        // data contains meal info, intake, burn etc.
        const data = record.data || {};
        const mealCount = data.meals ? data.meals.length : 0;
        const intake = data.totalIntake || data.total_intake || 0;

        return `
            <div class="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                    <p class="text-white font-medium">${record.date || '-'}</p>
                    <p class="text-gray-400 text-sm">${mealCount} 餐</p>
                </div>
                <div class="text-right">
                    <p class="text-orange-400 font-semibold">${intake} kcal</p>
                    <p class="text-gray-400 text-sm">摄入</p>
                </div>
            </div>
        `;
    },

    attachDetailHandlers(userId) {
        document.getElementById('backup-user-btn').addEventListener('click', async () => {
            try {
                await window.adminAPI.backupUser(userId);
                window.adminApp.showToast('用户备份创建成功', 'success');
            } catch (error) {
                window.adminApp.showToast('备份失败: ' + error.message, 'error');
            }
        });
    }
};
