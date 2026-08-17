const API_URL = 'https://script.google.com/macros/s/AKfycbxhfK89dRsK8Y-rb0C07bPv5SRZYjNmt_pizWaN7RN4cKx_mua0xJa4gYVX0wvq9qR8Mg/exec';

const API = {
    fetchData: async function (id, hopDongId, template, username, password) {
        if (!API_URL || API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
            throw new Error('Vui lòng cấu hình API_URL trong js/api.js');
        }

        const params = new URLSearchParams({
            id: id || '',
            hopDongId: hopDongId || '',
            template: template || '',
            username: username || '',
            password: password || ''
        });
        const url = `${API_URL}?${params.toString()}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Lỗi gọi API:', error);
            throw new Error('Không thể kết nối đến máy chủ API: ' + error.message);
        }
    }
};
