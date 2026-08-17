// ==========================================
// CONFIG - THIẾT LẬP ID SPREADSHEET
// ==========================================
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // Thay id google sheet vào đây
const SHEET_KHACH_HANG = 'DANH_SACH_KHACH_HANG';
const SHEET_PHUONG_TIEN = 'DANH_SACH_PHUONG_TIEN';
const SHEET_HOP_DONG = 'HOP_DONG_HOP_TAC';
const SHEET_QUAN_LY_DICH_VU = 'QUAN_LY_DICH_VU';
const SHEET_TAI_KHOAN = 'TAI_KHOAN';

// ==========================================
// API ENDPOINT
// ==========================================
function doGet(e) {
  try {
    const id = e.parameter.id;
    const template = e.parameter.template;
    const username = e.parameter.username;
    const password = e.parameter.password;
    
    // =========== XÁC THỰC (AUTH) ===========
    if (!username || !password) {
      return jsonOutput_({
        success: false,
        auth_failed: true,
        message: "Yêu cầu đăng nhập."
      });
    }

    const taiKhoanList = getSheetDataAsObjects_(SHEET_TAI_KHOAN);
    // Tìm tài khoản
    let validAuth = false;
    for (let i = 0; i < taiKhoanList.length; i++) {
        let sheetUser = String(taiKhoanList[i].tenDangNhap || '').trim();
        let sheetPass = String(taiKhoanList[i].matKhau || '').trim();
        let inputUser = String(username || '').trim();
        let inputPass = String(password || '').trim();
        
        if (sheetUser === inputUser && sheetPass === inputPass) {
            validAuth = true;
            break;
        }
    }

    if (!validAuth) {
      return jsonOutput_({
        success: false,
        auth_failed: true,
        message: "Sai tên đăng nhập hoặc mật khẩu!"
      });
    }
    // ======== KẾT THÚC XÁC THỰC ========

    if (!id) {
      return jsonOutput_({
        success: false,
        message: "Thiếu tham số 'id'"
      });
    }
    
    // Lấy dữ liệu từ các sheet
    const hopDongList = getSheetDataAsObjects_(SHEET_HOP_DONG);
    const khachHangList = getSheetDataAsObjects_(SHEET_KHACH_HANG);
    const phuongTienList = getSheetDataAsObjects_(SHEET_PHUONG_TIEN);
    const quanLyDichVuList = getSheetDataAsObjects_(SHEET_QUAN_LY_DICH_VU);
    
    // Tìm hợp đồng theo ID
    const hopDong = findById_(hopDongList, id);
    
    if (!hopDong) {
      return jsonOutput_({
        success: false,
        message: "Không tìm thấy hợp đồng với ID: " + id
      });
    }
    
    // Tìm khách hàng và phương tiện dựa trên id lưu trong hợp đồng
    const khachHang = findById_(khachHangList, hopDong.id_danhSachKhachHang);
    const phuongTien = findById_(phuongTienList, hopDong.id_danhSachPhuongTien);
    
    // Tìm bản ghi quản lý dịch vụ liên kết với hợp đồng này
    const quanLyDichVu = quanLyDichVuList.find(function(row) {
      return String(row.id_hopDongHopTac || '').trim() === String(id).trim();
    }) || {};
    
    const warnings = [];
    if (!khachHang) warnings.push("Không tìm thấy khách hàng (ID: " + hopDong.id_danhSachKhachHang + ")");
    if (!phuongTien) warnings.push("Không tìm thấy phương tiện (ID: " + hopDong.id_danhSachPhuongTien + ")");
    
    // Gộp dữ liệu từ tất cả 4 sheet
    const mergedData = mergeContractData_(hopDong, khachHang || {}, phuongTien || {}, quanLyDichVu);
    
    // Tạo cấu trúc response
    const response = {
      success: true,
      template: template || "hop_dong_hop_tac",
      id: id,
      data: mergedData
    };
    
    if (warnings.length > 0) {
      response.warnings = warnings;
    }
    
    return jsonOutput_(response);
    
  } catch (error) {
    return jsonOutput_({
      success: false,
      message: "Lỗi hệ thống: " + error.message
    });
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getSheetDataAsObjects_(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error("Không tìm thấy sheet: " + sheetName);
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return []; // Không có dữ liệu
  
  const headers = data[0].map(h => String(h).trim());
  const rows = data.slice(1);
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

function findById_(rows, id) {
  if (!id) return null;
  // Chuyển về chuỗi để so sánh cho an toàn
  const strId = String(id).trim();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i].id).trim() === strId) {
      return rows[i];
    }
  }
  return null;
}

function isBlank_(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function mergeContractData_(hopDong, khachHang, phuongTien, quanLyDichVu) {
  // Gộp 4 object theo thứ tự ưu tiên tăng dần (phía sau đè phía trước):
  // khachHang < phuongTien < quanLyDichVu < hopDong
  // Dữ liệu trong hopDong luôn được ưu tiên cao nhất
  let mergedObj = Object.assign({}, khachHang, phuongTien, quanLyDichVu || {}, hopDong);
  
  // Xử lý riêng các field có thể bị trùng: nếu hopDong để trống thì lấy từ nguồn phụ
  const fieldMapping = {
    'tenKhachHang': khachHang.tenKhachHang,
    'bienKiemSoat': phuongTien.bienKiemSoat
  };
  
  for (let key in fieldMapping) {
    if (isBlank_(hopDong[key]) && !isBlank_(fieldMapping[key])) {
      mergedObj[key] = fieldMapping[key];
    }
  }
  
  // Format ngày tháng từ dạng Date object -> DD/MM/YYYY
  function formatDate(val) {
    if (val instanceof Date) {
      const d = val.getDate().toString().padStart(2, '0');
      const m = (val.getMonth() + 1).toString().padStart(2, '0');
      const y = val.getFullYear();
      return d + '/' + m + '/' + y;
    }
    return val;
  }
  
  for (let k in mergedObj) {
    mergedObj[k] = formatDate(mergedObj[k]);
  }
  
  return mergedObj;
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
