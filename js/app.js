document.addEventListener('DOMContentLoaded', () => {
    // Các phần tử giao diện
    const templateSelect = document.getElementById('template-select');
    const recordIdInput = document.getElementById('record-id');
    const dataPreview = document.getElementById('data-preview');
    const documentContent = document.getElementById('document-content');

    // Nút bấm
    const btnReload = document.getElementById('btn-reload');
    const btnWord = document.getElementById('btn-word');

    // Login Elements
    const loginModal = document.getElementById('login-modal');
    const loginUsernameInput = document.getElementById('login-username');
    const loginPasswordInput = document.getElementById('login-password');
    const btnLogin = document.getElementById('btn-login');
    const loginError = document.getElementById('login-error');

    // Trạng thái hiện tại
    let currentData = null;
    let currentId = null;

    // Check Auth
    function checkAuth() {
        const params = Utils.getQueryParams();
        let user = sessionStorage.getItem('auth_user');
        let pass = sessionStorage.getItem('auth_pass');

        // Nếu có trên URL, ưu tiên URL và lưu vào session
        if (params.username) {
            user = params.username;
            sessionStorage.setItem('auth_user', user);
        }
        if (params.password) {
            pass = params.password;
            sessionStorage.setItem('auth_pass', pass);
        }

        return { user, pass };
    }

    function showLogin(errorMsg = '') {
        loginModal.style.display = 'flex';
        if (errorMsg) {
            loginError.textContent = errorMsg;
            loginError.style.display = 'block';
        } else {
            loginError.style.display = 'none';
        }
    }

    // Khởi tạo
    async function init() {
        // Kiểm tra Auth trước
        const auth = checkAuth();
        if (!auth.user || !auth.pass) {
            showLogin();
            return;
        }

        const params = Utils.getQueryParams();
        const template = params.template || templateSelect.value;
        const id = params.id;

        templateSelect.value = template;

        if (!id) {
            Utils.showStatus('Vui lòng truyền id trên URL (VD: ?id=123)', 'error');
            recordIdInput.value = '';
            documentContent.innerHTML = 'Vui lòng cung cấp tham số URL hợp lệ (ví dụ: ?template=hop_dong_hop_tac&id=123)';
            return;
        }

        recordIdInput.value = id;
        await loadData(id, template);
    }

    async function renderTemplate(templateName) {
        try {
            documentContent.innerHTML = 'Đang tải tệp Word gốc...';
            await TemplateEngine.renderDocx(templateName, currentData, documentContent);
        } catch (error) {
            Utils.showStatus(error.message, 'error');
            documentContent.innerHTML = `<div class="status-message error" style="display:block;">${error.message}</div>`;
        }
    }

    // Gọi API và render HTML
    async function loadData(id, template) {
        // Tối ưu: Nếu đã có dữ liệu của chính ID này rồi, chỉ cần render lại template
        if (currentData && currentId === id) {
            await renderTemplate(template);
            return;
        }

        Utils.hideStatus();
        documentContent.innerHTML = 'Đang tải dữ liệu...';
        dataPreview.textContent = 'Đang gọi API...';

        try {
            const auth = checkAuth();

            // Lấy data từ Apps Script
            const response = await API.fetchData(id, template, auth.user, auth.pass);

            if (!response.success) {
                if (response.auth_failed) {
                    sessionStorage.removeItem('auth_user');
                    sessionStorage.removeItem('auth_pass');
                    showLogin(response.message);
                    return;
                }

                Utils.showStatus(response.message || 'Lỗi API không xác định', 'error');
                dataPreview.textContent = JSON.stringify(response, null, 2);
                documentContent.innerHTML = 'Lỗi lấy dữ liệu từ hệ thống.';
                return;
            }

            if (response.warnings && response.warnings.length > 0) {
                Utils.showStatus('Cảnh báo: ' + response.warnings.join(' ; '), 'warning');
            } else {
                Utils.showStatus('Tải dữ liệu thành công!', 'success');
                setTimeout(Utils.hideStatus, 3000);
            }

            currentData = response.data;
            currentId = id;
            dataPreview.textContent = JSON.stringify(response.data, null, 2);

            // Lấy giao diện template và Render
            await renderTemplate(template);

        } catch (error) {
            Utils.showStatus(error.message, 'error');
            documentContent.innerHTML = 'Hệ thống gọi API thất bại: ' + error.message;
        }
    }

    // Lắng nghe sự kiện
    btnReload.addEventListener('click', () => {
        const id = recordIdInput.value;
        const template = templateSelect.value;
        if (id) {
            currentData = null; // Ép tải lại từ đầu
            currentId = null;
            loadData(id, template);
        }
    });

    templateSelect.addEventListener('change', (e) => {
        const newTemplate = e.target.value;
        const id = recordIdInput.value;
        Utils.updateUrlParam('template', newTemplate);
        if (id) {
            loadData(id, newTemplate);
        }
    });


    btnWord.addEventListener('click', () => {
        const id = recordIdInput.value;
        const template = templateSelect.value;
        ExportWord.generate(`${template}_${id}`);
    });




    btnLogin.addEventListener('click', () => {
        const u = loginUsernameInput.value.trim();
        const p = loginPasswordInput.value.trim();
        if (!u || !p) {
            loginError.textContent = 'Vui lòng nhập đầy đủ tên và mật khẩu';
            loginError.style.display = 'block';
            return;
        }
        sessionStorage.setItem('auth_user', u);
        sessionStorage.setItem('auth_pass', p);
        loginModal.style.display = 'none';
        init();
    });

    // Cập nhật lại Utils để nhận params username password
    const originalGetParams = Utils.getQueryParams;
    Utils.getQueryParams = function () {
        const p = originalGetParams();
        const urlParams = new URLSearchParams(window.location.search);
        p.username = urlParams.get('username');
        p.password = urlParams.get('password');
        return p;
    };

    // Chạy app
    init();
});
