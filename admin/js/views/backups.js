/**
 * Backups View - Data Backup Management
 */

const BackupsView = {
    async render(container) {
        window.adminApp.showLoading(container);

        try {
            const backups = await window.adminAPI.getBackups();

            container.innerHTML = `
                <div class="fade-in space-y-6">
                    <!-- Create Backup -->
                    <div class="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                            </svg>
                            创建全量备份
                        </h3>
                        <p class="text-gray-400 mb-4">备份所有用户数据，包括用户信息、记录数据、邀请码等。</p>
                        <button id="create-backup-btn" class="btn-primary">
                            立即备份所有数据
                        </button>
                    </div>

                    <!-- Backup History -->
                    <div class="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        <h3 class="text-lg font-bold text-white mb-4">备份历史</h3>
                        ${backups.length > 0 ? `
                            <div class="space-y-3">
                                ${backups.map(backup => this.renderBackupItem(backup)).join('')}
                            </div>
                        ` : `
                            <div class="empty-state">
                                <svg class="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
                                </svg>
                                <p class="text-gray-400 text-lg mb-2">暂无备份</p>
                                <p class="text-gray-500 text-sm">点击上方按钮创建第一个备份</p>
                            </div>
                        `}
                    </div>
                </div>
            `;

            this.attachEventHandlers();
        } catch (error) {
            window.adminApp.showError(container, '加载备份列表失败: ' + error.message);
        }
    },

    renderBackupItem(backup) {
        const date = new Date(backup.createdAt);
        const sizeKB = (backup.size / 1024).toFixed(2);

        return `
            <div class="flex items-center justify-between p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
                        </svg>
                    </div>
                    <div>
                        <p class="text-white font-medium">备份 ${backup.id}</p>
                        <p class="text-gray-400 text-sm">
                            ${date.toLocaleString('zh-CN')} · ${sizeKB} KB
                        </p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button class="btn-secondary download-btn" data-backup-id="${backup.id}">
                        <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                        </svg>
                        下载
                    </button>
                </div>
            </div>
        `;
    },

    attachEventHandlers() {
        // Create backup button
        document.getElementById('create-backup-btn').addEventListener('click', async () => {
            const btn = document.getElementById('create-backup-btn');
            btn.disabled = true;
            btn.textContent = '正在备份...';

            try {
                await window.adminAPI.createFullBackup();
                window.adminApp.showToast('备份创建成功', 'success');
                this.render(document.getElementById('content'));
            } catch (error) {
                window.adminApp.showToast('备份失败: ' + error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = '立即备份所有数据';
            }
        });

        // Download buttons
        document.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const backupId = btn.dataset.backupId;
                btn.disabled = true;
                const originalText = btn.innerHTML;
                btn.innerHTML = '<span class="spinner inline-block w-4 h-4 border-2 mr-1"></span>下载中...';

                try {
                    await window.adminAPI.downloadBackup(backupId);
                    window.adminApp.showToast('下载成功', 'success');
                } catch (error) {
                    window.adminApp.showToast('下载失败: ' + error.message, 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
            });
        });
    }
};
