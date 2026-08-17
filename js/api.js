const API_URL = 'https://script.google.com/macros/s/AKfycbxFpL4A7xn8xpt9f86JZr_8JIN9YWzUBAwXioxXlEmwETbW3p_CnrfWjjXLZXQEMuPuvQ/exec';

const API = {
    fetchData: async function (id, template, username, password) {
        if (!API_URL || API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
            throw new Error('Vui lòng cấu hình API_URL trong js/api.js');
        }

        const url = `${API_URL}?id=${encodeURIComponent(id)}&template=${encodeURIComponent(template)}&username=${encodeURIComponent(username || '')}&password=${encodeURIComponent(password || '')}`;

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
