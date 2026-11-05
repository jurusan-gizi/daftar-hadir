// Satu-satunya file yang perlu diubah setelah Apps Script di-deploy.
window.HADIR_CONFIG = {
  // Tempel URL Web App Apps Script "Daftar Hadir Kegiatan" (berakhiran /exec)
  API_URL: 'TEMPEL_URL_APPS_SCRIPT_DI_SINI',
  // Alamat aplikasi ini (untuk link daftar hadir & QR code)
  URL_APLIKASI: 'https://jurusan-gizi.github.io/daftar-hadir/',
  // Data institusi untuk kop rekap daftar hadir
  INSTITUSI: {
    kementerian: 'Kementerian Kesehatan',
    direktorat: 'Direktorat Jenderal Sumber Daya Manusia Kesehatan',
    nama: 'Politeknik Kesehatan Makassar',
    alamat: ['Jalan Wijaya Kusuma Raya No. 46 Banta-Bantaeng', 'Makassar, Sulawesi Selatan 90222'],
    telepon: '08115566606',
    website: 'https://portal.poltekkes-mks.ac.id'
  }
};
