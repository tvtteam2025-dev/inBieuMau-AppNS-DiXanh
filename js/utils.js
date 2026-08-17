const Utils = {
    getQueryParams: function () {
        const params = new URLSearchParams(window.location.search);
        return {
            template: params.get('template'),
            id: params.get('id')
        };
    },

    updateUrlParam: function (key, value) {
        const url = new URL(window.location);
        url.searchParams.set(key, value);
        window.history.pushState({}, '', url);
    },

    showStatus: function (message, type = 'error') {
        const el = document.getElementById('status-message');
        el.textContent = message;
        el.className = `status-message ${type}`;
    },


    hideStatus: function () {
        document.getElementById('status-message').className = 'status-message';
    },

    copyToClipboard: function (text) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Đã copy link thành công!');
        }).catch(err => {
            console.error('Lỗi khi copy', err);
        });
    }
};
