const TemplateEngine = {
    // Biến lưu trữ lõi Word ảo (Blob) sau khi nhồi xong để nhả sẵn cho nút Xuất Word Tải
    lastGeneratedDocxBlob: null,

    // Tải template .docx thô (ArrayBuffer) từ thư mục mẫu của bạn
    loadTemplateDocx: async function(templateName) {
        const url = `templates/${templateName}.docx`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Không tìm thấy biểu mẫu: ${templateName}.docx`);
        }
        return await response.arrayBuffer();
    },

    // Quét và cắt các mảng Date giống hệt phiên bản HTML
    parseData: function(data) {
        const enrichedData = { ...data };
        
        // Hàm cộng/trừ ngày, trả về {dd, MM, yyyy, full}
        function addDays(dateStr, days) {
            let d, m, y;
            let match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (match) {
                d = parseInt(match[1]); m = parseInt(match[2]); y = parseInt(match[3]);
            } else {
                match = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
                if (!match) return null;
                y = parseInt(match[1]); m = parseInt(match[2]); d = parseInt(match[3]);
            }
            const dt = new Date(y, m - 1, d);
            dt.setDate(dt.getDate() + days);
            const nd = String(dt.getDate()).padStart(2, '0');
            const nm = String(dt.getMonth() + 1).padStart(2, '0');
            const ny = dt.getFullYear();
            return { dd: nd, MM: nm, yyyy: String(ny), full: `${nd}/${nm}/${ny}` };
        }
        
        // Danh sách cộng/trừ ngày tự động — thêm mục mới vào đây nếu cần
        const DATE_OFFSETS = {
            '_cong10Ngay': 10,
            '_cong15Ngay': 15,
            '_cong30Ngay': 30,
            '_cong60Ngay': 60,
            '_cong90Ngay': 90,
            '_cong1Nam':   365,
            '_tru10Ngay':  -10,
        };
        
        for (let key in data) {
            let val = data[key];
            if (typeof val === 'string') {
                val = val.trim();
                let match = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
                let isDate = false;
                if (match) {
                    isDate = true;
                    enrichedData[key + '_dd'] = match[1].padStart(2, '0');
                    enrichedData[key + '_MM'] = match[2].padStart(2, '0');
                    enrichedData[key + '_yyyy'] = match[3];
                } else {
                    match = val.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
                    if (match) {
                        isDate = true;
                        enrichedData[key + '_dd'] = match[3].padStart(2, '0');
                        enrichedData[key + '_MM'] = match[2].padStart(2, '0');
                        enrichedData[key + '_yyyy'] = match[1];
                    }
                }
                
                // Tự động sinh thêm biến cộng/trừ cho mọi trường ngày
                if (isDate) {
                    for (let suffix in DATE_OFFSETS) {
                        const result = addDays(val, DATE_OFFSETS[suffix]);
                        if (result) {
                            enrichedData[key + suffix]          = result.full;
                            enrichedData[key + suffix + '_dd']  = result.dd;
                            enrichedData[key + suffix + '_MM']  = result.MM;
                            enrichedData[key + suffix + '_yyyy']= result.yyyy;
                        }
                    }
                }
            }
        }
        return enrichedData;
    },

    // Mở lõi Word -> Gài dữ liệu -> Lưu lại biến -> Vẽ ra khung xem nháp
    renderDocx: async function(templateName, rawData, containerElement) {
        try {
            // 1. Kéo lõi nhị phân của file Word mẫu
            const content = await this.loadTemplateDocx(templateName);
            
            // 2. Mở file nén bằng PizZip
            const zip = new PizZip(content);
            
            // 3. Khởi độ Cỗ máy đúc Docxtemplater
            const doc = new window.docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                delimiters: { start: '{{', end: '}}' },
                // Ép xử lý nếu file Word đòi nhét dữ liệu mà mảng Google Sheet trống thì cho in dấu chấm
                nullGetter: function(part) {
                    if (!part.module) return "....................";
                    if (part.module === "rawxml") return "";
                    return "";
                }
            });

            // 4. Nhồi hỗn hợp dữ liệu Data vào
            const finalData = this.parseData(rawData);
            doc.render(finalData);
            
            // 5. Build ra thành phẩm con file .docx có dữ liệu thật (Blob ảo) 
            const blobOut = doc.getZip().generate({
                type: "blob",
                mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });
            
            // Lưu lại cho FileSaver
            this.lastGeneratedDocxBlob = blobOut;
            
            // 6. Gửi cái Blob ảo này cho docx-preview để nó rải ra màn hình thay khung A4 cũ
            containerElement.innerHTML = "<div class='docx-loading-tip'>Đang tạo lưới hình ảnh xem trước văn bản...</div>";
            
            await docx.renderAsync(blobOut, containerElement, null, {
                inWrapper: true,          // Bật wrapper để từng trang là 1 section riêng
                ignoreWidth: false,
                ignoreHeight: false,
                ignoreFonts: false,
                breakPages: true,
                ignoreLastRenderedPageBreak: false,
                experimental: false,
                trimXmlDeclaration: true,
                debug: false
            });
            
        } catch (error) {
            console.error("Chi tiết mã lỗi:", error);
            
            // Xử lý báo lỗi chi tiết của docxtemplater để hiển thị ra cho User
            let errorDetail = error.message;
            if (error.properties && error.properties.errors instanceof Array) {
                const errorMessages = error.properties.errors.map(function (e) {
                    return e.properties ? e.properties.explanation : e.message;
                }).join("\n");
                errorDetail += "\n" + errorMessages;
            }
            
            throw new Error(`\nLỗi đọc file ${templateName}.docx:\n[${errorDetail}]\n(Thường do gõ sai ngoặc {{ }} hoặc bôi đen/chỉnh font chữ nhầm một nửa biến trong Word)`);
        }
    }
};
