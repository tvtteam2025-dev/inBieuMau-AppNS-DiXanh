const ExportPDF = {
    generate: async function(filename) {
        // Tìm tất cả các trang đã được docx-preview vẽ ra
        const pages = document.querySelectorAll('#document-content section.docx');
        
        // Nếu docx-preview chưa vẽ trang nào, fallback sang chụp toàn khung
        if (!pages || pages.length === 0) {
            alert('Không có nội dung để xuất PDF. Hãy đảm bảo file template được tải thành công trước!');
            return;
        }

        // Dùng html2pdf trực tiếp từng trang
        const opt = {
            margin: 0,
            filename: `${filename || 'document'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2, 
                useCORS: true,
                scrollY: 0,
                scrollX: 0,
                windowWidth: pages[0].scrollWidth
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        // Dùng html2pdf để render từng section trang, sau đó nối vào 1 pdf
        const worker = html2pdf().set(opt);
        await worker.from(pages[0]).toCanvas().toPdf();
        
        for (let i = 1; i < pages.length; i++) {
            await worker
                .get('pdf')
                .then(pdf => pdf.addPage())
                .from(pages[i])
                .toCanvas()
                .toPdf();
        }
        
        await worker.get('pdf').then(pdf => pdf.save(`${filename || 'document'}.pdf`));
    }
};
