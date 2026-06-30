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

                    <!-- Download Latest -->
                    <div class="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                            </svg>
                            下载完整数据
                        </h3>
                        <p class="text-gray-400 mb-4">实时导出所有用户数据（生成并下载 JSON 文件）。</p>
                        <button id="download-latest-btn" class="btn-secondary">
                            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                            </svg>
                            下载完整备份
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
        // Backend fields: id, user_id, created_at, note, data_size, user_nickname
        const date = backup.created_at ? new Date(backup.created_at) : new Date();
        const sizeKB = ((backup.data_size || 0) / 1024).toFixed(2);

        return `
            <div class="flex items-center justify-between p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
                        </svg>
                    </div>
                    <div>
                        <p class="text-white font-medium">备份 #${backup.id} ${backup.user_nickname ? `- ${backup.user_nickname}` : ''}</p>
                        <p class="text-gray-400 text-sm">
                            ${date.toLocaleString('zh-CN')} · ${sizeKB} KB
                        </p>
                        ${backup.note ? `<p class="text-gray-500 text-xs mt-1">${backup.note}</p>` : ''}
                    </div>
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
                const result = await window.adminAPI.createFullBackup();
                window.adminApp.showToast(result.message || '备份创建成功', 'success');
                this.render(document.getElementById('content'));
            } catch (error) {
                window.adminApp.showToast('备份失败: ' + error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = '立即备份所有数据';
            }
        });

        // Download latest backup
        const downloadBtn = document.getElementById('download-latest-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async () => {
                downloadBtn.disabled = true;
                downloadBtn.textContent = '正在生成...';

                try {
                    await window.adminAPI.downloadBackup();
                    window.adminApp.showToast('下载成功', 'success');
                } catch (error) {
                    window.adminApp.showToast('下载失败: ' + error.message, 'error');
                } finally {
                    downloadBtn.disabled = false;
                    downloadBtn.innerHTML = `
                        <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                        </svg>
                        下载完整备份
                    `;
                }
            });
        }
    }
};
