/**
 * DAFTAR HADIR KEGIATAN — Gizi-Link, Jurusan Gizi Poltekkes Kemenkes Makassar
 *
 * Daftar hadir kuliah tamu, pembekalan, workshop, dll. dengan tanda tangan di layar
 * dan sertifikat (PDF dari SRIKANDI, nama peserta ditempel otomatis).
 *
 * Peserta:
 *   - Mahasiswa login Gizi-Link → data terisi otomatis
 *   - Mahasiswa lewat link/QR    → ketik NIM, nama & prodi diambil dari sheet Mahasiswa portal
 *   - CI / umum / mahasiswa belum terdaftar → isi manual
 * Admin: kolom "Daftar Hadir" di sheet Staf portal Gizi-Link → superadmin / admin
 *
 * CARA PASANG (lengkapnya di CARA-PASANG.md):
 *  1. Buat Google Sheet baru "Daftar Hadir Kegiatan - Database" (akun @poltekkes-mks.ac.id
 *     yang sama dengan pemilik sheet Gizi-Link) → Ekstensi → Apps Script
 *     → hapus isi Code.gs → tempel file ini → Simpan.
 *  2. Setelan Project (roda gigi) → Properti Skrip → tambahkan
 *       SSO_SECRET = (salin dari Apps Script portal Gizi-Link)
 *  3. Pilih fungsi `setup` → Jalankan → izinkan akses.
 *  4. Terapkan → Deployment baru → Aplikasi web → Jalankan sebagai: Saya,
 *     Yang memiliki akses: Siapa saja → salin URL /exec ke js/config.js.
 *  5. Di sheet Staf portal Gizi-Link tambahkan kolom "Daftar Hadir":
 *     isi superadmin / admin.
 */

var CONFIG = {
  ZONA: 'Asia/Makassar',
  // Spreadsheet portal Gizi-Link (sheet Mahasiswa & Staf). Bisa diganti lewat Properti Skrip PORTAL_SHEET_ID.
  PORTAL_SHEET_ID: '1iYaqOG-6C0n0uSjMGSiUU1YZrqOn48wkOptZMBphYdQ',
  URL_APLIKASI: 'https://jurusan-gizi.github.io/daftar-hadir/',
  NAMA_PENGIRIM: 'Jurusan Gizi Poltekkes Kemenkes Makassar',
  MAKS_TTD: 48000,            // panjang maksimum data gambar tanda tangan (karakter)
  BATAS_WAKTU_KIRIM: 270000   // ms; sisa peserta dilanjutkan dengan menekan Kirim lagi
};

var SASARAN = {
  D3: 'D3 Gizi',
  D4: 'D4 Gizi dan Dietetika',
  PROF: 'Profesi Dietisien',
  STAF: 'Dosen/PLP/Tendik',
  CI: 'CI (Clinical Instructor)',
  UMUM: 'Umum'
};
var PRODI_MHS = ['D3', 'D4', 'PROF'];

var SHEETS = {
  Kegiatan: ['id', 'nama', 'jenis', 'tanggal', 'waktu', 'tempat', 'narasumber', 'penyelenggara',
    'sasaran', 'bukaAbsen', 'tutupAbsen', 'statusAbsen', 'modeSertifikat', 'templatId', 'templatNama',
    'templatHalaman', 'templatTotal', 'posisi', 'sertifikatDibuka', 'status',
    'dibuatOleh', 'dibuatPada', 'diubahOleh', 'diubahPada', 'wajibKode', 'kodeHadir', 'evaluasi'],
  Kehadiran: ['id', 'kegiatanId', 'waktu', 'kategori', 'nim', 'nama', 'prodi', 'kelas', 'instansi',
    'nipNik', 'email', 'sumber', 'kode', 'emailStatus', 'emailWaktu', 'diubahOleh', 'diubahPada'],
  // Gambar tanda tangan disimpan terpisah agar tab Kehadiran tetap ringan dibaca
  TTD: ['id', 'kegiatanId', 'ttd'],
  EmailMahasiswa: ['nim', 'email', 'diubahPada'],
  // Evaluasi kepuasan peserta (5 aspek + nilai per narasumber)
  Evaluasi: ['id', 'kegiatanId', 'hadirId', 'kategori', 'a1', 'a2', 'a3', 'a4', 'a5', 'narasumber', 'saran', 'waktu'],
  // Notulensi & isian laporan (JSON per kegiatan)
  Laporan: ['kegiatanId', 'data', 'diubahOleh', 'diubahPada'],
  // Foto dokumentasi & materi narasumber (file di Google Drive)
  Berkas: ['id', 'kegiatanId', 'jenis', 'nama', 'fileId', 'mime', 'ukuran', 'narasumber', 'urutan', 'diunggahOleh', 'waktu', 'keterangan'],
  Pengaturan: ['kunci', 'nilai', 'keterangan'],
  Log: ['waktu', 'oleh', 'aksi', 'detail']
};

var ASPEK_EVALUASI = [
  'Materi sesuai dengan kebutuhan',
  'Narasumber menguasai materi',
  'Penyampaian jelas dan waktu cukup',
  'Penyelenggaraan (ruangan/Zoom dan teknis)',
  'Manfaat kegiatan'
];
var MAKS_BERKAS = 20 * 1024 * 1024;

var PENGATURAN_AWAL = [
  ['pengesahan_jabatan', 'Ketua Jurusan Gizi', 'Jabatan penanda tangan rekap daftar hadir'],
  ['pengesahan_nama', 'Manjilala, S.Gz, M.Gizi', 'Nama penanda tangan rekap'],
  ['pengesahan_nip', '197710092006041010', 'NIP penanda tangan rekap'],
  ['kota', 'Makassar', 'Kota pada tanggal pengesahan'],
  ['unit', 'Jurusan Gizi', 'Nama unit pada kop rekap'],
  ['ttd_file', '', 'ID file Drive gambar tanda tangan pengesah (diunggah dari menu Pengaturan)'],
  ['stempel_file', '', 'ID file Drive gambar stempel (diunggah dari menu Pengaturan)']
];

/* ===================== SETUP ===================== */
function setup() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(function (nama) {
    var sh = ss.getSheetByName(nama) || ss.insertSheet(nama);
    var h = SHEETS[nama];
    var ada = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
    h.forEach(function (kol) {
      if (ada.indexOf(kol) < 0) { ada.push(kol); sh.getRange(1, ada.length).setValue(kol); }
    });
    sh.getRange(1, 1, 1, ada.length).setFontWeight('bold').setBackground('#00B8AD').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    jadikanTeks_(sh);   // semua sel teks biasa: tanggal & NIM tidak diubah Google Sheet
  });
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembar1') || ss.getSheetByName('Lembar 1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  var pg = ss.getSheetByName('Pengaturan');
  var kunci = pg.getLastRow() > 1 ? pg.getRange(2, 1, pg.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  PENGATURAN_AWAL.forEach(function (r) { if (kunci.indexOf(r[0]) < 0) pg.appendRow(r); });

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('FOLDER_ID')) {
    var folder = DriveApp.createFolder('Daftar Hadir Kegiatan - Templat Sertifikat');
    props.setProperty('FOLDER_ID', folder.getId());
  }
  if (!props.getProperty('SSO_SECRET')) {
    Logger.log('PERHATIAN: Properti Skrip SSO_SECRET belum diisi. Salin dari Apps Script portal Gizi-Link.');
  }
  // Uji akses ke sheet portal
  var portal = portal_();
  Logger.log('Sheet portal terbaca: ' + portal.getName() + ' · Mahasiswa: ' + (portal.getSheetByName('Mahasiswa') ? 'ada' : 'TIDAK ADA') +
    ' · Staf: ' + (portal.getSheetByName('Staf') ? 'ada' : 'TIDAK ADA'));
  var hStaf = portal.getSheetByName('Staf').getRange(1, 1, 1, portal.getSheetByName('Staf').getLastColumn()).getValues()[0].map(String);
  if (hStaf.indexOf('Daftar Hadir') < 0) Logger.log('PERHATIAN: tambahkan kolom "Daftar Hadir" di sheet Staf portal (isi superadmin / admin).');
  Logger.log('Setup selesai.');
}

/** Jalankan untuk menguji: siapa saja yang punya akses admin. */
function cekAdmin() {
  daftarAdmin_().forEach(function (a) { Logger.log(a.peran + ' · ' + a.nama + ' · ' + a.id); });
}

/* ===================== WEB APP ===================== */
function doGet() {
  return json_({ ok: true, layanan: 'Daftar Hadir Kegiatan Gizi-Link', status: 'aktif' });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var a = req.aksi;

    // ---- Aksi publik (peserta tanpa login) ----
    if (a === 'info') return json_(info_(req));
    if (a === 'cekNim') return json_(cekNim_(req));
    if (a === 'cekNip') return json_(cekNip_(req));
    if (a === 'hadir') return json_(hadir_(req));
    if (a === 'templat') return json_(templatPeserta_(req));
    if (a === 'cekKode') return json_(cekKode_(req));
    if (a === 'materi') return json_(materiPublik_(req));
    if (a === 'unduhMateri') return json_(unduhMateri_(req));

    // ---- Dosen/staf ----
    var staf = verifikasiStafSSO_(req.token);
    if (staf) {
      var adm = peranAdmin_(staf);
      if (a === 'badge') return json_({ ok: true, jumlah: adm ? hitungDibuka_() : 0, label: 'dibuka' });
      if (!adm) return json_({ ok: false, kode: 'AKSES', pesan: 'Akun Anda belum diberi akses Daftar Hadir. Hubungi Ketua Jurusan.' });
      var u = { id: staf.id, nama: staf.nama, peran: adm };
      switch (a) {
        case 'adminInit': return json_(adminInit_(u));
        case 'simpanKegiatan': return json_(simpanKegiatan_(u, req));
        case 'hapusKegiatan': return json_(hapusKegiatan_(u, req));
        case 'aturAbsen': return json_(aturAbsen_(u, req));
        case 'gantiKode': return json_(gantiKode_(u, req));
        case 'uploadTemplat': return json_(uploadTemplat_(u, req));
        case 'simpanPosisi': return json_(simpanPosisi_(u, req));
        case 'ambilTemplat': return json_(ambilTemplatAdmin_(req));
        case 'peserta': return json_(peserta_(req));
        case 'ubahPeserta': return json_(ubahPeserta_(u, req));
        case 'hapusPeserta': return json_(hapusPeserta_(u, req));
        case 'kirimSertifikat': return json_(kirimSertifikat_(u, req));
        case 'bukaSertifikat': return json_(bukaSertifikat_(u, req));
        case 'simpanPengaturan': return json_(simpanPengaturan_(u, req));
        case 'gambarPengesahan': return json_(gambarPengesahan_(u, req));
        case 'ambilLaporan': return json_(ambilLaporan_(req));
        case 'simpanLaporan': return json_(simpanLaporan_(u, req));
        case 'unggahBerkas': return json_(unggahBerkas_(u, req));
        case 'hapusBerkas': return json_(hapusBerkas_(u, req));
        case 'urutBerkas': return json_(urutBerkas_(u, req));
        case 'ambilBerkas': return json_(ambilBerkas_(req));
        case 'dataLaporan': return json_(dataLaporan_(req));
      }
      return json_({ ok: false, pesan: 'Aksi tidak dikenal.' });
    }

    // ---- Mahasiswa login Gizi-Link ----
    var mhs = verifikasiSSO_(req.token);
    if (!mhs) return json_({ ok: false, kode: 'AUTH', pesan: 'Sesi Gizi-Link berakhir. Silakan masuk lagi.' });
    if (a === 'badge') return json_({ ok: true, jumlah: bukaUntukMhs_(mhs).filter(function (k) { return !k.sudah; }).length, label: 'dibuka' });
    if (a === 'saya') return json_(saya_(mhs));
    return json_({ ok: false, pesan: 'Aksi tidak dikenal.' });
  } catch (err) {
    return json_({ ok: false, pesan: 'Terjadi gangguan di server: ' + (err.message || err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ===================== HELPER SHEET ===================== */
function sh_(nama) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(nama);
  if (!sh && SHEETS[nama]) {   // tab baru dari pembaruan versi dibuat otomatis
    sh = ss.insertSheet(nama);
    sh.getRange(1, 1, 1, SHEETS[nama].length).setValues([SHEETS[nama]]).setFontWeight('bold').setBackground('#00B8AD').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    jadikanTeks_(sh);
  }
  if (!sh) throw new Error('Tab "' + nama + '" belum ada. Jalankan fungsi setup.');
  return sh;
}

/** Semua baris sebagai objek {kolom: nilai, _row: nomor baris}. */
function rows_(nama) {
  var sh = sh_(nama);
  if (sh.getLastRow() < 2) return [];
  var data = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var h = data[0].map(String), out = [];
  for (var r = 1; r < data.length; r++) {
    var o = { _row: r + 1 };
    for (var c = 0; c < h.length; c++) o[h[c]] = teksSel_(data[r][c], h[c]);
    out.push(o);
  }
  return out;
}

/** Format kolom waktu bila sel terlanjur dibaca Google Sheet sebagai tanggal. */
var POLA_WAKTU = {
  tanggal: 'yyyy-MM-dd', bukaAbsen: "yyyy-MM-dd'T'HH:mm", tutupAbsen: "yyyy-MM-dd'T'HH:mm",
  waktu: 'yyyy-MM-dd HH:mm:ss', emailWaktu: 'yyyy-MM-dd HH:mm', dibuatPada: 'yyyy-MM-dd HH:mm', diubahPada: 'yyyy-MM-dd HH:mm'
};
function teksSel_(v, kolom) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.ZONA, POLA_WAKTU[kolom] || 'yyyy-MM-dd HH:mm');
  return String(v);
}

/** Ubah seluruh sheet menjadi format Teks biasa tanpa merusak isi yang sudah ada. */
function jadikanTeks_(sh) {
  var nr = sh.getMaxRows(), nc = sh.getMaxColumns();
  var lr = sh.getLastRow(), lc = sh.getLastColumn(), data = null, h = [];
  if (lr > 0 && lc > 0) {
    data = sh.getRange(1, 1, lr, lc).getValues();
    h = data[0].map(String);
    data = data.map(function (r, i) { return r.map(function (v, c) { return i === 0 ? String(v) : teksSel_(v, h[c]); }); });
  }
  sh.getRange(1, 1, nr, nc).setNumberFormat('@');
  if (data) sh.getRange(1, 1, lr, lc).setValues(data);
}

/** Jalankan sekali bila tanggal/jam tampil aneh (mis. "Sat Nov 14 2026 00:00:00 GMT+0800"). */
function perbaikiFormat() {
  Object.keys(SHEETS).forEach(function (n) { var sh = SpreadsheetApp.getActive().getSheetByName(n); if (sh) jadikanTeks_(sh); });
  Logger.log('Format teks diperbaiki.');
}

function header_(nama) {
  var sh = sh_(nama);
  var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  (SHEETS[nama] || []).forEach(function (kol) {   // kolom baru (pembaruan versi) ditambahkan otomatis
    if (h.indexOf(kol) < 0) { h.push(kol); sh.getRange(1, h.length).setValue(kol).setNumberFormat('@'); }
  });
  return h;
}

function tambah_(nama, o) {
  var h = header_(nama);
  sh_(nama).appendRow(h.map(function (k) { return o[k] == null ? '' : aman_(o[k]); }));
}

function ubah_(nama, row, o) {
  var h = header_(nama);
  sh_(nama).getRange(row, 1, 1, h.length).setValues([h.map(function (k) { return o[k] == null ? '' : aman_(o[k]); })]);
}

/** Cegah isian dibaca sebagai rumus. */
function aman_(v) {
  v = String(v);
  return /^[=+\-@]/.test(v) && v.indexOf('data:') !== 0 ? "'" + v : v;
}

function bersih_(v, maks) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maks || 200);
}

function sekarang_(fmt) {
  return Utilities.formatDate(new Date(), CONFIG.ZONA, fmt || "yyyy-MM-dd'T'HH:mm");
}

function kunci_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function acak_(n) {
  var s = '', c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (var i = 0; i < n; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
}

function log_(oleh, aksi, detail) {
  try { tambah_('Log', { waktu: sekarang_('yyyy-MM-dd HH:mm:ss'), oleh: oleh, aksi: aksi, detail: String(detail || '').slice(0, 500) }); } catch (e) { }
}

function pengaturan_() {
  var o = {};
  rows_('Pengaturan').forEach(function (r) { o[r.kunci] = r.nilai; });
  return o;
}

function normNim_(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0');
}

function normId_(v) {
  return String(v || '').replace(/[^0-9A-Za-z]/g, '').toLowerCase();
}

function normNama_(v) {
  return String(v || '').toLowerCase().replace(/[^a-z]/g, '');
}

function emailValid_(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

function samarEmail_(e) {
  e = String(e || '');
  var i = e.indexOf('@');
  if (i < 1) return '';
  var u = e.slice(0, i);
  return u.slice(0, Math.min(2, u.length)) + '•••' + e.slice(i);
}

/* ===================== PORTAL GIZI-LINK ===================== */
function portal_() {
  var id = PropertiesService.getScriptProperties().getProperty('PORTAL_SHEET_ID') || CONFIG.PORTAL_SHEET_ID;
  return SpreadsheetApp.openById(id);
}

function kodeProdi_(teks) {
  var t = String(teks || '').toUpperCase().trim();
  if (t.indexOf('D3') === 0) return 'D3';
  if (t.indexOf('D4') === 0) return 'D4';
  if (t.indexOf('PROF') === 0) return 'PROF';
  return '';
}

/** Data mahasiswa portal: {NIMNORMAL: {nim, nama, prodi, kelas}}; di-cache 10 menit. */
function mahasiswa_() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('mhs_v1');
  if (c) { try { return JSON.parse(c); } catch (e) { } }
  var sh = portal_().getSheetByName('Mahasiswa');
  var data = sh.getDataRange().getValues(), h = data[0].map(function (x) { return String(x).trim(); });
  var iN = h.indexOf('NIM'), iNa = h.indexOf('Nama'), iP = h.indexOf('Program Studi'), iK = h.indexOf('Kelas');
  var o = {};
  for (var r = 1; r < data.length; r++) {
    var nim = String(data[r][iN] || '').replace(/^'/, '').trim();
    if (!nim) continue;
    o[normNim_(nim)] = { nim: nim, nama: String(data[r][iNa] || '').trim(), prodi: String(data[r][iP] || '').trim(), kelas: iK >= 0 ? String(data[r][iK] || '').trim() : '' };
  }
  try { cache.put('mhs_v1', JSON.stringify(o), 600); } catch (e) { }
  return o;
}

/** Data dosen/PLP/tendik dari sheet Staf portal: {IDNORMAL: {id, nama, jabatan}}; di-cache 10 menit. */
function staf_() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('staf_v1');
  if (c) { try { return JSON.parse(c); } catch (e) { } }
  var sh = portal_().getSheetByName('Staf');
  var data = sh.getDataRange().getValues(), h = data[0].map(function (x) { return String(x).trim(); });
  var iId = h.indexOf('ID'), iNa = h.indexOf('Nama'), iJ = h.indexOf('Jabatan');
  var o = {};
  for (var r = 1; r < data.length; r++) {
    var id = String(data[r][iId] || '').trim(), n = normId_(id);
    if (n.length < 8 || !/\d{8}/.test(n)) continue;   // lewati akun non-pegawai (mis. "admin")
    o[n] = { id: id, nama: String(data[r][iNa] || '').trim(), jabatan: iJ >= 0 ? String(data[r][iJ] || '').trim() : '' };
  }
  try { cache.put('staf_v1', JSON.stringify(o), 600); } catch (e) { }
  return o;
}

/** Peran admin dari kolom "Daftar Hadir" sheet Staf portal: 'superadmin' | 'admin' | ''. */
function peranAdmin_(staf) {
  var target = normId_(staf.id);
  var d = daftarAdmin_();
  for (var i = 0; i < d.length; i++) if (normId_(d[i].id) === target) return d[i].peran;
  return '';
}

function daftarAdmin_() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('adm_v1');
  if (c) { try { return JSON.parse(c); } catch (e) { } }
  var sh = portal_().getSheetByName('Staf');
  var data = sh.getDataRange().getValues(), h = data[0].map(function (x) { return String(x).trim(); });
  var iId = h.indexOf('ID'), iNa = h.indexOf('Nama'), iDh = h.indexOf('Daftar Hadir');
  var out = [];
  if (iDh < 0) return out;
  for (var r = 1; r < data.length; r++) {
    var p = String(data[r][iDh] || '').trim().toLowerCase();
    if (p !== 'superadmin' && p !== 'admin') continue;
    out.push({ id: String(data[r][iId]), nama: String(data[r][iNa]), peran: p });
  }
  try { cache.put('adm_v1', JSON.stringify(out), 300); } catch (e) { }
  return out;
}

/* ===================== KEGIATAN: STATUS ABSEN ===================== */
function kegiatan_(id) {
  var k = rows_('Kegiatan').filter(function (r) { return r.id === String(id) && r.status !== 'dihapus'; })[0];
  return k || null;
}

/** 'buka' | 'belum' | 'tutup' */
function statusAbsen_(k) {
  if (k.statusAbsen === 'buka') return 'buka';
  if (k.statusAbsen === 'tutup') return 'tutup';
  var now = sekarang_();
  if (k.bukaAbsen && now < k.bukaAbsen) return 'belum';
  if (k.tutupAbsen && now > k.tutupAbsen) return 'tutup';
  return 'buka';
}

function sasaranList_(k) {
  return String(k.sasaran || '').split(',').map(function (s) { return s.trim(); }).filter(function (s) { return SASARAN[s]; });
}

function hitungDibuka_() {
  return rows_('Kegiatan').filter(function (k) { return k.status !== 'dihapus' && statusAbsen_(k) === 'buka'; }).length;
}

function infoPublik_(k) {
  return {
    id: k.id, nama: k.nama, jenis: k.jenis, tanggal: k.tanggal, waktu: k.waktu, tempat: k.tempat,
    narasumber: k.narasumber, penyelenggara: k.penyelenggara, sasaran: sasaranList_(k),
    bukaAbsen: k.bukaAbsen, tutupAbsen: k.tutupAbsen, absen: statusAbsen_(k),
    modeSertifikat: k.modeSertifikat || 'tanpa', adaTemplat: !!k.templatId,
    wajibKode: k.wajibKode === 'YA',
    evaluasi: k.evaluasi === 'YA', daftarNarasumber: daftarNarasumber_(k.narasumber), aspek: ASPEK_EVALUASI
  };
}

/* ===================== PUBLIK ===================== */
function info_(req) {
  var k = kegiatan_(req.k);
  if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan. Periksa kembali link daftar hadir.' };
  return { ok: true, kegiatan: infoPublik_(k), labelSasaran: SASARAN };
}

function cekNim_(req) {
  var nim = normNim_(req.nim);
  if (nim.length < 5) return { ok: false, pesan: 'NIM terlalu pendek.' };
  var m = mahasiswa_()[nim];
  if (!m) return { ok: true, ditemukan: false };
  var em = rows_('EmailMahasiswa').filter(function (r) { return normNim_(r.nim) === nim; })[0];
  return { ok: true, ditemukan: true, nim: m.nim, nama: m.nama, prodi: m.prodi, prodiKode: kodeProdi_(m.prodi), kelas: m.kelas, emailSamar: em ? samarEmail_(em.email) : '' };
}

function cekNip_(req) {
  var n = normId_(req.nip);
  if (n.length < 8) return { ok: false, pesan: 'NIP terlalu pendek.' };
  var p = staf_()[n];
  if (!p) return { ok: true, ditemukan: false };
  var em = rows_('EmailMahasiswa').filter(function (r) { return normId_(r.nim) === n; })[0];
  return { ok: true, ditemukan: true, nip: p.id, nama: p.nama, jabatan: p.jabatan, emailSamar: em ? samarEmail_(em.email) : '' };
}

/**
 * Simpan kehadiran. req: {k, token?, kategori: 'MHS'|'CI'|'UMUM', nim, nama, prodiKode, instansi, nipNik, email, ttd}
 */
function hadir_(req) {
  var k = kegiatan_(req.k);
  if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
  var st = statusAbsen_(k);
  if (st === 'belum') return { ok: false, pesan: 'Daftar hadir belum dibuka. Dibuka ' + tampilWaktu_(k.bukaAbsen) + '.' };
  if (st === 'tutup') return { ok: false, pesan: 'Daftar hadir sudah ditutup.' };

  var sas = sasaranList_(k);
  var ttd = String(req.ttd || '');
  if (ttd.indexOf('data:image/png;base64,') !== 0 || ttd.length < 200) return { ok: false, pesan: 'Tanda tangan belum dibuat.' };
  if (ttd.length > CONFIG.MAKS_TTD) return { ok: false, pesan: 'Gambar tanda tangan terlalu besar. Tekan Ulangi lalu tanda tangan lagi.' };

  // Kode kehadiran: diumumkan panitia di ruangan / layar Zoom
  if (k.wajibKode === 'YA') {
    var hk = periksaKode_(k, req.kodeHadir, req.perangkat || req.nim || req.nipNik || req.email || req.nama);
    if (!hk.ok) return hk;
  }

  // Evaluasi kepuasan (wajib bila diaktifkan)
  var ev = null;
  if (k.evaluasi === 'YA') {
    ev = req.evaluasi || {};
    var a = ev.a || [], nr = ev.n || [], jn = daftarNarasumber_(k.narasumber).length;
    var nilaiOk = function (v) { return [1, 2, 3, 4, 5].indexOf(Number(v)) >= 0; };
    if (a.length !== ASPEK_EVALUASI.length || !a.every(nilaiOk)) return { ok: false, pesan: 'Lengkapi semua penilaian kegiatan (bintang 1–5).' };
    if (nr.length !== jn || !nr.every(nilaiOk)) return { ok: false, pesan: 'Lengkapi penilaian untuk setiap narasumber.' };
  }

  var mode = k.modeSertifikat || 'tanpa';
  var email = bersih_(req.email, 120).toLowerCase();
  if (email && !emailValid_(email)) return { ok: false, pesan: 'Format email tidak valid.' };

  var d = { kategori: '', nim: '', nama: '', prodi: '', kelas: '', instansi: '', nipNik: '', email: email, sumber: '' };
  var mhsSso = verifikasiSSO_(req.token);
  var stafSso = verifikasiStafSSO_(req.token);
  var kat = String(req.kategori || '');

  if (kat === 'STAF') {
    if (sas.indexOf('STAF') < 0) return { ok: false, pesan: 'Kategori Dosen/PLP/Tendik tidak dibuka untuk kegiatan ini.' };
    d.kategori = 'Dosen/PLP/Tendik'; d.prodi = 'Dosen/PLP/Tendik';
    var pg = null;
    if (stafSso) { pg = staf_()[normId_(stafSso.id)] || { id: stafSso.id, nama: stafSso.nama, jabatan: '' }; d.sumber = 'Gizi-Link'; }
    else {
      var nip = normId_(req.nipNik);
      if (nip.length >= 8) pg = staf_()[nip] || null;
      d.sumber = pg ? 'NIP' : 'manual';
    }
    if (pg) {
      d.nama = pg.nama; d.nipNik = pg.id; d.instansi = pg.jabatan || bersih_(req.instansi, 150) || 'Jurusan Gizi';
    } else {
      d.nama = bersih_(req.nama, 150); d.nipNik = bersih_(req.nipNik, 30); d.instansi = bersih_(req.instansi, 150) || 'Jurusan Gizi';
      if (d.nama.length < 3) return { ok: false, pesan: 'Nama lengkap wajib diisi.' };
    }
    var simpanS = d.nipNik ? rows_('EmailMahasiswa').filter(function (r) { return normId_(r.nim) === normId_(d.nipNik); })[0] : null;
    if (!d.email && simpanS) d.email = simpanS.email;
    if (mode !== 'tanpa' && !d.email) return { ok: false, pesan: 'Email wajib diisi agar sertifikat dapat dikirim.' };
  } else if (kat === 'MHS' || mhsSso) {
    d.kategori = 'Mahasiswa';
    var portal = null;
    if (mhsSso) {
      portal = { nim: mhsSso.nim, nama: mhsSso.nama, prodi: mhsSso.prodi, kelas: mhsSso.kelas || '' };
      d.sumber = 'Gizi-Link';
    } else {
      var n = normNim_(req.nim);
      if (n.length < 5) return { ok: false, pesan: 'NIM wajib diisi.' };
      portal = mahasiswa_()[n] || null;
      d.sumber = portal ? 'NIM' : 'manual';
      if (!portal) {
        var pk = String(req.prodiKode || '');
        if (PRODI_MHS.indexOf(pk) < 0) return { ok: false, pesan: 'Pilih program studi.' };
        portal = { nim: bersih_(req.nim, 30).toUpperCase(), nama: bersih_(req.nama, 150), prodi: SASARAN[pk], kelas: '' };
        if (portal.nama.length < 3) return { ok: false, pesan: 'Nama lengkap wajib diisi.' };
      }
    }
    var kode = kodeProdi_(portal.prodi) || String(req.prodiKode || '');
    if (sas.indexOf(kode) < 0) {
      return { ok: false, pesan: 'Kegiatan ini hanya untuk: ' + sas.map(function (s) { return SASARAN[s]; }).join(', ') + '.' };
    }
    d.nim = portal.nim; d.nama = portal.nama; d.prodi = SASARAN[kode] || portal.prodi; d.kelas = portal.kelas;
    // Email mahasiswa: boleh kosong → pakai email tersimpan
    var simpan = rows_('EmailMahasiswa').filter(function (r) { return normNim_(r.nim) === normNim_(d.nim); })[0];
    if (!d.email && simpan) d.email = simpan.email;
  } else if (kat === 'CI' || kat === 'UMUM') {
    if (sas.indexOf(kat) < 0) return { ok: false, pesan: 'Kategori peserta ini tidak dibuka untuk kegiatan ini.' };
    d.kategori = kat === 'CI' ? 'CI' : 'Umum';
    d.prodi = kat === 'CI' ? 'CI' : 'Umum';
    d.nama = bersih_(req.nama, 150);
    d.instansi = bersih_(req.instansi, 150);
    d.nipNik = bersih_(req.nipNik, 30);
    d.sumber = 'manual';
    if (d.nama.length < 3) return { ok: false, pesan: 'Nama lengkap wajib diisi.' };
    if (!d.instansi) return { ok: false, pesan: (kat === 'CI' ? 'Lahan praktik' : 'Instansi/asal') + ' wajib diisi.' };
    if (mode !== 'tanpa' && !d.email) return { ok: false, pesan: 'Email wajib diisi agar sertifikat dapat dikirim.' };
  } else {
    return { ok: false, pesan: 'Pilih kategori peserta.' };
  }

  var hasil = kunci_(function () {
    var ada = rows_('Kehadiran').filter(function (r) { return r.kegiatanId === k.id; });
    for (var i = 0; i < ada.length; i++) {
      var r = ada[i];
      var sama = d.kategori === 'Mahasiswa'
        ? (r.kategori === 'Mahasiswa' && normNim_(r.nim) === normNim_(d.nim))
        : d.kategori === 'Dosen/PLP/Tendik' && d.nipNik
        ? (r.kategori === d.kategori && normId_(r.nipNik) === normId_(d.nipNik))
        : (r.kategori === d.kategori && ((d.email && r.email === d.email) || (!d.email && normNama_(r.nama) === normNama_(d.nama))));
      if (sama) return { dobel: true, r: r };
    }
    var row = {
      id: 'H' + acak_(8), kegiatanId: k.id, waktu: sekarang_('yyyy-MM-dd HH:mm:ss'), kategori: d.kategori,
      nim: d.nim, nama: d.nama, prodi: d.prodi, kelas: d.kelas, instansi: d.instansi, nipNik: d.nipNik,
      email: d.email, sumber: d.sumber, kode: acak_(10), emailStatus: '', emailWaktu: ''
    };
    tambah_('Kehadiran', row);
    sh_('TTD').appendRow([row.id, k.id, ttd]);
    if (ev) {
      tambah_('Evaluasi', {
        id: 'E' + acak_(8), kegiatanId: k.id, hadirId: row.id, kategori: d.kategori,
        a1: ev.a[0], a2: ev.a[1], a3: ev.a[2], a4: ev.a[3], a5: ev.a[4],
        narasumber: JSON.stringify((ev.n || []).map(Number)), saran: bersih_(ev.s, 1000), waktu: row.waktu
      });
    }
    if (d.kategori === 'Mahasiswa' && req.email && emailValid_(email)) ingatEmail_(d.nim, email);
    if (d.kategori === 'Dosen/PLP/Tendik' && d.nipNik && req.email && emailValid_(email)) ingatEmail_(d.nipNik, email);
    return { dobel: false, r: row };
  });

  var r = hasil.r;
  var siap = sertifikatSiap_(k);
  var out = {
    ok: true, dobel: hasil.dobel, nama: r.nama, waktu: r.waktu, kegiatan: k.nama,
    modeSertifikat: mode, sertifikatSiap: siap, jumlahMateri: berkas_(k.id, 'materi').length,
    unduh: siap ? { p: r.id, c: r.kode } : null
  };
  if (hasil.dobel) {
    out.pesan = 'Anda sudah tercatat hadir pada ' + r.waktu + '.';
    return out;
  }
  // Mode langsung: kirim link sertifikat ke email (bila ada)
  if (siap && mode === 'langsung' && r.email) {
    try { kirimEmail_(k, r); tandaiEmail_(r.id, 'Terkirim'); out.emailTerkirim = true; }
    catch (e) { tandaiEmail_(r.id, 'Gagal: ' + (e.message || e)); }
  }
  return out;
}

function ingatEmail_(nim, email) {
  var ada = rows_('EmailMahasiswa').filter(function (r) { return normNim_(r.nim) === normNim_(nim); })[0];
  var o = { nim: nim, email: email, diubahPada: sekarang_('yyyy-MM-dd HH:mm') };
  if (ada) ubah_('EmailMahasiswa', ada._row, o); else tambah_('EmailMahasiswa', o);
}

function sertifikatSiap_(k) {
  var mode = k.modeSertifikat || 'tanpa';
  if (mode === 'tanpa' || !k.templatId) return false;
  return mode === 'langsung' || k.sertifikatDibuka === 'YA';
}

function tampilWaktu_(t) {
  if (!t) return '';
  var p = String(t).split('T');
  var d = p[0].split('-');
  var bln = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return Number(d[2]) + ' ' + bln[Number(d[1])] + ' ' + d[0] + (p[1] ? ' pukul ' + p[1].replace(':', '.') + ' WITA' : '');
}

/** Templat sertifikat untuk peserta (dengan kode unduh). */
function templatPeserta_(req) {
  var r = rows_('Kehadiran').filter(function (x) { return x.id === String(req.p); })[0];
  if (!r || r.kode !== String(req.c) || r.kegiatanId !== String(req.k)) return { ok: false, pesan: 'Link sertifikat tidak valid.' };
  var k = kegiatan_(r.kegiatanId);
  if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
  if (!sertifikatSiap_(k)) return { ok: false, kode: 'BELUM', pesan: (k.modeSertifikat || 'tanpa') === 'tanpa' ? 'Kegiatan ini tidak menerbitkan sertifikat.' : 'Sertifikat belum diterbitkan. Silakan cek kembali setelah kegiatan.' };
  return { ok: true, nama: r.nama, kegiatan: k.nama, tanggal: k.tanggal, halaman: Number(k.templatHalaman || 1), posisi: posisi_(k), pdf: pdfBase64_(k.templatId) };
}

function pdfBase64_(fileId) {
  return Utilities.base64Encode(DriveApp.getFileById(fileId).getBlob().getBytes());
}

function posisi_(k) {
  try { return JSON.parse(k.posisi); } catch (e) { return null; }
}

/* ===================== MAHASISWA (login Gizi-Link) ===================== */
function bukaUntukMhs_(mhs) {
  var kode = kodeProdi_(mhs.prodi);
  var hadir = rows_('Kehadiran').filter(function (r) { return normNim_(r.nim) === normNim_(mhs.nim); });
  var sudah = {};
  hadir.forEach(function (r) { sudah[r.kegiatanId] = true; });
  return rows_('Kegiatan').filter(function (k) {
    return k.status !== 'dihapus' && sasaranList_(k).indexOf(kode) >= 0 && statusAbsen_(k) === 'buka';
  }).map(function (k) { var o = infoPublik_(k); o.sudah = !!sudah[k.id]; return o; });
}

function saya_(mhs) {
  var keg = {}, jumlahMateri = {};
  rows_('Kegiatan').forEach(function (k) { if (k.status !== 'dihapus') keg[k.id] = k; });
  rows_('Berkas').forEach(function (b) { if (b.jenis === 'materi') jumlahMateri[b.kegiatanId] = (jumlahMateri[b.kegiatanId] || 0) + 1; });
  var riwayat = rows_('Kehadiran').filter(function (r) { return normNim_(r.nim) === normNim_(mhs.nim) && keg[r.kegiatanId]; })
    .map(function (r) {
      var k = keg[r.kegiatanId], siap = sertifikatSiap_(k);
      return {
        kegiatanId: k.id, kegiatan: k.nama, jenis: k.jenis, tanggal: k.tanggal, waktuHadir: r.waktu,
        modeSertifikat: k.modeSertifikat || 'tanpa', sertifikatSiap: siap, unduh: siap ? { p: r.id, c: r.kode } : null,
        jumlahMateri: jumlahMateri[k.id] || 0
      };
    });
  riwayat.sort(function (a, b) { return a.waktuHadir < b.waktuHadir ? 1 : -1; });
  return { ok: true, profil: { nim: mhs.nim, nama: mhs.nama, prodi: mhs.prodi, kelas: mhs.kelas }, dibuka: bukaUntukMhs_(mhs), riwayat: riwayat };
}

/* ===================== ADMIN ===================== */
function adminInit_(u) {
  var jumlah = {};
  rows_('Kehadiran').forEach(function (r) { jumlah[r.kegiatanId] = (jumlah[r.kegiatanId] || 0) + 1; });
  var keg = rows_('Kegiatan').filter(function (k) { return k.status !== 'dihapus'; }).map(function (k) {
    var o = infoPublik_(k);
    o.statusAbsen = k.statusAbsen || 'otomatis';
    o.templatNama = k.templatNama; o.templatHalaman = Number(k.templatHalaman || 1); o.templatTotal = Number(k.templatTotal || 0);
    o.posisi = posisi_(k); o.sertifikatDibuka = k.sertifikatDibuka === 'YA'; o.kodeHadir = k.kodeHadir || '';
    o.jumlah = jumlah[k.id] || 0; o.dibuatOleh = k.dibuatOleh; o.dibuatPada = k.dibuatPada;
    return o;
  });
  keg.sort(function (a, b) { return (a.tanggal + a.id) < (b.tanggal + b.id) ? 1 : -1; });
  var out = { ok: true, user: u, kegiatan: keg, labelSasaran: SASARAN, pengaturan: pengaturan_(), kuotaEmail: MailApp.getRemainingDailyQuota() };
  if (u.peran === 'superadmin') { out.admin = daftarAdmin_(); out.gambar = gambarPengesah_(); }
  return out;
}

function simpanKegiatan_(u, req) {
  var d = req.data || {};
  var o = {
    nama: bersih_(d.nama, 250), jenis: bersih_(d.jenis, 60), tanggal: bersih_(d.tanggal, 10), waktu: bersih_(d.waktu, 60),
    tempat: bersih_(d.tempat, 200), narasumber: bersih_(d.narasumber, 300), penyelenggara: bersih_(d.penyelenggara, 150),
    sasaran: (d.sasaran || []).filter(function (s) { return SASARAN[s]; }).join(','),
    bukaAbsen: bersih_(d.bukaAbsen, 16), tutupAbsen: bersih_(d.tutupAbsen, 16),
    modeSertifikat: ['tanpa', 'langsung', 'setelah'].indexOf(d.modeSertifikat) >= 0 ? d.modeSertifikat : 'tanpa',
    wajibKode: d.wajibKode ? 'YA' : 'TIDAK',
    evaluasi: d.evaluasi ? 'YA' : 'TIDAK'
  };
  if (o.nama.length < 3) return { ok: false, pesan: 'Nama kegiatan wajib diisi.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.tanggal)) return { ok: false, pesan: 'Tanggal kegiatan wajib diisi.' };
  if (!o.sasaran) return { ok: false, pesan: 'Pilih minimal satu sasaran peserta.' };
  if (o.bukaAbsen && o.tutupAbsen && o.bukaAbsen >= o.tutupAbsen) return { ok: false, pesan: 'Jam tutup absen harus setelah jam buka.' };

  return kunci_(function () {
    var now = sekarang_('yyyy-MM-dd HH:mm');
    if (d.id) {
      var k = kegiatan_(d.id);
      if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
      Object.keys(o).forEach(function (x) { k[x] = o[x]; });
      if (k.wajibKode === 'YA' && !k.kodeHadir) k.kodeHadir = kodeBaru_();
      k.diubahOleh = u.nama; k.diubahPada = now;
      ubah_('Kegiatan', k._row, k);
      log_(u.nama, 'ubah kegiatan', k.id + ' ' + k.nama);
      return { ok: true, id: k.id };
    }
    o.id = 'K' + Utilities.formatDate(new Date(), CONFIG.ZONA, 'yyMMdd') + acak_(4);
    o.kodeHadir = kodeBaru_();
    o.statusAbsen = 'otomatis'; o.status = 'aktif'; o.sertifikatDibuka = 'TIDAK'; o.templatHalaman = '1';
    o.dibuatOleh = u.nama; o.dibuatPada = now;
    tambah_('Kegiatan', o);
    log_(u.nama, 'buat kegiatan', o.id + ' ' + o.nama);
    return { ok: true, id: o.id };
  });
}

function hapusKegiatan_(u, req) {
  if (u.peran !== 'superadmin') return { ok: false, pesan: 'Hanya super admin yang dapat menghapus kegiatan.' };
  return kunci_(function () {
    var k = kegiatan_(req.k);
    if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
    k.status = 'dihapus'; k.diubahOleh = u.nama; k.diubahPada = sekarang_('yyyy-MM-dd HH:mm');
    ubah_('Kegiatan', k._row, k);
    log_(u.nama, 'hapus kegiatan', k.id + ' ' + k.nama);
    return { ok: true };
  });
}

function kodeBaru_() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function gantiKode_(u, req) {
  return kunci_(function () {
    var k = kegiatan_(req.k);
    if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
    var lama = k.kodeHadir;
    do { k.kodeHadir = kodeBaru_(); } while (k.kodeHadir === lama);
    k.diubahOleh = u.nama; k.diubahPada = sekarang_('yyyy-MM-dd HH:mm');
    ubah_('Kegiatan', k._row, k);
    log_(u.nama, 'ganti kode kehadiran', k.id);
    return { ok: true, kodeHadir: k.kodeHadir };
  });
}

function aturAbsen_(u, req) {
  var s = String(req.status);
  if (['otomatis', 'buka', 'tutup'].indexOf(s) < 0) return { ok: false, pesan: 'Status tidak valid.' };
  return kunci_(function () {
    var k = kegiatan_(req.k);
    if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
    k.statusAbsen = s; k.diubahOleh = u.nama; k.diubahPada = sekarang_('yyyy-MM-dd HH:mm');
    ubah_('Kegiatan', k._row, k);
    log_(u.nama, 'status absen ' + s, k.id);
    return { ok: true, absen: statusAbsen_(k) };
  });
}

function uploadTemplat_(u, req) {
  var b64 = String(req.pdf || '');
  if (!b64) return { ok: false, pesan: 'File PDF kosong.' };
  var bytes = Utilities.base64Decode(b64);
  if (bytes.length > 10 * 1024 * 1024) return { ok: false, pesan: 'File terlalu besar (maks. 10 MB).' };
  var head = Utilities.newBlob(bytes.slice(0, 5)).getDataAsString();
  if (head !== '%PDF-') return { ok: false, pesan: 'File bukan PDF.' };
  return kunci_(function () {
    var k = kegiatan_(req.k);
    if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
    var folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID'));
    var nama = bersih_(req.nama || 'sertifikat.pdf', 120);
    var file = folder.createFile(Utilities.newBlob(bytes, 'application/pdf', k.id + ' - ' + nama));
    if (k.templatId) { try { DriveApp.getFileById(k.templatId).setTrashed(true); } catch (e) { } }
    k.templatId = file.getId(); k.templatNama = nama;
    k.templatTotal = String(Number(req.total) || 1);
    var hal = Number(req.halaman) || 1;
    k.templatHalaman = String(Math.min(Math.max(1, hal), Number(k.templatTotal)));
    if (req.posisi) k.posisi = JSON.stringify(req.posisi);
    k.diubahOleh = u.nama; k.diubahPada = sekarang_('yyyy-MM-dd HH:mm');
    ubah_('Kegiatan', k._row, k);
    log_(u.nama, 'upload templat', k.id + ' ' + nama);
    return { ok: true };
  });
}

function simpanPosisi_(u, req) {
  return kunci_(function () {
    var k = kegiatan_(req.k);
    if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
    var hal = Number(req.halaman) || 1;
    k.templatHalaman = String(Math.min(Math.max(1, hal), Number(k.templatTotal || 1)));
    k.posisi = JSON.stringify(req.posisi || {});
    k.diubahOleh = u.nama; k.diubahPada = sekarang_('yyyy-MM-dd HH:mm');
    ubah_('Kegiatan', k._row, k);
    return { ok: true };
  });
}

function ambilTemplatAdmin_(req) {
  var k = kegiatan_(req.k);
  if (!k || !k.templatId) return { ok: false, pesan: 'Templat sertifikat belum diunggah.' };
  return { ok: true, halaman: Number(k.templatHalaman || 1), total: Number(k.templatTotal || 1), posisi: posisi_(k), pdf: pdfBase64_(k.templatId) };
}

function peserta_(req) {
  var k = kegiatan_(req.k);
  if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
  var list = rows_('Kehadiran').filter(function (r) { return r.kegiatanId === k.id; }).map(function (r) {
    var o = {};
    SHEETS.Kehadiran.forEach(function (c) { o[c] = r[c]; });
    return o;
  });
  if (req.denganTtd) {
    var ttd = {}, sh = sh_('TTD');
    if (sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (x) { if (String(x[1]) === k.id) ttd[String(x[0])] = String(x[2]); });
    }
    list.forEach(function (o) { o.ttd = ttd[o.id] || ''; });
  }
  list.sort(function (a, b) { return a.waktu < b.waktu ? -1 : 1; });
  var out = { ok: true, kegiatan: infoPublik_(k), peserta: list, pengaturan: pengaturan_() };
  if (req.denganTtd) out.gambar = gambarPengesah_();
  return out;
}

function ubahPeserta_(u, req) {
  var d = req.data || {};
  return kunci_(function () {
    var r = rows_('Kehadiran').filter(function (x) { return x.id === String(d.id); })[0];
    if (!r) return { ok: false, pesan: 'Data peserta tidak ditemukan.' };
    var nama = bersih_(d.nama, 150);
    if (nama.length < 3) return { ok: false, pesan: 'Nama terlalu pendek.' };
    var email = bersih_(d.email, 120).toLowerCase();
    if (email && !emailValid_(email)) return { ok: false, pesan: 'Format email tidak valid.' };
    r.nama = nama; r.email = email;
    r.nim = bersih_(d.nim, 30); r.instansi = bersih_(d.instansi, 150); r.nipNik = bersih_(d.nipNik, 30);
    if (d.prodi) r.prodi = bersih_(d.prodi, 60);
    r.diubahOleh = u.nama; r.diubahPada = sekarang_('yyyy-MM-dd HH:mm');
    ubah_('Kehadiran', r._row, r);
    log_(u.nama, 'ubah peserta', r.id + ' ' + r.nama);
    return { ok: true };
  });
}

function hapusPeserta_(u, req) {
  return kunci_(function () {
    var r = rows_('Kehadiran').filter(function (x) { return x.id === String(req.id); })[0];
    if (!r) return { ok: false, pesan: 'Data peserta tidak ditemukan.' };
    sh_('Kehadiran').deleteRow(r._row);
    var t = sh_('TTD');
    if (t.getLastRow() > 1) {
      var ids = t.getRange(2, 1, t.getLastRow() - 1, 1).getValues();
      for (var i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === r.id) t.deleteRow(i + 2);
    }
    log_(u.nama, 'hapus peserta', r.id + ' ' + r.nama + ' (' + r.kegiatanId + ')');
    return { ok: true };
  });
}

/** Buka akses unduh sertifikat (mode "setelah kegiatan") tanpa/atau sebelum kirim email. */
function bukaSertifikat_(u, req) {
  return kunci_(function () {
    var k = kegiatan_(req.k);
    if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
    if (!k.templatId) return { ok: false, pesan: 'Unggah templat sertifikat dulu.' };
    k.sertifikatDibuka = req.buka === false ? 'TIDAK' : 'YA';
    k.diubahOleh = u.nama; k.diubahPada = sekarang_('yyyy-MM-dd HH:mm');
    ubah_('Kegiatan', k._row, k);
    log_(u.nama, 'sertifikat ' + (k.sertifikatDibuka === 'YA' ? 'dibuka' : 'ditutup'), k.id);
    return { ok: true, dibuka: k.sertifikatDibuka === 'YA' };
  });
}

/** Kirim link sertifikat ke email peserta. req: {k, ids?: [..], ulang?: bool} */
function kirimSertifikat_(u, req) {
  var k = kegiatan_(req.k);
  if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
  if ((k.modeSertifikat || 'tanpa') === 'tanpa') return { ok: false, pesan: 'Kegiatan ini diatur tanpa sertifikat.' };
  if (!k.templatId) return { ok: false, pesan: 'Unggah templat sertifikat dulu.' };
  if (k.sertifikatDibuka !== 'YA') bukaSertifikat_(u, { k: k.id, buka: true });
  k = kegiatan_(req.k);

  var ids = req.ids && req.ids.length ? req.ids.map(String) : null;
  var target = rows_('Kehadiran').filter(function (r) {
    if (r.kegiatanId !== k.id || !r.email) return false;
    if (ids) return ids.indexOf(r.id) >= 0;
    return req.ulang ? true : r.emailStatus !== 'Terkirim';
  });
  var mulai = Date.now(), terkirim = 0, gagal = 0, sisa = 0;
  for (var i = 0; i < target.length; i++) {
    if (Date.now() - mulai > CONFIG.BATAS_WAKTU_KIRIM || MailApp.getRemainingDailyQuota() < 1) { sisa = target.length - i; break; }
    try { kirimEmail_(k, target[i]); tandaiEmail_(target[i].id, 'Terkirim'); terkirim++; }
    catch (e) { tandaiEmail_(target[i].id, 'Gagal: ' + (e.message || e)); gagal++; }
  }
  log_(u.nama, 'kirim sertifikat', k.id + ' terkirim ' + terkirim + ', gagal ' + gagal + ', sisa ' + sisa);
  return { ok: true, terkirim: terkirim, gagal: gagal, sisa: sisa, kuota: MailApp.getRemainingDailyQuota() };
}

/** Tulis status email satu peserta (hanya membaca kolom id agar cepat). */
function tandaiEmail_(id, status) {
  kunci_(function () {
    var sh = sh_('Kehadiran'), h = header_('Kehadiran');
    if (sh.getLastRow() < 2) return;
    var iId = h.indexOf('id'), iS = h.indexOf('emailStatus'), iW = h.indexOf('emailWaktu');
    var ids = sh.getRange(2, iId + 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) !== id) continue;
      sh.getRange(i + 2, iS + 1).setValue(String(status).slice(0, 200));
      sh.getRange(i + 2, iW + 1).setValue(sekarang_('yyyy-MM-dd HH:mm'));
      return;
    }
  });
}

function kirimEmail_(k, r) {
  var link = CONFIG.URL_APLIKASI + 'sertifikat.html?k=' + encodeURIComponent(k.id) + '&p=' + encodeURIComponent(r.id) + '&c=' + encodeURIComponent(r.kode);
  var html =
    '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937">' +
    '<div style="background:#00B8AD;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">' +
    '<div style="font-size:13px;opacity:.9">Jurusan Gizi · Poltekkes Kemenkes Makassar</div>' +
    '<div style="font-size:18px;font-weight:bold;margin-top:4px">Sertifikat Kegiatan</div></div>' +
    '<div style="border:1px solid #e5e7eb;border-top:0;padding:20px;border-radius:0 0 10px 10px">' +
    '<p>Yth. <b>' + esc_(r.nama) + '</b>,</p>' +
    '<p>Terima kasih telah mengikuti kegiatan <b>' + esc_(k.nama) + '</b>' + (k.tanggal ? ' pada ' + tampilWaktu_(k.tanggal) : '') + '. ' +
    'Sertifikat Anda dapat diunduh melalui tombol berikut:</p>' +
    '<p style="text-align:center;margin:24px 0"><a href="' + link + '" style="background:#00B8AD;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;display:inline-block">Unduh Sertifikat</a></p>' +
    '<p style="font-size:12px;color:#6b7280">Jika tombol tidak berfungsi, salin alamat ini ke browser:<br>' + link + '</p>' +
    '<p style="font-size:12px;color:#6b7280">Email ini dikirim otomatis, mohon tidak membalas.</p></div></div>';
  MailApp.sendEmail({
    to: r.email, subject: 'Sertifikat ' + k.nama, htmlBody: html, name: CONFIG.NAMA_PENGIRIM,
    body: 'Yth. ' + r.nama + ',\nSertifikat kegiatan ' + k.nama + ' dapat diunduh di: ' + link
  });
}

function esc_(s) {
  return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}

function simpanPengaturan_(u, req) {
  if (u.peran !== 'superadmin') return { ok: false, pesan: 'Hanya super admin yang dapat mengubah pengaturan.' };
  var d = req.data || {};
  return kunci_(function () {
    var ada = rows_('Pengaturan');
    PENGATURAN_AWAL.forEach(function (p) {
      if (!(p[0] in d)) return;
      var r = ada.filter(function (x) { return x.kunci === p[0]; })[0];
      var v = bersih_(d[p[0]], 150);
      if (r) { r.nilai = v; ubah_('Pengaturan', r._row, r); } else tambah_('Pengaturan', { kunci: p[0], nilai: v, keterangan: p[2] });
    });
    log_(u.nama, 'ubah pengaturan', JSON.stringify(d));
    return { ok: true, pengaturan: pengaturan_() };
  });
}

/* ===================== KODE, EVALUASI, LAPORAN, BERKAS ===================== */
/** "1. A 2. B" / baris baru / titik koma → ['A', 'B'] */
function daftarNarasumber_(t) {
  var s = String(t || '').replace(/\r/g, '').trim();
  if (!s) return [];
  var bagian = /\n/.test(s) ? s.split('\n') : s.split(/\s+(?=\d{1,2}[.)]\s)|;\s*/);
  return bagian.map(function (x) { return x.replace(/^\s*\d{1,2}[.)]\s*/, '').trim(); }).filter(Boolean);
}

function periksaKode_(k, kode, pengenal) {
  var id = normId_(pengenal || '').slice(0, 40) || 'anon';
  var ck = CacheService.getScriptCache(), kunciSalah = 'salah_' + k.id + '_' + id;
  var salah = Number(ck.get(kunciSalah) || 0);
  if (salah >= 5) return { ok: false, kode: 'KODE', pesan: 'Terlalu banyak kode salah. Coba lagi 10 menit lagi atau hubungi panitia.' };
  if (String(kode || '').replace(/\D/g, '') !== String(k.kodeHadir || '')) {
    ck.put(kunciSalah, String(salah + 1), 600);
    return { ok: false, kode: 'KODE', pesan: 'Kode kehadiran salah. Kode diumumkan panitia di ruangan atau di layar Zoom.' };
  }
  return { ok: true };
}

/** Cek kode sebelum evaluasi dibuka (publik). */
function cekKode_(req) {
  var k = kegiatan_(req.k);
  if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
  if (k.wajibKode !== 'YA') return { ok: true };
  if (statusAbsen_(k) !== 'buka') return { ok: false, pesan: 'Daftar hadir sedang tidak dibuka.' };
  return periksaKode_(k, req.kode, req.perangkat);
}

function folderBerkas_(k) {
  var props = PropertiesService.getScriptProperties();
  var akarId = props.getProperty('FOLDER_BERKAS_ID'), akar;
  if (akarId) { try { akar = DriveApp.getFolderById(akarId); } catch (e) { akar = null; } }
  if (!akar) { akar = DriveApp.createFolder('Daftar Hadir Kegiatan - Berkas'); props.setProperty('FOLDER_BERKAS_ID', akar.getId()); }
  var nama = k.id + ' - ' + String(k.nama).slice(0, 80);
  var it = akar.getFoldersByName(nama);
  return it.hasNext() ? it.next() : akar.createFolder(nama);
}

function berkas_(kid, jenis) {
  return rows_('Berkas').filter(function (b) { return b.kegiatanId === kid && (!jenis || b.jenis === jenis); })
    .sort(function (a, b) { return (Number(a.urutan) || 0) - (Number(b.urutan) || 0) || (a.waktu < b.waktu ? -1 : 1); })
    .map(function (b) { return { id: b.id, jenis: b.jenis, nama: b.nama, mime: b.mime, ukuran: Number(b.ukuran) || 0, narasumber: b.narasumber, urutan: Number(b.urutan) || 0, waktu: b.waktu, keterangan: b.keterangan || '' }; });
}

function unggahBerkas_(u, req) {
  var k = kegiatan_(req.k);
  if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
  var jenis = ['materi', 'surat'].indexOf(req.jenis) >= 0 ? req.jenis : 'foto';
  var bytes = Utilities.base64Decode(String(req.data || ''));
  if (!bytes.length) return { ok: false, pesan: 'File kosong.' };
  if (bytes.length > MAKS_BERKAS) return { ok: false, pesan: 'File terlalu besar (maks. 20 MB).' };
  var mime = bersih_(req.mime, 120) || 'application/octet-stream';
  var nama = bersih_(req.nama, 150) || (jenis === 'foto' ? 'foto.jpg' : 'materi');
  var file = folderBerkas_(k).createFile(Utilities.newBlob(bytes, mime, nama));
  return kunci_(function () {
    var urutan = berkas_(k.id, jenis).length + 1;
    var row = { id: 'B' + acak_(8), kegiatanId: k.id, jenis: jenis, nama: nama, fileId: file.getId(), mime: mime, ukuran: bytes.length,
      narasumber: bersih_(req.narasumber, 200), urutan: urutan, diunggahOleh: u.nama, waktu: sekarang_('yyyy-MM-dd HH:mm:ss'),
      keterangan: bersih_(req.keterangan, 200) };
    tambah_('Berkas', row);
    log_(u.nama, 'unggah ' + jenis, k.id + ' ' + nama);
    return { ok: true, berkas: berkas_(k.id) };
  });
}

function hapusBerkas_(u, req) {
  return kunci_(function () {
    var b = rows_('Berkas').filter(function (x) { return x.id === String(req.id); })[0];
    if (!b) return { ok: false, pesan: 'Berkas tidak ditemukan.' };
    try { DriveApp.getFileById(b.fileId).setTrashed(true); } catch (e) { }
    sh_('Berkas').deleteRow(b._row);
    log_(u.nama, 'hapus ' + b.jenis, b.kegiatanId + ' ' + b.nama);
    return { ok: true, berkas: berkas_(b.kegiatanId) };
  });
}

function urutBerkas_(u, req) {
  return kunci_(function () {
    var ids = (req.ids || []).map(String);
    rows_('Berkas').forEach(function (b) {
      var i = ids.indexOf(b.id);
      if (i >= 0 && Number(b.urutan) !== i + 1) { b.urutan = i + 1; ubah_('Berkas', b._row, b); }
    });
    return { ok: true, berkas: berkas_(String(req.k)) };
  });
}

function ambilBerkas_(req) {
  var b = rows_('Berkas').filter(function (x) { return x.id === String(req.id); })[0];
  if (!b) return { ok: false, pesan: 'Berkas tidak ditemukan.' };
  return { ok: true, id: b.id, nama: b.nama, mime: b.mime, data: Utilities.base64Encode(DriveApp.getFileById(b.fileId).getBlob().getBytes()) };
}

/** Materi narasumber untuk peserta (publik). */
function materiPublik_(req) {
  var k = kegiatan_(req.k);
  if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
  return { ok: true, kegiatan: { id: k.id, nama: k.nama, tanggal: k.tanggal }, materi: berkas_(k.id, 'materi') };
}

function unduhMateri_(req) {
  var b = rows_('Berkas').filter(function (x) { return x.id === String(req.id) && x.kegiatanId === String(req.k) && x.jenis === 'materi'; })[0];
  if (!b) return { ok: false, pesan: 'Materi tidak ditemukan.' };
  return { ok: true, nama: b.nama, mime: b.mime, data: Utilities.base64Encode(DriveApp.getFileById(b.fileId).getBlob().getBytes()) };
}

function laporanRow_(kid) {
  return rows_('Laporan').filter(function (r) { return r.kegiatanId === kid; })[0] || null;
}

function ambilLaporan_(req) {
  var k = kegiatan_(req.k);
  if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
  var r = laporanRow_(k.id), data = {};
  if (r) { try { data = JSON.parse(r.data || '{}'); } catch (e) { data = {}; } }
  var peserta = rows_('Kehadiran').filter(function (x) { return x.kegiatanId === k.id; })
    .map(function (x) { return { nama: x.nama, kategori: x.kategori, prodi: x.prodi, instansi: x.instansi, nim: x.nim, nipNik: x.nipNik }; });
  var opsi = { ok: true, laporan: data, diubahPada: r ? r.diubahPada : '', diubahOleh: r ? r.diubahOleh : '',
    berkas: berkas_(k.id), peserta: peserta, narasumber: daftarNarasumber_(k.narasumber),
    evaluasi: evaluasiKegiatan_(k.id), aspek: ASPEK_EVALUASI };
  if (req.denganNama) {
    var st = staf_(), mh = mahasiswa_();
    opsi.namaStaf = Object.keys(st).map(function (x) { return st[x].nama; });
    opsi.namaMhs = Object.keys(mh).map(function (x) { return mh[x].nama + ' — ' + mh[x].nim; });
  }
  return opsi;
}

function simpanLaporan_(u, req) {
  var teks = JSON.stringify(req.data || {});
  if (teks.length > 49000) return { ok: false, pesan: 'Isi notulen terlalu panjang untuk disimpan (maks. ±45.000 karakter). Ringkas beberapa bagian.' };
  return kunci_(function () {
    var k = kegiatan_(req.k);
    if (!k) return { ok: false, pesan: 'Kegiatan tidak ditemukan.' };
    var r = laporanRow_(k.id), now = sekarang_('yyyy-MM-dd HH:mm');
    var o = { kegiatanId: k.id, data: teks, diubahOleh: u.nama, diubahPada: now };
    if (r) ubah_('Laporan', r._row, o); else tambah_('Laporan', o);
    return { ok: true, diubahPada: now };
  });
}

function evaluasiKegiatan_(kid) {
  return rows_('Evaluasi').filter(function (e) { return e.kegiatanId === kid; }).map(function (e) {
    var n = []; try { n = JSON.parse(e.narasumber || '[]'); } catch (x) { }
    return { kategori: e.kategori, a: [e.a1, e.a2, e.a3, e.a4, e.a5].map(Number), n: n.map(Number), saran: e.saran };
  });
}

/** Semua bahan laporan (admin). Foto diambil terpisah lewat ambilBerkas. */
function dataLaporan_(req) {
  var p = peserta_({ k: req.k, denganTtd: true });
  if (!p.ok) return p;
  var l = ambilLaporan_({ k: req.k });
  p.laporan = l.laporan; p.berkas = l.berkas; p.narasumber = l.narasumber;
  p.evaluasi = evaluasiKegiatan_(String(req.k));
  p.aspek = ASPEK_EVALUASI;
  var k = kegiatan_(req.k);
  p.sertifikat = { mode: k.modeSertifikat || 'tanpa', dibuka: k.sertifikatDibuka === 'YA', adaTemplat: !!k.templatId };
  return p;
}

/** Gambar tanda tangan & stempel pengesah (data URL) atau kosong. */
function gambarPengesah_() {
  var pg = pengaturan_(), out = {};
  ['ttd', 'stempel'].forEach(function (j) {
    var id = pg[j + '_file'];
    if (!id) return;
    try { out[j] = 'data:image/png;base64,' + Utilities.base64Encode(DriveApp.getFileById(id).getBlob().getBytes()); } catch (e) { }
  });
  return out;
}

function gambarPengesahan_(u, req) {
  if (u.peran !== 'superadmin') return { ok: false, pesan: 'Hanya super admin yang dapat mengubah tanda tangan & stempel.' };
  var jenis = req.jenis === 'stempel' ? 'stempel' : 'ttd';
  return kunci_(function () {
    var ada = rows_('Pengaturan'), kunciP = jenis + '_file';
    var r = ada.filter(function (x) { return x.kunci === kunciP; })[0];
    var lama = r ? r.nilai : '';
    var baru = '';
    if (req.data) {
      var bytes = Utilities.base64Decode(String(req.data).replace(/^data:image\/\w+;base64,/, ''));
      if (bytes.length > 3 * 1024 * 1024) return { ok: false, pesan: 'Gambar terlalu besar (maks. 3 MB).' };
      var folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID'));
      baru = folder.createFile(Utilities.newBlob(bytes, 'image/png', (jenis === 'ttd' ? 'Tanda tangan' : 'Stempel') + ' pengesah.png')).getId();
    }
    if (lama) { try { DriveApp.getFileById(lama).setTrashed(true); } catch (e) { } }
    if (r) { r.nilai = baru; ubah_('Pengaturan', r._row, r); }
    else tambah_('Pengaturan', { kunci: kunciP, nilai: baru, keterangan: '' });
    log_(u.nama, (baru ? 'unggah ' : 'hapus ') + jenis + ' pengesah', '');
    return { ok: true, gambar: gambarPengesah_() };
  });
}

/* ===================== SSO GIZI-LINK ===================== */
/** Verifikasi token Gizi-Link DOSEN/STAF. {id, nama, ...} atau null. */
function verifikasiStafSSO_(token) {
  try {
    var rahasia = PropertiesService.getScriptProperties().getProperty('SSO_SECRET');
    var bagian = String(token || '').split('.');
    if (!rahasia || bagian.length !== 2) return null;
    var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(bagian[0], rahasia));
    if (sig !== bagian[1]) return null;
    var p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(bagian[0])).getDataAsString('UTF-8'));
    if (!p || p.jenis !== 'staf' || !p.id || !p.exp || Date.now() > Number(p.exp)) return null;
    return p;
  } catch (e) {
    return null;
  }
}

/** Verifikasi token Gizi-Link MAHASISWA. {nim, nama, prodi, kelas, ...} atau null. */
function verifikasiSSO_(token) {
  try {
    var rahasia = PropertiesService.getScriptProperties().getProperty('SSO_SECRET');
    var bagian = String(token || '').split('.');
    if (!rahasia || bagian.length !== 2) return null;
    var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(bagian[0], rahasia));
    if (sig !== bagian[1]) return null;
    var p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(bagian[0])).getDataAsString('UTF-8'));
    if (!p || !p.nim || p.jenis === 'staf' || !p.exp || Date.now() > Number(p.exp)) return null;
    return p;
  } catch (e) {
    return null;
  }
}
