// ==========================================
// CẤU HÌNH GOOGLE SHEETS - APP NHÂN SỰ ĐI XANH
// ==========================================
// Không ghi trực tiếp ID Google Sheet vào repository.
// Trong Apps Script, tạo Script Property:
//   Key: SPREADSHEET_ID
//   Value: ID của file Google Sheets cần kết nối.
const SPREADSHEET_ID_PROPERTY = 'SPREADSHEET_ID';

const SHEETS = Object.freeze({
  MAIN: 'MAIN',
  TAI_KHOAN: 'TAI_KHOAN',
  HOP_DONG: 'HOP_DONG',
  PHU_LUC_HOP_DONG: 'PHU_LUC_HOP_DONG',
  THONG_TIN_BO_SUNG: 'THONG_TIN_BO_SUNG',
  KHAM_SUC_KHOE: 'KHAM_SUC_KHOE',
  BAO_HIEM: 'BAO_HIEM',
  FILE_DINH_KEM: 'FILE_DINH_KEM',
  NHAP_XUAT_DONG_PHUC: 'NHAP_XUAT_DONG_PHUC',
  KHO_TAI_SAN: 'KHO_TAI_SAN',
  NHAP_XUAT_TAI_SAN: 'NHAP_XUAT_TAI_SAN'
});

// Những cột này luôn lấy từ MAIN, không cho bảng phụ ghi đè.
const PROTECTED_MAIN_FIELDS = Object.freeze([
  'id', 'id_main', 'idNhanSu', 'maNV', 'hoTen', 'hoTenMaNV'
]);

// ==========================================
// API ENDPOINT
// URL mẫu:
// /exec?id=<MAIN.id>&hopDongId=<HOP_DONG.id>&template=<ten_template>
//      &username=<user>&password=<pass>
// ==========================================
function doGet(e) {
  return handleRequest_((e && e.parameter) || {});
}

// Có thể dùng POST nếu sau này frontend không muốn đặt mật khẩu trên URL.
function doPost(e) {
  let params = (e && e.parameter) || {};

  try {
    if (e && e.postData && e.postData.contents) {
      const body = JSON.parse(e.postData.contents);
      params = Object.assign({}, params, body || {});
    }
  } catch (error) {
    return jsonOutput_({
      success: false,
      message: 'Nội dung POST không phải JSON hợp lệ: ' + error.message
    });
  }

  return handleRequest_(params);
}

function handleRequest_(params) {
  try {
    const id = clean_(params.id);
    const requestedHopDongId = clean_(params.hopDongId);
    const template = clean_(params.template) || 'ho_so_nhan_su';
    const username = clean_(params.username || params.user);
    const password = clean_(params.password || params.pass);

    if (!username || !password) {
      return jsonOutput_({
        success: false,
        auth_failed: true,
        message: 'Yêu cầu đăng nhập.'
      });
    }

    if (!id) {
      return jsonOutput_({
        success: false,
        message: "Thiếu tham số 'id'. Giá trị này phải là MAIN.id."
      });
    }

    const ss = openConfiguredSpreadsheet_();
    const auth = authenticate_(ss, username, password);

    if (!auth.valid) {
      return jsonOutput_({
        success: false,
        auth_failed: true,
        message: auth.message
      });
    }

    // MAIN.id là khóa chính duy nhất của API.
    const main = findOneInSheetByField_(ss, SHEETS.MAIN, 'id', id);

    if (!main) {
      return jsonOutput_({
        success: false,
        message: 'Không tìm thấy nhân sự có MAIN.id: ' + id
      });
    }

    const related = loadRelatedData_(ss, main, requestedHopDongId);
    const mergedData = buildEmployeeData_(main, related);

    const response = {
      success: true,
      template: template,
      id: id,
      hopDongId: clean_(related.hopDongHienTai.id),
      requested_hop_dong_id: requestedHopDongId,
      key_source: 'MAIN.id',
      data: mergedData
    };

    const warnings = buildWarnings_(main, related);
    if (warnings.length) response.warnings = warnings;

    return jsonOutput_(response);
  } catch (error) {
    console.error(error);
    return jsonOutput_({
      success: false,
      message: 'Lỗi hệ thống: ' + error.message
    });
  }
}

// ==========================================
// XÁC THỰC
// Sheet TAI_KHOAN dùng cột: user, pass, trangThai
// ==========================================
function authenticate_(ss, username, password) {
  const inputUser = clean_(username);
  const inputPass = clean_(password);
  const accounts = findRowsInSheetByField_(
    ss,
    SHEETS.TAI_KHOAN,
    'user',
    inputUser
  );

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const sheetUser = clean_(account.user);
    const sheetPass = clean_(account.pass);
    const status = clean_(account.trangThai).toLowerCase();

    if (sheetUser === inputUser && sheetPass === inputPass) {
      if (status && status !== 'còn hoạt động') {
        return {
          valid: false,
          message: 'Tài khoản đã ngừng hoạt động.'
        };
      }

      return {
        valid: true,
        account: account
      };
    }
  }

  return {
    valid: false,
    message: 'Sai tên đăng nhập hoặc mật khẩu!'
  };
}

// ==========================================
// ĐỌC VÀ LIÊN KẾT DỮ LIỆU
// Tất cả bảng nghiệp vụ liên kết với MAIN bằng id_main.
// ==========================================
function loadRelatedData_(ss, main, requestedHopDongId) {
  const mainId = clean_(main.id);

  const hopDongList = findRowsInSheetByField_(
    ss,
    SHEETS.HOP_DONG,
    'id_main',
    mainId
  ).filter(isUsableRow_);

  const phuLucHopDongList = findRowsInSheetByField_(
    ss,
    SHEETS.PHU_LUC_HOP_DONG,
    'id_main',
    mainId
  ).filter(isUsableRow_);

  const thongTinBoSungList = findRowsInSheetByField_(
    ss,
    SHEETS.THONG_TIN_BO_SUNG,
    'id_main',
    mainId
  ).filter(isUsableRow_);

  const khamSucKhoeList = findRowsInSheetByField_(
    ss,
    SHEETS.KHAM_SUC_KHOE,
    'id_main',
    mainId
  ).filter(isUsableRow_);

  const baoHiemList = findRowsInSheetByField_(
    ss,
    SHEETS.BAO_HIEM,
    'id_main',
    mainId
  ).filter(isUsableRow_);

  const fileDinhKemList = findRowsInSheetByField_(
    ss,
    SHEETS.FILE_DINH_KEM,
    'id_main',
    mainId
  ).filter(isUsableRow_);

  const dongPhucList = findRowsInSheetByField_(
    ss,
    SHEETS.NHAP_XUAT_DONG_PHUC,
    'id_main',
    mainId
  ).filter(isUsableRow_);

  const khoTaiSanList = findRowsInSheetByField_(
    ss,
    SHEETS.KHO_TAI_SAN,
    'id_main',
    mainId
  ).filter(isUsableRow_);

  const nhapXuatTaiSanList = findRowsInSheetByField_(
    ss,
    SHEETS.NHAP_XUAT_TAI_SAN,
    'id_main',
    mainId
  ).filter(isUsableRow_);

  return {
    hopDongList: hopDongList,
    hopDongHienTai: selectCurrentContract_(
      hopDongList,
      requestedHopDongId || main.idHopDong
    ),
    phuLucHopDongList: sortRowsByDateDesc_(phuLucHopDongList, 'ngayHieuLucPLHD'),
    phuLucHopDongMoiNhat: selectLatestByDate_(phuLucHopDongList, 'ngayHieuLucPLHD'),
    thongTinBoSungList: thongTinBoSungList,
    thongTinBoSung: thongTinBoSungList[0] || {},
    khamSucKhoeList: sortRowsByDateDesc_(khamSucKhoeList, 'ngayKhamSucKhoe'),
    khamSucKhoeMoiNhat: selectLatestByDate_(khamSucKhoeList, 'ngayKhamSucKhoe'),
    baoHiemList: sortRowsByDateDesc_(baoHiemList, 'thangTangBHXH'),
    baoHiemMoiNhat: selectLatestByDate_(baoHiemList, 'thangTangBHXH'),
    fileDinhKemList: fileDinhKemList,
    dongPhucList: dongPhucList,
    khoTaiSanList: khoTaiSanList,
    nhapXuatTaiSanList: nhapXuatTaiSanList
  };
}

function selectCurrentContract_(rows, idHopDongFromMain) {
  if (!rows || !rows.length) return {};

  const linkedId = clean_(idHopDongFromMain);
  if (linkedId) {
    const linked = findByField_(rows, 'id', linkedId);
    if (linked) return linked;
  }

  const activeRows = rows.filter(function(row) {
    return clean_(row.trangThai).toLowerCase() === 'còn hiệu lực';
  });

  return selectLatestByDate_(activeRows.length ? activeRows : rows, 'ngayBatDau');
}

// ==========================================
// GỘP DỮ LIỆU DÙNG CHO DOCXTEMPLATER
// ==========================================
function buildEmployeeData_(main, related) {
  const data = Object.assign({}, main);

  // Khóa trả về luôn là MAIN.id.
  data.id = clean_(main.id);
  data.id_main = clean_(main.id);
  data.idNhanSu = clean_(main.id);

  // Field phổ biến của hợp đồng/bằng lái/bảo hiểm được đưa ra cấp ngoài
  // để template có thể dùng trực tiếp {{soHD}}, {{loaiHD}}, {{thongTinBLX}}...
  mergeNonBlank_(data, related.hopDongHienTai, PROTECTED_MAIN_FIELDS);
  mergeNonBlank_(data, related.thongTinBoSung, PROTECTED_MAIN_FIELDS);
  mergeNonBlank_(data, related.baoHiemMoiNhat, PROTECTED_MAIN_FIELDS);
  mergeNonBlank_(data, related.khamSucKhoeMoiNhat, PROTECTED_MAIN_FIELDS);
  mergeNonBlank_(data, related.phuLucHopDongMoiNhat, PROTECTED_MAIN_FIELDS);

  // Đồng thời sinh field có tiền tố để tránh nhầm nguồn dữ liệu.
  addPrefixedFields_(data, 'main_', main);
  addPrefixedFields_(data, 'hopDong_', related.hopDongHienTai);
  addPrefixedFields_(data, 'thongTinBoSung_', related.thongTinBoSung);
  addPrefixedFields_(data, 'baoHiem_', related.baoHiemMoiNhat);
  addPrefixedFields_(data, 'khamSucKhoe_', related.khamSucKhoeMoiNhat);
  addPrefixedFields_(data, 'phuLucHopDong_', related.phuLucHopDongMoiNhat);

  // Các mảng có thể dùng trong vòng lặp Docxtemplater.
  data.danhSachHopDong = related.hopDongList;
  data.danhSachPhuLucHopDong = related.phuLucHopDongList;
  data.danhSachThongTinBoSung = related.thongTinBoSungList;
  data.danhSachKhamSucKhoe = related.khamSucKhoeList;
  data.danhSachBaoHiem = related.baoHiemList;
  data.danhSachFileDinhKem = related.fileDinhKemList;
  data.danhSachDongPhuc = related.dongPhucList;
  data.danhSachKhoTaiSan = related.khoTaiSanList;
  data.danhSachNhapXuatTaiSan = related.nhapXuatTaiSanList;

  data.soLuongHopDong = related.hopDongList.length;
  data.soLuongPhuLucHopDong = related.phuLucHopDongList.length;
  data.soLuongFileDinhKem = related.fileDinhKemList.length;
  data.soLuongDongPhuc = related.dongPhucList.length;
  data.soLuongTaiSan = related.khoTaiSanList.length + related.nhapXuatTaiSanList.length;

  return normalizeForJson_(data);
}

function mergeNonBlank_(target, source, protectedFields) {
  if (!source) return target;

  const protectedMap = {};
  (protectedFields || []).forEach(function(key) {
    protectedMap[key] = true;
  });

  Object.keys(source).forEach(function(key) {
    if (!protectedMap[key] && !isBlank_(source[key])) {
      target[key] = source[key];
    }
  });

  return target;
}

function addPrefixedFields_(target, prefix, source) {
  if (!source) return;

  Object.keys(source).forEach(function(key) {
    target[prefix + key] = source[key];
  });
}

function buildWarnings_(main, related) {
  const warnings = [];

  if (!related.hopDongHienTai || !clean_(related.hopDongHienTai.id)) {
    warnings.push('Không tìm thấy hợp đồng liên kết cho nhân sự ' + clean_(main.maNV));
  }

  if (!related.thongTinBoSung || !clean_(related.thongTinBoSung.id)) {
    warnings.push('Nhân sự chưa có dữ liệu trong THONG_TIN_BO_SUNG');
  }

  return warnings;
}

// ==========================================
// HÀM ĐỌC SHEET TỐI ƯU THEO KHÓA
// ==========================================
function openConfiguredSpreadsheet_() {
  const spreadsheetId = clean_(
    PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY)
  );

  if (!spreadsheetId) {
    throw new Error(
      'Chưa cấu hình Script Property ' + SPREADSHEET_ID_PROPERTY
    );
  }

  return SpreadsheetApp.openById(spreadsheetId);
}

function findOneInSheetByField_(ss, sheetName, fieldName, value) {
  const rows = findRowsInSheetByField_(ss, sheetName, fieldName, value);
  return rows[0] || null;
}

function findRowsInSheetByField_(ss, sheetName, fieldName, value) {
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Không tìm thấy sheet: ' + sheetName);
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];

  const headers = sheet.getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(function(header) {
      return clean_(header);
    });

  const fieldIndex = headers.indexOf(fieldName);
  if (fieldIndex === -1) {
    throw new Error('Sheet ' + sheetName + ' không có cột ' + fieldName);
  }

  const target = clean_(value);
  if (!target) return [];

  const keyValues = sheet
    .getRange(2, fieldIndex + 1, lastRow - 1, 1)
    .getDisplayValues();

  const matchedRowNumbers = [];
  keyValues.forEach(function(row, index) {
    if (clean_(row[0]) === target) {
      matchedRowNumbers.push(index + 2);
    }
  });

  return matchedRowNumbers.map(function(rowNumber) {
    // getDisplayValues giữ nguyên ngày, giờ, tiền giống dữ liệu đang hiển thị.
    const row = sheet
      .getRange(rowNumber, 1, 1, lastColumn)
      .getDisplayValues()[0];

    const obj = {};
    headers.forEach(function(header, index) {
      if (header) obj[header] = row[index];
    });

    return obj;
  });
}

function findByField_(rows, fieldName, value) {
  const target = clean_(value);
  if (!target) return null;

  for (let i = 0; i < rows.length; i++) {
    if (clean_(rows[i][fieldName]) === target) return rows[i];
  }

  return null;
}

function isUsableRow_(row) {
  const deletedState = clean_(row.trang_thai || row.trang_thai_xoa || row.xoa_row).toLowerCase();
  return deletedState !== 'delete' && deletedState !== 'đã xóa' && deletedState !== 'đã xoá';
}

// ==========================================
// NGÀY THÁNG VÀ JSON
// ==========================================
function selectLatestByDate_(rows, fieldName) {
  if (!rows || !rows.length) return {};
  return sortRowsByDateDesc_(rows, fieldName)[0] || {};
}

function sortRowsByDateDesc_(rows, fieldName) {
  return (rows || []).slice().sort(function(a, b) {
    return parseDateValue_(b[fieldName]) - parseDateValue_(a[fieldName]);
  });
}

function parseDateValue_(value) {
  if (value instanceof Date) return value.getTime();

  const text = clean_(value);
  let match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (match) {
    return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
  }

  match = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
  }

  return 0;
}

function normalizeForJson_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
  }

  if (Array.isArray(value)) {
    return value.map(normalizeForJson_);
  }

  if (value && typeof value === 'object') {
    const output = {};
    Object.keys(value).forEach(function(key) {
      output[key] = normalizeForJson_(value[key]);
    });
    return output;
  }

  return value;
}

function clean_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function isBlank_(value) {
  return value === null || value === undefined || clean_(value) === '';
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
