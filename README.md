# Ứng dụng In ấn Biểu Mẫu Động (Static Web App + Google Apps Script)

Dự án này là một webapp siêu nhẹ giúp đọc dữ liệu từ Google Sheets (3 sheet quan hệ qua id) và điền trực tiếp vào các File HTML (Biểu mẫu), hỗ trợ In A4, tải PDF, xuất Word.

## Kiến trúc
- **Frontend**: HTML/CSS/JavaScript thuần, triển khai dạng Static Website trên Vercel. Không dùng framework (React/Vue/Node).
- **Backend API**: Hệ thống dùng **Google Apps Script Web App** trả JSON cho frontend đọc. Kết nối thẳng vào Google Sheet của bạn.
- **Nguồn dữ liệu**: Google Sheets với 4 bảng: `HOP_DONG_HOP_TAC`, `DANH_SACH_KHACH_HANG`, `DANH_SACH_PHUONG_TIEN`, và bảng mật khẩu `TAI_KHOAN`.

## Hướng dẫn triển khai (Bước từng bước)

### Bước 1: Cài đặt Backend (Google Apps Script)
1. Mở file Google Sheets chứa dữ liệu của bạn. Đảm bảo tên 4 sheet chuẩn xác: `DANH_SACH_KHACH_HANG`, `DANH_SACH_PHUONG_TIEN`, `HOP_DONG_HOP_TAC` và `TAI_KHOAN`.
2. Trong sheet `TAI_KHOAN`, bắt buộc có 2 cột tên là: `tenDangNhap` và `matKhau` (ở hàng 1).
3. Trên Menu bar, chọn **Extensions (Tiện ích mở rộng)** > **Apps Script**.
3. Copy toàn bộ nội dung trong file `Code.gs` (của dự án này) và dán đè vào trình soạn thảo Apps Script.
4. Đổi hằng số `SPREADSHEET_ID` trong code bằng ID thật từ URL file Sheets của bạn (phần mã sau `/d/` và trước `/edit`).
5. Ở góc trên phải, bấm **Deploy (Triển khai)** > **New deployment (Triển khai mới)**.
6. Chọn loại là **Web app**.
   - Execute as: `Me (Email của bạn)`
   - Who has access: `Anyone (Bất kỳ ai)`
7. Bấm Deploy (cấp quyền truy cập nếu Google hỏi). Copy **Web app URL** được tạo ra (Dạng `https://script.google.com/macros/s/xxxxxxxxxxx/exec`).

### Bước 2: Cài đặt Frontend URL
1. Mở file `js/api.js` trong thư mục dự án này.
2. Sửa dòng đầu tiên thành URL Google Apps Script của bạn:
   ```javascript
   const API_URL = 'https://script.google.com/macros/s/xxxxxxxxxxx/exec';
   ```

### Bước 3: Deploy Frontend lên Vercel
1. Upload toàn bộ thư mục dự án (index.html, styles.css, folder /js, folder /templates, ...) lên Github repository của bạn.
2. Đăng nhập [Vercel](https://vercel.com).
3. Bấm **Add New Project** > Chọn Repository vừa tạo > Bấm **Deploy**.
4. (Vì là HTML thuần, Vercel không cần build step nào cả).

## Cách sử dụng hiện tại

URL của ứng dụng sẽ nhận tham số: `id`, `template`, `username` (không bắt buộc), `password` (không bắt buộc).
- `id`: Mã ID của bản ghi bảng HOP_DONG_HOP_TAC.
- `template`: Tên file html template (bỏ đuôi `.html`) trong thư mục `/templates`.
- Nhập trực tiếp tài khoản mật khẩu trên popup nếu không có sẵn ở URL.

**Ví dụ URL thực tế:**
`https://[id-vercel-cua-ban].vercel.app/?template=hop_dong_hop_tac&id=123`
hoặc kèm mật khẩu bỏ qua đăng nhập: 
`https://[id-vercel-cua-ban].vercel.app/?template=hop_dong_hop_tac&id=123&username=admin&password=123`

## Cách điều chỉnh dự án

### Cách thêm Template mới
1. Tạo một file `.html` trong thư mục `/templates/`, ví dụ `bien_ban_ban_giao.html`.
2. Trong nội dung file, dùng cú pháp `{{tenCotTrongSheet}}` ở bất kỳ đâu muốn chèn dữ liệu.
3. Mở file `index.html` thêm `<option value="bien_ban_ban_giao">Biên bản bàn giao</option>` vào thẻ `<select>`.
4. Gọi URL với `?template=bien_ban_ban_giao`.

### Cách thêm cột dữ liệu mới (Field)
Bạn chỉ cần thêm Cột vào bảng tính Google Sheets (hàng số 1 là tên trường). Ví dụ tạo cột `soHieuGiaoDich`. Ở file template HTML bạn chỉ cần gọi `{{soHieuGiaoDich}}` là nó tự động lấy dữ liệu. Quá trình ghép cột là hoàn toàn tự động nhờ việc đọc dữ liệu động ở dòng tiêu đề (Header).

## Giới hạn
- Giải pháp Word Export chỉ là bọc trang HTML ngụy trang thành Extension .doc để MS Word đọc. Khi mở file người dùng có thể nhận được cảnh báo, chỉ cần nhấn Yes để mở.
- Giải pháp PDF sử dụng html2canvas nên văn bản trong PDF sẽ dưới dạng ảnh (không highlight chữ để copy). Phương án này tối ưu cho việc in ấn nhanh.
