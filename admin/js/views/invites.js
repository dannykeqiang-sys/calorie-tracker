/**
 * Invites View - Invite Code Management
 */

const InvitesView = {
    async render(container) {
        window.adminApp.showLoading(container);

        try {
            const invites = await window.adminAPI.getInvites();

            container.innerHTML = `
                <div class="fade-in space-y-6">
                    <!-- Generate Form -->
                    <div class="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                            </svg>
                            生成邀请码
                        </h3>
                        <form id="generate-form" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">数量</label>
                                <input type="number" name="count" value="1" min="1" max="100" class="input-field w-full" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">备注</label>
                                <input type="text" name="label" placeholder="可选备注" class="input-field w-full">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">最大使用次数</label>
                                <input type="number" name="maxUses" value="1" min="1" class="input-field w-full" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">过期时间（天）</label>
                                <input type="number" name="expiresIn" value="30" min="1" class="input-field w-full" required>
                            </div>
                            <div class="md:col-span-2 lg:col-span-4">
                                <button type="submit" class="btn-primary w-full md:w-auto">
                                    生成邀请码
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- New Codes Display -->
                    <div id="new-codes" class="hidden"></div>

                    <!-- Invites List -->
                    <div class="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        <h3 class="text-lg font-bold text-white mb-4">邀请码列表</h3>
                        <div class="overflow-x-auto">
                            <table class="w-full">
                                <thead>
                                    <tr class="text-left text-gray-400 text-sm border-b border-gray-700">
                                        <th class="pb-3 font-medium">邀请码</th>
                                        <th class="pb-3 font-medium">备注</th>
                                        <th class="pb-3 font-medium">使用情况</th>
                                        <th class="pb-3 font-medium">状态</th>
                                        <th class="pb-3 font-medium">创建时间</th>
                                        <th class="pb-3 font-medium">过期时间</th>
                                        <th class="pb-3 font-medium">操作</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-700">
                                    ${invites.map(invite => this.renderInviteRow(invite)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            this.attachEventHandlers();
        } catch (error) {
            window.adminApp.showError(container, '加载邀请码失败: ' + error.message);
        }
    },

    renderInviteRow(invite) {
        const isExpired = new Date(invite.expiresAt) < new Date();
        const isDisabled = invite.disabled;
        const status = isExpired ? '已过期' : isDisabled ? '已禁用' : '活跃';
        const statusClass = isExpired || isDisabled ? 'inactive' : 'active';

        return `
            <tr class="table-row">
                <td class="py-4">
                    <div class="flex items-center gap-2">
                        <code class="text-orange-400 font-mono">${invite.code}</code>
                        <button class="copy-btn text-gray-400 hover:text-white" data-code="${invite.code}" title="复制">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                            </svg>
                        </button>
                    </div>
                </td>
                <td class="py-4 text-gray-300">${invite.label || '-'}</td>
                <td class="py-4">
                    <span class="text-white">${invite.usedCount}</span>
                    <span class="text-gray-400">/ ${invite.maxUses}</span>
                </td>
                <td class="py-4">
                    <span class="status-badge ${statusClass}">${status}</span>
                </td>
                <td class="py-4 text-gray-400 text-sm">${new Date(invite.createdAt).toLocaleDateString('zh-CN')}</td>
                <td class="py-4 text-gray-400 text-sm">${new Date(invite.expiresAt).toLocaleDateString('zh-CN')}</td>
                <td class="py-4">
                    <div class="flex gap-2">
                        ${!isDisabled && !isExpired ? `
                            <button class="btn-secondary text-sm disable-btn" data-code="${invite.code}">禁用</button>
                        ` : ''}
                        <button class="btn-danger text-sm delete-btn" data-code="${invite.code}">删除</button>
                    </div>
                </td>
            </tr>
        `;
    },

    attachEventHandlers() {
        // Generate form
        document.getElementById('generate-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);

            try {
                const result = await window.adminAPI.generateInvites(data);
                this.showNewCodes(result.codes);
                window.adminApp.showToast('邀请码生成成功', 'success');
                this.render(document.getElementById('content'));
            } catch (error) {
                window.adminApp.showToast('生成失败: ' + error.message, 'error');
            }
        });

        // Copy buttons
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const code = btn.dataset.code;
                try {
                    await navigator.clipboard.writeText(code);
                    btn.classList.add('copied');
                    btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
                    setTimeout(() => {
                        btn.classList.remove('copied');
                        btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>';
                    }, 2000);
                } catch (error) {
                    window.adminApp.showToast('复制失败', 'error');
                }
            });
        });

        // Disable buttons
        document.querySelectorAll('.disable-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const code = btn.dataset.code;
                if (!confirm(`确定要禁用邀请码 ${code} 吗？`)) return;

                try {
                    await window.adminAPI.disableInvite(code);
                    window.adminApp.showToast('邀请码已禁用', 'success');
                    this.render(document.getElementById('content'));
                } catch (error) {
                    window.adminApp.showToast('禁用失败: ' + error.message, 'error');
                }
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const code = btn.dataset.code;
                if (!confirm(`确定要删除邀请码 ${code} 吗？此操作不可恢复。`)) return;

                try {
                    await window.adminAPI.deleteInvite(code);
                    window.adminApp.showToast('邀请码已删除', 'success');
                    this.render(document.getElementById('content'));
                } catch (error) {
                    window.adminApp.showToast('删除失败: ' + error.message, 'error');
                }
            });
        });
    },

    showNewCodes(codes) {
        const container = document.getElementById('new-codes');
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="bg-gray-800 rounded-xl border border-green-700 p-6">
                <h3 class="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    新生成的邀请码
                </h3>
                <div class="space-y-2">
                    ${codes.map(code => `
                        <div class="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
                            <code class="text-orange-400 font-mono flex-1">${code}</code>
                            <button class="copy-btn text-gray-400 hover:text-white" data-code="${code}">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                </svg>
                            </button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-secondary mt-4" onclick="document.getElementById('new-codes').classList.add('hidden')">
                    关闭
                </button>
            </div>
        `;

        // Re-attach copy handlers for new codes
        container.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const code = btn.dataset.code;
                try {
                    await navigator.clipboard.writeText(code);
                    btn.classList.add('copied');
                    setTimeout(() => btn.classList.remove('copied'), 2000);
                } catch (error) {
                    window.adminApp.showToast('复制失败', 'error');
                }
            });
        });
    }
};
