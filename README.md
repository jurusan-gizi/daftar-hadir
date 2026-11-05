# Daftar Hadir Kegiatan — Jurusan Gizi Poltekkes Kemenkes Makassar

Aplikasi PWA (bagian dari **Gizi-Link**) untuk daftar hadir kuliah tamu, pembekalan, workshop, dll. — dengan **tanda tangan di layar** dan **sertifikat** (PDF dari SRIKANDI, nama peserta ditempel otomatis).

Alamat: **https://jurusan-gizi.github.io/daftar-hadir/** · Panduan pemasangan: **[CARA-PASANG.md](CARA-PASANG.md)**

## Fitur
**Admin** (kolom `Daftar Hadir` di sheet Staf portal: `superadmin` / `admin`)
- Buat kegiatan: sasaran D3 / D4 / Profesi / CI / Umum (boleh lebih dari satu), jadwal buka–tutup absen, mode sertifikat (tanpa / langsung / setelah kegiatan)
- Bagikan: QR code (unduh siap tayang), link, tombol WhatsApp, salin untuk chat Zoom
- Peserta: pantau langsung (diperbarui tiap 20 detik), ubah typo nama, hapus
- Sertifikat: unggah PDF SRIKANDI, atur posisi nama dengan klik di pratinjau, kirim link ke email, unduh semua sertifikat dalam 1 PDF
- Rekap: cetak daftar hadir resmi (kop + tanda tangan peserta + pengesahan Ketua Jurusan), unduh Excel

**Peserta**
- Mahasiswa login Gizi-Link → kegiatan yang dibuka muncul otomatis, data terisi sendiri
- Mahasiswa lewat link/QR → cukup ketik NIM (nama & prodi dari data Gizi-Link)
- CI / umum / mahasiswa belum terdaftar → isi manual
- Mahasiswa: riwayat kehadiran & unduh sertifikat di Gizi-Link

## Struktur
| File | Fungsi |
|---|---|
| `index.html`, `js/app.js` | Halaman admin, mahasiswa, dan tamu |
| `hadir.html`, `js/hadir.js` | Form daftar hadir peserta (publik) |
| `sertifikat.html` | Unduh sertifikat dari link email |
| `rekap.html` | Cetak daftar hadir resmi |
| `js/umum.js` | Fungsi bersama + pembuat sertifikat (pdf-lib) |
| `js/ttd.js` | Pad tanda tangan |
| `js/config.js` | **URL Apps Script** — satu-satunya yang perlu diisi |
| `apps-script/Code.gs` | Server (Google Apps Script) |
| `vendor/` | pdf-lib, pdf.js, qrcode-generator, SheetJS |
