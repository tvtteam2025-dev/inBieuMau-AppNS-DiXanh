const API_URL = 'https://script.google.com/macros/s/AKfycbxlX3H7J52Nv0cTWb_dNyEur-2-G_6XyqzvVTv9VQjOplum6e2lRH-iZkhoMrslFAxLeA/exec';

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
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    data && data.message
                        ? data.message
                        : `Lỗi HTTP: ${response.status}`
                );
            }

            if (!data) {
                throw new Error('Máy chủ API không trả về dữ liệu JSON hợp lệ.');
            }

            return data;
        } catch (error) {
            console.error('Lỗi gọi API:', error);
            throw new Error('Không thể kết nối đến máy chủ API: ' + error.message);
        }
    }
};
