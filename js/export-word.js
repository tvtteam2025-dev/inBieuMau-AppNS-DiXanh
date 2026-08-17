const ExportWord = {
    generate: function(filename) {
        if (!TemplateEngine.lastGeneratedDocxBlob) {
            alert("File Word chưa tải xong hoặc bị lỗi! Không thể tải về.");
            return;
        }
        
        // Tải xuống file lõi cực sạch với bằng FileSaver.js
        window.saveAs(TemplateEngine.lastGeneratedDocxBlob, `${filename || 'document'}.docx`);
    }
};
