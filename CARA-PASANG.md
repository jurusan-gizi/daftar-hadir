# Cara Pasang — Daftar Hadir Kegiatan (Gizi-Link)

Waktu pemasangan ±20 menit. Semua langkah memakai akun **@poltekkes-mks.ac.id** yang juga memiliki sheet portal Gizi-Link.

---

## Langkah 1 — Database (Google Sheet + Apps Script)

1. Buka Google Drive → **Baru → Google Spreadsheet**, beri nama **Daftar Hadir Kegiatan - Database**.
2. Menu **Ekstensi → Apps Script**.
3. Hapus semua isi `Code.gs`, lalu tempel isi file **`apps-script/Code.gs`**. Tekan **Simpan** (ikon disket).
4. Klik **Setelan Project** (ikon roda gigi di kiri) → bagian **Properti Skrip** → **Tambahkan properti skrip**:

   | Properti | Nilai |
   |---|---|
   | `SSO_SECRET` | *salin dari Properti Skrip Apps Script portal Gizi-Link* (nilainya sama persis) |

   > Rahasia ini jangan dikirim lewat chat/WA. Salin langsung dari Apps Script portal ke Apps Script ini.

5. Kembali ke **Editor**, pilih fungsi **`setup`** di bilah atas → **Jalankan** → izinkan akses (Lanjutan → Buka … → Izinkan).
   Akan terbentuk tab: **Kegiatan, Kehadiran, TTD, EmailMahasiswa, Pengaturan, Log**, plus folder Drive **Daftar Hadir Kegiatan - Templat Sertifikat**.
6. **Terapkan → Deployment baru** → pilih jenis **Aplikasi web**:
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja**
   → **Terapkan** → salin **URL aplikasi web** (berakhiran `/exec`).

## Langkah 2 — Sheet portal Gizi-Link

Buka spreadsheet portal Gizi-Link.

**a. Tab `Staf`** → tambah kolom baru di paling kanan dengan judul persis **`Daftar Hadir`**, lalu isi:

| Nama | Isi kolom Daftar Hadir |
|---|---|
| Manjilala, S.Gz, M.Gizi | `superadmin` |
| Chaerunnimah, SKM, M.Kes | `admin` |
| Thresia Dewi Kartini B, SKM, MSi | `admin` |
| Dr. Sirajuddin, SP, M Kes | `admin` |
| Aswita Amir, DCN, M.Si | `admin` |
| Retno Sri Lestari, SPd, M.Kes | `admin` |
| Hijrah Asikin, SST, M.Biomed | `admin` |
| Nursalim, S.Gz, M.Si | `admin` |

Baris lain dikosongkan. Untuk mengecek, jalankan fungsi **`cekAdmin`** di Apps Script daftar hadir → lihat Log eksekusi.

**b. Tab `Aplikasi`** → tambah satu baris:

| urutan | id | nama | deskripsi | url | ikon | warna | aktif | sso | prodi | staf | badge_api |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | hadir | Daftar Hadir Kegiatan | Isi daftar hadir kegiatan & unduh sertifikat | https://jurusan-gizi.github.io/daftar-hadir/ | ✍️ | #00B8AD | YA | YA | *(kosong)* | YA | *URL /exec dari Langkah 1* |

Kolom `badge_api` membuat kartu menu menampilkan jumlah daftar hadir yang sedang dibuka.

## Langkah 3 — Aplikasi (GitHub)

1. Di akun GitHub **jurusan-gizi**, buat repository baru bernama **`daftar-hadir`** (Public).
2. Unggah semua isi folder ini (kecuali folder `apps-script` boleh ikut, tidak masalah).
3. Edit **`js/config.js`** → ganti `TEMPEL_URL_APPS_SCRIPT_DI_SINI` dengan URL `/exec` dari Langkah 1.
4. **Settings → Pages** → Source: **Deploy from a branch** → Branch **main** / **(root)** → Save.
5. Tunggu 1–2 menit, buka **https://jurusan-gizi.github.io/daftar-hadir/**.

## Langkah 4 — Uji coba

1. Masuk Gizi-Link sebagai dosen (akun Kajur) → buka menu **Daftar Hadir Kegiatan**.
2. **＋ Kegiatan Baru** → isi, centang sasaran, pilih mode sertifikat → Simpan.
3. Tab **Sertifikat** → unggah PDF dari SRIKANDI → cek pratinjau nama → **Simpan posisi**.
4. Tab **Bagikan** → buka link di HP → isi sebagai mahasiswa (NIM), CI, dan umum.
5. Tab **Peserta** & **Rekap** → cek tabel, cetak daftar hadir, unduh Excel.

---

## Catatan penting

- **Sertifikat SRIKANDI**: buat SATU sertifikat di SRIKANDI dengan nama siapa saja (atau "NAMA PESERTA"). Aplikasi menutup nama itu dan menulis nama tiap peserta (otomatis huruf kapital; gelar depan seperti Dr./Prof. dan gelar di belakang koma tetap seperti diketik). Peserta menerima 1 halaman saja.
- **QR TTE** pada sertifikat memverifikasi dokumen asli dari SRIKANDI. Nama peserta ditambahkan oleh aplikasi dan tercatat di database daftar hadir.
- **Kuota email**: akun Google Workspace ±1.500 penerima/hari. Bila sisa peserta belum terkirim (kuota habis / batas waktu), tekan tombol kirim lagi; yang sudah terkirim tidak dikirim ulang.
- **Mengubah tampilan/kode** → setelah mengedit `Code.gs`: **Terapkan → Kelola deployment → ✏️ → Versi: Versi baru → Terapkan** (URL tetap sama).
- **Pengesahan rekap** (nama/NIP Kajur) dapat diubah super admin di menu **⚙️ Pengaturan**.
- Data tanda tangan disimpan di tab **TTD** (terpisah agar tab Kehadiran tetap ringan).
