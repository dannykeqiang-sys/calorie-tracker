/**
 * Login View
 */

const LoginView = {
    render() {
        const form = document.getElementById('login-form');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const submitBtn = form.querySelector('button[type="submit"]');

            submitBtn.disabled = true;
            submitBtn.textContent = '登录中...';

            try {
                await window.adminAPI.login(password);
                window.location.hash = '#dashboard';
            } catch (error) {
                window.adminApp.showToast(error.message || '登录失败', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '登录';
            }
        });
    }
};
