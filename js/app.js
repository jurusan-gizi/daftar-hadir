/* Halaman utama: admin (dosen/staf berperan), mahasiswa (login Gizi-Link), atau tamu */
(function () {
  'use strict';
  var H = window.Hadir, $ = H.$, esc = H.esc;
  var isi = $('isi');
  var DATA = null;                 // hasil adminInit
  var TEMPLAT = {};                // cache templat per kegiatan {bytes, halaman, total, posisi}
  var PESERTA = {};                // cache peserta per kegiatan
  var timer = null;

  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

  function memuat(teks) { isi.innerHTML = '<div class="muat"><span class="putar"></span> ' + esc(teks || 'Memuat…') + '</div>'; }
  function galat(pesan, aksi) {
    isi.innerHTML = '<div class="kartu kosong"><span class="em">⚠️</span><p>' + esc(pesan) + '</p>' + (aksi || '') + '</div>';
  }

  /* =================== MULAI =================== */
  async function mulai() {
    var staf = window.GiziSSO && GiziSSO.getStaf();
    var mhs = window.GiziSSO && GiziSSO.get();
    if (staf) return mulaiAdmin(staf);
    if (mhs) return mulaiMahasiswa(mhs);
    tamu();
  }

  function tamu() {
    $('pengguna').innerHTML = '';
    isi.innerHTML =
      '<section class="pita"><h1>Daftar Hadir Kegiatan</h1><p>Kuliah tamu, pembekalan, workshop, dan kegiatan Jurusan Gizi lainnya — dengan tanda tangan dan sertifikat.</p></section>' +
      '<div class="grid2">' +
      '<div class="kartu"><h3>🎓 Mahasiswa</h3><p class="sub">Masuk lewat Gizi-Link untuk melihat kegiatan yang sedang dibuka, riwayat kehadiran, dan mengunduh sertifikat.</p>' +
      '<button class="tbl penuh" id="masuk-mhs">Masuk Gizi-Link</button></div>' +
      '<div class="kartu"><h3>🧑‍🏫 Dosen / Admin</h3><p class="sub">Kelola kegiatan, bagikan link & QR, cetak daftar hadir, dan kirim sertifikat.</p>' +
      '<button class="tbl garis penuh" id="masuk-staf">Masuk sebagai Dosen/Staf</button></div>' +
      '</div>' +
      '<div class="pesan info">Peserta CI dan umum tidak perlu login — cukup buka link atau scan QR code yang dibagikan panitia.</div>';
    $('masuk-mhs').onclick = function () { GiziSSO.masuk(); };
    $('masuk-staf').onclick = function () { GiziSSO.masuk(location.href, 'staf'); };
  }

  /* =================== MAHASISWA =================== */
  async function mulaiMahasiswa(m) {
    $('pengguna').innerHTML = '<b>' + esc(m.nama) + '</b>' + esc(m.nim);
    memuat('Memuat kegiatan…');
    try {
      var d = await H.api('saya');
      if (!d.ok) {
        if (d.kode === 'AUTH') return galat(d.pesan, '<button class="tbl" onclick="GiziSSO.masuk()">Masuk lagi</button>');
        return galat(d.pesan);
      }
      var buka = d.dibuka.map(function (k) {
        return '<div class="keg"><div class="baris antara"><span class="chip">' + esc(k.jenis || 'Kegiatan') + '</span>' + H.labelAbsen(k.absen) + '</div>' +
          '<h4>' + esc(k.nama) + '</h4><div class="meta">📅 ' + esc(H.tglPanjang(k.tanggal, true)) + (k.tempat ? ' · 📍 ' + esc(k.tempat) : '') + '</div>' +
          '<div class="bawah">' + (k.sudah ? '<span class="lbl buka" style="animation:none">✓ Sudah hadir</span>' :
            '<a class="tbl kecil" href="hadir.html?k=' + encodeURIComponent(k.id) + '">✍️ Isi Daftar Hadir</a>') + '</div></div>';
      }).join('');
      var riw = d.riwayat.map(function (r) {
        var aksi = r.sertifikatSiap && r.unduh ? '<a class="tbl kecil" href="' + H.linkSertifikat(r.kegiatanId, r.unduh) + '">📄 Sertifikat</a>' :
          r.modeSertifikat === 'tanpa' ? '<span class="kecil">Tanpa sertifikat</span>' : '<span class="lbl belum">Sertifikat belum terbit</span>';
        return '<tr><td><b>' + esc(r.kegiatan) + '</b><br><span class="kecil">' + esc(r.jenis || '') + ' · ' + esc(H.tglPanjang(r.tanggal)) + '</span></td>' +
          '<td class="kecil">' + esc(r.waktuHadir) + '</td><td class="aksi">' + aksi +
          (r.jumlahMateri ? ' <a class="tbl garis kecil" href="materi.html?k=' + encodeURIComponent(r.kegiatanId) + '">📚 Materi</a>' : '') + '</td></tr>';
      }).join('');
      isi.innerHTML =
        '<section class="pita"><h1>Halo, ' + esc(d.profil.nama) + '</h1><p>' + esc(d.profil.nim) + ' · ' + esc(d.profil.prodi) + '</p></section>' +
        '<div class="kartu"><h3>Daftar hadir yang sedang dibuka</h3>' +
        (buka ? '<div class="daftar-keg">' + buka + '</div>' : '<div class="kosong"><span class="em">📭</span>Belum ada daftar hadir yang dibuka untuk prodi Anda.</div>') + '</div>' +
        '<div class="kartu"><h3>Riwayat kehadiran & sertifikat</h3>' +
        (riw ? '<div class="tabel-wrap"><table class="tabel"><thead><tr><th>Kegiatan</th><th>Waktu hadir</th><th></th></tr></thead><tbody>' + riw + '</tbody></table></div>' :
          '<div class="kosong"><span class="em">🗂️</span>Belum ada riwayat kehadiran.</div>') + '</div>';
    } catch (e) { galat(e.message); }
  }

  /* =================== ADMIN =================== */
  async function mulaiAdmin(s) {
    $('pengguna').innerHTML = '<b>' + esc(s.nama) + '</b>Dosen/Staf';
    memuat('Memuat data kegiatan…');
    try {
      var d = await H.api('adminInit');
      if (!d.ok) {
        if (d.kode === 'AKSES') return galat(d.pesan);
        return galat(d.pesan, '<button class="tbl" onclick="GiziSSO.masuk(location.href,\'staf\')">Masuk lagi</button>');
      }
      DATA = d;
      $('pengguna').innerHTML = '<b>' + esc(d.user.nama) + '</b>' + (d.user.peran === 'superadmin' ? 'Super Admin' : 'Admin');
      window.addEventListener('hashchange', rute);
      rute();
    } catch (e) { galat(e.message); }
  }

  async function segarkan() {
    var d = await H.api('adminInit');
    if (d.ok) DATA = d;
    return d;
  }

  function cariKeg(id) { return (DATA.kegiatan || []).filter(function (k) { return k.id === id; })[0]; }

  function rute() {
    if (timer) { clearInterval(timer); timer = null; }
    var h = location.hash.replace(/^#\/?/, '').split('/');
    window.scrollTo(0, 0);
    if (h[0] === 'baru') return formKegiatan(null);
    if (h[0] === 'edit') return formKegiatan(cariKeg(h[1]));
    if (h[0] === 'k' && cariKeg(h[1])) return detail(cariKeg(h[1]), h[2] || 'bagikan');
    if (h[0] === 'pengaturan' && DATA.user.peran === 'superadmin') return pengaturan();
    beranda();
  }

  /* ---------- Beranda admin ---------- */
  function beranda() {
    var keg = DATA.kegiatan;
    var dibuka = keg.filter(function (k) { return k.absen === 'buka'; }).length;
    var total = keg.reduce(function (a, k) { return a + k.jumlah; }, 0);
    isi.innerHTML =
      '<section class="pita"><h1>Halo, ' + esc(DATA.user.nama) + '</h1><p>Kelola daftar hadir kuliah tamu, pembekalan, workshop, dan kegiatan Jurusan Gizi.</p></section>' +
      '<div class="statistik">' +
      '<div class="stat"><b>' + keg.length + '</b><span>Kegiatan</span></div>' +
      '<div class="stat"><b>' + dibuka + '</b><span>Absen dibuka</span></div>' +
      '<div class="stat"><b>' + total + '</b><span>Total kehadiran</span></div>' +
      '<div class="stat"><b>' + DATA.kuotaEmail + '</b><span>Sisa kuota email hari ini</span></div>' +
      '</div>' +
      '<div class="baris antara" style="margin-bottom:12px"><a class="tbl" href="#/baru">＋ Kegiatan Baru</a>' +
      (DATA.user.peran === 'superadmin' ? '<a class="tbl garis" href="#/pengaturan">⚙️ Pengaturan</a>' : '') + '</div>' +
      '<div class="saring"><input type="search" id="cari" placeholder="Cari nama kegiatan, narasumber, tempat…">' +
      '<select id="filter"><option value="">Semua status</option><option value="buka">Absen dibuka</option><option value="belum">Belum dibuka</option><option value="tutup">Ditutup</option></select></div>' +
      '<div id="daftar"></div>';
    function gambar() {
      var q = $('cari').value.toLowerCase(), f = $('filter').value;
      var list = keg.filter(function (k) {
        return (!f || k.absen === f) && (!q || (k.nama + ' ' + k.narasumber + ' ' + k.tempat + ' ' + k.jenis).toLowerCase().indexOf(q) >= 0);
      });
      $('daftar').innerHTML = list.length ? '<div class="daftar-keg">' + list.map(kartuKeg).join('') + '</div>' :
        '<div class="kartu kosong"><span class="em">🗓️</span>' + (keg.length ? 'Tidak ada kegiatan yang cocok.' : 'Belum ada kegiatan. Tekan <b>＋ Kegiatan Baru</b> untuk memulai.') + '</div>';
    }
    $('cari').oninput = gambar; $('filter').onchange = gambar;
    $('daftar').addEventListener('click', function (e) { var c = e.target.closest('[data-id]'); if (c) location.hash = '#/k/' + c.dataset.id; });
    gambar();
  }

  function kartuKeg(k) {
    return '<div class="keg" data-id="' + esc(k.id) + '">' +
      '<div class="baris antara"><span class="chip">' + esc(k.jenis || 'Kegiatan') + '</span>' + H.labelAbsen(k.absen) + '</div>' +
      '<h4>' + esc(k.nama) + '</h4>' +
      '<div class="meta">📅 ' + esc(H.tglPanjang(k.tanggal, true)) + (k.tempat ? ' · 📍 ' + esc(k.tempat) : '') + '</div>' +
      '<div>' + k.sasaran.map(function (s) { return '<span class="chip">' + esc(H.SASARAN[s]) + '</span>'; }).join('') + '</div>' +
      '<div class="bawah"><span class="kecil">' + esc(H.labelMode(k.modeSertifikat)) + '</span><span class="angka">' + k.jumlah + ' <small>hadir</small></span></div></div>';
  }

  /* ---------- Form kegiatan ---------- */
  function formKegiatan(k) {
    var baru = !k;
    k = k || { sasaran: [], modeSertifikat: 'tanpa' };
    var penyelenggara = ['Jurusan Gizi', 'Prodi D3 Gizi', 'Prodi Sarjana Terapan Gizi dan Dietetika', 'Prodi Pendidikan Profesi Dietisien'];
    isi.innerHTML =
      '<div class="baris" style="margin-bottom:12px"><a class="tbl garis kecil" href="' + (baru ? '#/' : '#/k/' + esc(k.id)) + '">← Kembali</a></div>' +
      '<form class="kartu" id="fk" novalidate><h2>' + (baru ? 'Kegiatan Baru' : 'Ubah Kegiatan') + '</h2><p class="sub">Isian bertanda <span style="color:var(--merah)">*</span> wajib.</p>' +
      '<label class="f"><span>Nama kegiatan <i>*</i></span><input type="text" id="f-nama" value="' + esc(k.nama || '') + '" placeholder="Contoh: Kuliah Pakar &quot;Nutrition Care Process (NCP) pada Atlet&quot;"></label>' +
      '<div class="grid2">' +
      '<label class="f"><span>Jenis kegiatan</span><input type="text" id="f-jenis" list="dl-jenis" value="' + esc(k.jenis || '') + '" placeholder="Kuliah Tamu, Pembekalan, Workshop…">' +
      '<datalist id="dl-jenis">' + H.JENIS.map(function (j) { return '<option value="' + esc(j) + '">'; }).join('') + '</datalist></label>' +
      '<label class="f"><span>Penyelenggara</span><input type="text" id="f-peny" list="dl-peny" value="' + esc(k.penyelenggara || '') + '" placeholder="Jurusan / Prodi">' +
      '<datalist id="dl-peny">' + penyelenggara.map(function (j) { return '<option value="' + esc(j) + '">'; }).join('') + '</datalist></label>' +
      '<label class="f"><span>Tanggal <i>*</i></span><input type="date" id="f-tgl" value="' + esc(k.tanggal || '') + '"></label>' +
      '<label class="f"><span>Waktu pelaksanaan</span><input type="text" id="f-waktu" value="' + esc(k.waktu || '') + '" placeholder="Contoh: 08.00–12.00 WITA"></label>' +
      '<label class="f"><span>Tempat</span><input type="text" id="f-tempat" value="' + esc(k.tempat || '') + '" placeholder="Contoh: Aula Jurusan Gizi / Zoom Meeting"></label>' +
      '<label class="f"><span>Narasumber</span><input type="text" id="f-nara" value="' + esc(k.narasumber || '') + '"></label>' +
      '</div>' +
      '<label class="f"><span>Sasaran peserta <i>*</i> <em class="kecil" style="font-style:normal;font-weight:400">— boleh lebih dari satu</em></span></label>' +
      '<div class="pilihan" id="f-sasaran" style="margin-bottom:14px">' + Object.keys(H.SASARAN).map(function (s) {
        return '<label><input type="checkbox" value="' + s + '"' + (k.sasaran.indexOf(s) >= 0 ? ' checked' : '') + '> ' + esc(H.SASARAN[s]) + '</label>';
      }).join('') + '</div>' +
      '<div class="grid2">' +
      '<label class="f"><span>Absen dibuka</span><input type="datetime-local" id="f-buka" value="' + esc(k.bukaAbsen || '') + '"><small>Kosongkan = langsung dibuka.</small></label>' +
      '<label class="f"><span>Absen ditutup</span><input type="datetime-local" id="f-tutup" value="' + esc(k.tutupAbsen || '') + '"><small>Kosongkan = dibuka sampai ditutup manual.</small></label>' +
      '</div>' +
      '<label class="f"><span>Sertifikat</span></label>' +
      '<div class="pilihan" id="f-mode" style="margin-bottom:6px">' +
      [['tanpa', 'Tanpa sertifikat'], ['langsung', 'Langsung setelah absen'], ['setelah', 'Dikirim setelah kegiatan']].map(function (m) {
        return '<label><input type="radio" name="mode" value="' + m[0] + '"' + (k.modeSertifikat === m[0] ? ' checked' : '') + '> ' + m[1] + '</label>';
      }).join('') + '</div>' +
      '<p class="kecil" style="margin:0 0 16px">PDF sertifikat dari SRIKANDI diunggah di tab <b>Sertifikat</b> setelah kegiatan disimpan.</p>' +
      '<label class="f"><span>Pengamanan</span></label>' +
      '<div class="pilihan" style="margin-bottom:4px"><label><input type="checkbox" id="f-kode"' + (baru || k.wajibKode ? ' checked' : '') + '> 🔐 Wajib kode kehadiran</label></div>' +
      '<p class="kecil" style="margin:0 0 10px">Kode 4 angka diumumkan panitia di ruangan / layar Zoom. Orang yang hanya menerima link tanpa hadir tidak dapat mengisi.</p>' +
      '<div class="pilihan" style="margin-bottom:4px"><label><input type="checkbox" id="f-eval"' + (baru || k.evaluasi ? ' checked' : '') + '> ⭐ Evaluasi kepuasan peserta</label></div>' +
      '<p class="kecil" style="margin:0 0 16px">5 aspek + nilai per narasumber (bintang 1–5), wajib diisi peserta setelah kode kehadiran benar. Hasilnya masuk otomatis ke laporan.</p>' +
      '<button class="tbl penuh" id="f-simpan" type="submit">' + (baru ? 'Simpan & Lanjut' : 'Simpan Perubahan') + '</button>' +
      '</form>';

    // Isi otomatis jam absen saat tanggal dipilih
    $('f-tgl').addEventListener('change', function () {
      var t = this.value; if (!t) return;
      if (!$('f-buka').value) $('f-buka').value = t + 'T07:00';
      if (!$('f-tutup').value) $('f-tutup').value = t + 'T23:59';
    });

    $('fk').onsubmit = async function (e) {
      e.preventDefault();
      var data = {
        id: k.id || '', nama: $('f-nama').value, jenis: $('f-jenis').value, penyelenggara: $('f-peny').value,
        tanggal: $('f-tgl').value, waktu: $('f-waktu').value, tempat: $('f-tempat').value, narasumber: $('f-nara').value,
        sasaran: [].map.call(document.querySelectorAll('#f-sasaran input:checked'), function (x) { return x.value; }),
        bukaAbsen: $('f-buka').value, tutupAbsen: $('f-tutup').value,
        modeSertifikat: (document.querySelector('#f-mode input:checked') || {}).value || 'tanpa',
        wajibKode: $('f-kode').checked, evaluasi: $('f-eval').checked
      };
      if (data.nama.trim().length < 3) return H.toast('Nama kegiatan wajib diisi.', true);
      if (!data.tanggal) return H.toast('Tanggal kegiatan wajib diisi.', true);
      if (!data.sasaran.length) return H.toast('Pilih minimal satu sasaran peserta.', true);
      var b = $('f-simpan'); b.disabled = true; b.innerHTML = '<span class="putar kcl"></span> Menyimpan…';
      try {
        var r = await H.api('simpanKegiatan', { data: data });
        if (!r.ok) { H.toast(r.pesan, true); return; }
        await segarkan();
        H.toast('Kegiatan tersimpan.');
        location.hash = '#/k/' + r.id + (baru ? '/bagikan' : '');
      } catch (err) { H.toast(err.message, true); }
      finally { if (b.isConnected) { b.disabled = false; b.textContent = baru ? 'Simpan & Lanjut' : 'Simpan Perubahan'; } }
    };
  }

  /* ---------- Detail kegiatan ---------- */
  function detail(k, tab) {
    var tabs = [['bagikan', '🔗 Bagikan'], ['peserta', '👥 Peserta'], ['notulensi', '📝 Notulensi'], ['dokumentasi', '📷 Dokumentasi'], ['materi', '📚 Materi'],
      ['surat', '✉️ Surat'], ['evaluasi', '⭐ Evaluasi'], ['sertifikat', '📄 Sertifikat'], ['rekap', '📑 Laporan']];
    isi.innerHTML =
      '<div class="baris antara" style="margin-bottom:12px"><a class="tbl garis kecil" href="#/">← Semua kegiatan</a>' +
      '<div class="baris"><a class="tbl garis kecil" href="#/edit/' + esc(k.id) + '">✏️ Ubah</a>' +
      (DATA.user.peran === 'superadmin' ? '<button class="tbl bahaya kecil" id="hapus-keg">🗑️ Hapus</button>' : '') + '</div></div>' +
      '<section class="pita">' +
      '<p style="margin:0 0 4px;opacity:.85">' + esc(k.jenis || 'Kegiatan') + (k.penyelenggara ? ' · ' + esc(k.penyelenggara) : '') + '</p>' +
      '<h1>' + esc(k.nama) + '</h1><div class="meta">' +
      '<span>📅 ' + esc(H.tglPanjang(k.tanggal, true)) + (k.waktu ? ', ' + esc(k.waktu) : '') + '</span>' +
      (k.tempat ? '<span>📍 ' + esc(k.tempat) + '</span>' : '') + (k.narasumber ? '<span>🎤 ' + H.narasumberHtml(k.narasumber) + '</span>' : '') +
      '<span>👥 ' + k.sasaran.map(function (s) { return esc(H.SASARAN[s]); }).join(', ') + '</span></div></section>' +
      '<div class="kartu"><div class="baris antara"><div>' + H.labelAbsen(k.absen) +
      ' <span class="kecil">' + (k.bukaAbsen ? 'Buka ' + esc(H.waktuPanjang(k.bukaAbsen)) : 'Buka langsung') + ' · ' +
      (k.tutupAbsen ? 'Tutup ' + esc(H.waktuPanjang(k.tutupAbsen)) : 'tutup manual') + '</span></div>' +
      '<div class="pilihan" id="status-absen">' + [['otomatis', 'Ikuti jadwal'], ['buka', 'Buka sekarang'], ['tutup', 'Tutup sekarang']].map(function (s) {
        return '<label><input type="radio" name="sa" value="' + s[0] + '"' + (k.statusAbsen === s[0] ? ' checked' : '') + '> ' + s[1] + '</label>';
      }).join('') + '</div></div>' +
      (k.wajibKode ? '<div class="garis-atas baris antara"><div><span class="kecil">🔐 Kode kehadiran — umumkan di ruangan / layar Zoom, jangan dibagikan di grup</span>' +
        '<div style="font-size:34px;font-weight:800;letter-spacing:8px;color:var(--teal-tua);line-height:1.2" id="kode-tampil">' + esc(k.kodeHadir) + '</div></div>' +
        '<div class="baris"><button class="tbl" id="kode-layar">🖥️ Tampilkan layar penuh</button><button class="tbl garis" id="kode-ganti">🔄 Ganti kode</button></div></div>' : '') +
      '</div>' +
      '<div class="tab" id="tab">' + tabs.map(function (t) { return '<button data-t="' + t[0] + '"' + (t[0] === tab ? ' class="aktif"' : '') + '>' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div id="isi-tab"></div>';

    $('tab').onclick = function (e) { var b = e.target.closest('button'); if (b) location.hash = '#/k/' + k.id + '/' + b.dataset.t; };
    var aktifTab = document.querySelector('#tab button.aktif'); if (aktifTab && aktifTab.scrollIntoView) aktifTab.scrollIntoView({ block: 'nearest', inline: 'center' });
    $('status-absen').onchange = async function (e) {
      try {
        var r = await H.api('aturAbsen', { k: k.id, status: e.target.value });
        if (!r.ok) return H.toast(r.pesan, true);
        await segarkan(); H.toast('Status absen diperbarui.'); rute();
      } catch (err) { H.toast(err.message, true); }
    };
    if ($('kode-layar')) $('kode-layar').onclick = function () { layarKode(cariKeg(k.id)); };
    if ($('kode-ganti')) $('kode-ganti').onclick = async function () {
      if (!await H.konfirmasi('Ganti kode kehadiran?', 'Kode lama langsung tidak berlaku. Umumkan kode baru kepada peserta yang hadir.', 'Ganti kode')) return;
      var r = await H.api('gantiKode', { k: k.id });
      if (!r.ok) return H.toast(r.pesan, true);
      await segarkan(); $('kode-tampil').textContent = r.kodeHadir; H.toast('Kode baru: ' + r.kodeHadir);
    };
    if ($('hapus-keg')) $('hapus-keg').onclick = async function () {
      if (!await H.konfirmasi('Hapus kegiatan?', 'Kegiatan <b>' + esc(k.nama) + '</b> akan disembunyikan dari aplikasi. Data kehadiran tetap tersimpan di Google Sheet.', 'Hapus', true)) return;
      var r = await H.api('hapusKegiatan', { k: k.id });
      if (!r.ok) return H.toast(r.pesan, true);
      await segarkan(); H.toast('Kegiatan dihapus.'); location.hash = '#/';
    };

    ({ bagikan: tabBagikan, peserta: tabPeserta, notulensi: tabNotulensi, dokumentasi: tabDokumentasi, materi: tabMateri, surat: tabSurat, evaluasi: tabEvaluasi,
      sertifikat: tabSertifikat, rekap: tabRekap }[tab] || tabBagikan)(k);
  }

  /** Kode kehadiran ukuran besar untuk ditayangkan di proyektor / share screen Zoom. */
  function layarKode(k) {
    var l = document.createElement('div');
    l.style.cssText = 'position:fixed;inset:0;z-index:80;background:linear-gradient(135deg,#00B8AD,#007F7F);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;cursor:pointer';
    l.innerHTML = '<img src="logo.png" alt="" style="height:70px;background:#fff;border-radius:14px;padding:8px 14px;margin-bottom:28px">' +
      '<div style="font-size:clamp(18px,3vw,30px);font-weight:600;opacity:.9;max-width:90vw">' + esc(k.nama) + '</div>' +
      '<div style="font-size:clamp(16px,2.2vw,24px);margin-top:26px;opacity:.85">KODE KEHADIRAN</div>' +
      '<div style="font-size:clamp(90px,22vw,260px);font-weight:800;letter-spacing:.12em;line-height:1;margin:6px 0 18px;text-shadow:0 6px 30px rgba(0,0,0,.2)">' + esc(k.kodeHadir) + '</div>' +
      '<div style="font-size:clamp(14px,2vw,22px);background:rgba(255,255,255,.15);padding:10px 22px;border-radius:999px">Buka link daftar hadir → masukkan kode ini</div>' +
      '<div style="position:absolute;bottom:18px;font-size:13px;opacity:.7">Klik di mana saja atau tekan Esc untuk menutup</div>';
    function tutup() { if (document.fullscreenElement) document.exitFullscreen().catch(function () { }); l.remove(); document.removeEventListener('keydown', esc_); }
    function esc_(e) { if (e.key === 'Escape') tutup(); }
    l.onclick = tutup; document.addEventListener('keydown', esc_);
    document.body.appendChild(l);
    if (l.requestFullscreen) l.requestFullscreen().catch(function () { });
  }

  /* ---------- Tab: Bagikan ---------- */
  function teksUndangan(k, link) {
    return '*DAFTAR HADIR*\n' + k.nama + '\n📅 ' + H.tglPanjang(k.tanggal, true) + (k.waktu ? ', ' + k.waktu : '') +
      (k.tempat ? '\n📍 ' + k.tempat : '') + '\n\nSilakan isi daftar hadir melalui link berikut:\n' + link +
      (k.wajibKode ? '\n\n🔐 Siapkan *kode kehadiran* yang akan diumumkan panitia selama kegiatan.' : '') +
      (k.tutupAbsen ? '\n\nDaftar hadir ditutup ' + H.waktuPanjang(k.tutupAbsen) + '.' : '');
  }

  function tabBagikan(k) {
    var link = H.linkHadir(k.id);
    var qr = H.qrDataUrl(link, 8);
    var teks = teksUndangan(k, link);
    $('isi-tab').innerHTML =
      '<div class="kartu"><div class="bagikan">' +
      '<div class="qr-kotak"><img src="' + qr + '" alt="QR code daftar hadir"><p class="kecil" style="margin:6px 0 10px">Scan untuk mengisi daftar hadir</p>' +
      '<button class="tbl lembut kecil" id="unduh-qr">⬇️ Unduh QR untuk slide</button></div>' +
      '<div><h3>Link daftar hadir</h3>' +
      '<div class="link-kotak" style="margin-bottom:10px"><input type="text" readonly id="link" value="' + esc(link) + '"><button class="tbl" id="salin">Salin</button></div>' +
      '<div class="baris" style="margin-bottom:16px">' +
      '<a class="tbl wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(teks) + '">💬 Bagikan ke WhatsApp</a>' +
      '<button class="tbl garis" id="salin-zoom">🎥 Salin untuk chat Zoom</button>' +
      (navigator.share ? '<button class="tbl garis" id="share">📤 Bagikan…</button>' : '') +
      '<a class="tbl garis" target="_blank" rel="noopener" href="' + esc(link) + '">↗ Buka form</a></div>' +
      '<label class="f"><span>Pesan WhatsApp</span><textarea id="teks-wa" rows="8">' + esc(teks) + '</textarea><small>Boleh diedit sebelum disalin.</small></label>' +
      '<button class="tbl lembut kecil" id="salin-wa">Salin pesan</button></div>' +
      '</div></div>';
    function salin(t, pesan) {
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { H.toast(pesan || 'Tersalin.'); })
        .catch(function () { var el = $('link'); el.select(); document.execCommand('copy'); H.toast(pesan || 'Tersalin.'); });
    }
    $('salin').onclick = function () { salin(link, 'Link tersalin.'); };
    $('salin-zoom').onclick = function () { salin('Daftar hadir ' + k.nama + ': ' + link, 'Tersalin — tempel di chat Zoom.'); };
    $('salin-wa').onclick = function () { salin($('teks-wa').value, 'Pesan tersalin.'); };
    if ($('share')) $('share').onclick = function () { navigator.share({ title: 'Daftar Hadir ' + k.nama, text: $('teks-wa').value }).catch(function () { }); };
    $('unduh-qr').onclick = function () { posterQr(k, link); };
  }

  /** Gambar QR siap tayang: logo, nama kegiatan, QR besar, link. */
  function posterQr(k, link) {
    var W = 1200, Hh = 1500, c = document.createElement('canvas'), x = c.getContext('2d');
    c.width = W; c.height = Hh;
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, Hh);
    x.fillStyle = '#00B8AD'; x.fillRect(0, 0, W, 18); x.fillStyle = '#CDDC29'; x.fillRect(0, 18, W, 8);
    var logo = new Image(), qr = new Image(), n = 0;
    function siap() {
      if (++n < 2) return;
      var lw = 560, lh = logo.height * lw / logo.width;
      x.drawImage(logo, (W - lw) / 2, 70, lw, lh);
      x.textAlign = 'center'; x.fillStyle = '#007F7F';
      x.font = '800 54px "Plus Jakarta Sans", Arial, sans-serif';
      x.fillText('DAFTAR HADIR', W / 2, 70 + lh + 90);
      x.fillStyle = '#1F2D3A'; x.font = '700 38px "Plus Jakarta Sans", Arial, sans-serif';
      var baris = bungkus(x, k.nama, W - 160), y = 70 + lh + 160;
      baris.slice(0, 3).forEach(function (b) { x.fillText(b, W / 2, y); y += 50; });
      x.fillStyle = '#64748B'; x.font = '500 30px "Plus Jakarta Sans", Arial, sans-serif';
      x.fillText(H.tglPanjang(k.tanggal, true) + (k.tempat ? ' · ' + k.tempat : ''), W / 2, y + 10);
      var q = 720, qy = y + 50;
      x.imageSmoothingEnabled = false;
      x.drawImage(qr, (W - q) / 2, qy, q, q);
      x.fillStyle = '#1F2D3A'; x.font = '600 32px "Plus Jakarta Sans", Arial, sans-serif';
      x.fillText('Scan QR untuk mengisi daftar hadir', W / 2, qy + q + 60);
      x.fillStyle = '#007F7F'; x.font = '500 24px "Plus Jakarta Sans", Arial, sans-serif';
      x.fillText(link, W / 2, qy + q + 105);
      c.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'QR Daftar Hadir - ' + H.namaFile(k.nama) + '.png'; a.click(); });
    }
    logo.onload = siap; qr.onload = siap;
    logo.src = 'logo.png'; qr.src = H.qrDataUrl(link, 20);
  }

  function bungkus(ctx, teks, maks) {
    var kata = String(teks).split(' '), out = [], b = '';
    kata.forEach(function (w) { var c = b ? b + ' ' + w : w; if (ctx.measureText(c).width > maks && b) { out.push(b); b = w; } else b = c; });
    if (b) out.push(b);
    return out;
  }

  /* ---------- Tab: Peserta ---------- */
  async function muatPeserta(k, denganTtd) {
    var d = await H.api('peserta', { k: k.id, denganTtd: !!denganTtd });
    if (!d.ok) throw new Error(d.pesan);
    PESERTA[k.id] = d;
    return d;
  }

  async function tabPeserta(k) {
    var wadah = $('isi-tab');
    wadah.innerHTML = '<div class="muat"><span class="putar"></span> Memuat peserta…</div>';
    var q = '';
    async function muat(diam) {
      try {
        var d = await muatPeserta(k);
        if (!$('isi-tab') || location.hash.indexOf('/peserta') < 0) return;
        gambar(d.peserta);
      } catch (e) { if (!diam) wadah.innerHTML = '<div class="pesan galat">' + esc(e.message) + '</div>'; }
    }
    function gambar(list) {
      var hitung = { Mahasiswa: 0, CI: 0, Umum: 0, 'Dosen/PLP/Tendik': 0 }, prodi = {};
      list.forEach(function (p) { hitung[p.kategori] = (hitung[p.kategori] || 0) + 1; if (p.kategori === 'Mahasiswa') prodi[p.prodi] = (prodi[p.prodi] || 0) + 1; });
      var serti = k.modeSertifikat !== 'tanpa' && k.adaTemplat;
      var tampil = list.filter(function (p) { return !q || (p.nama + ' ' + p.nim + ' ' + p.instansi + ' ' + p.email + ' ' + p.prodi).toLowerCase().indexOf(q) >= 0; });
      wadah.innerHTML =
        '<div class="statistik"><div class="stat"><b>' + list.length + '</b><span>Total hadir</span></div>' +
        Object.keys(prodi).map(function (p) { return '<div class="stat"><b>' + prodi[p] + '</b><span>' + esc(p) + '</span></div>'; }).join('') +
        (hitung['Dosen/PLP/Tendik'] ? '<div class="stat"><b>' + hitung['Dosen/PLP/Tendik'] + '</b><span>Dosen/PLP/Tendik</span></div>' : '') +
        (hitung.CI ? '<div class="stat"><b>' + hitung.CI + '</b><span>CI</span></div>' : '') +
        (hitung.Umum ? '<div class="stat"><b>' + hitung.Umum + '</b><span>Umum</span></div>' : '') + '</div>' +
        '<div class="saring"><input type="search" id="cari-p" placeholder="Cari nama, NIM, instansi, email…" value="' + esc(q) + '">' +
        '<button class="tbl garis" id="segar">↻ Muat ulang</button></div>' +
        (tampil.length ? '<div class="tabel-wrap"><table class="tabel"><thead><tr><th>No</th><th>Jam</th><th>Nama</th><th>NIM / NIP/NIK</th><th>Prodi / Instansi</th><th>Email</th>' +
          (k.modeSertifikat !== 'tanpa' ? '<th>Sertifikat</th>' : '') + '<th></th></tr></thead><tbody>' +
          tampil.map(function (p, i) {
            var st = p.emailStatus === 'Terkirim' ? '<span class="lbl buka" style="animation:none">Terkirim</span>' :
              /^Gagal/.test(p.emailStatus) ? '<span class="lbl merah" title="' + esc(p.emailStatus) + '">Gagal</span>' :
                p.email ? '<span class="lbl tutup">Belum</span>' : '<span class="kecil">—</span>';
            return '<tr><td>' + (i + 1) + '</td><td class="kecil">' + esc(H.jam(p.waktu)) + '</td>' +
              '<td><b>' + esc(p.nama) + '</b>' + (p.sumber === 'manual' ? ' <span class="lbl lime" title="Diisi manual">manual</span>' : '') + '<br><span class="kecil">' + esc(p.kategori) + '</span></td>' +
              '<td>' + esc(p.nim || p.nipNik || '—') + '</td><td>' + esc(p.kategori === 'Mahasiswa' ? p.prodi + (p.kelas ? ' · ' + p.kelas : '') : p.instansi) + '</td>' +
              '<td class="kecil">' + esc(p.email || '—') + '</td>' +
              (k.modeSertifikat !== 'tanpa' ? '<td>' + st + '</td>' : '') +
              '<td class="aksi">' + (serti ? '<button class="tbl lembut ikon kecil" data-a="unduh" data-id="' + p.id + '" title="Unduh sertifikat">📄</button> ' : '') +
              '<button class="tbl garis ikon kecil" data-a="ubah" data-id="' + p.id + '" title="Ubah">✏️</button> ' +
              '<button class="tbl bahaya ikon kecil" data-a="hapus" data-id="' + p.id + '" title="Hapus">🗑️</button></td></tr>';
          }).join('') + '</tbody></table></div>' :
          '<div class="kartu kosong"><span class="em">👥</span>' + (list.length ? 'Tidak ada yang cocok.' : 'Belum ada peserta yang mengisi daftar hadir.') + '</div>') +
        '<p class="kecil">Daftar diperbarui otomatis setiap 20 detik selama halaman ini terbuka.</p>';
      $('cari-p').oninput = function () { q = this.value.toLowerCase(); gambar(list); var c = $('cari-p'); c.focus(); c.setSelectionRange(c.value.length, c.value.length); };
      $('segar').onclick = function () { muat(); };
      wadah.querySelector('table') && wadah.querySelector('table').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-a]'); if (!b) return;
        var p = list.filter(function (x) { return x.id === b.dataset.id; })[0];
        if (b.dataset.a === 'ubah') ubahPeserta(k, p, muat);
        if (b.dataset.a === 'hapus') hapusPeserta(p, muat);
        if (b.dataset.a === 'unduh') unduhSatu(k, p, b);
      });
    }
    await muat();
    timer = setInterval(function () { if (document.visibilityState === 'visible') muat(true); }, 20000);
  }

  async function ubahPeserta(k, p, selesai) {
    var mhs = p.kategori === 'Mahasiswa';
    var html = '<label class="f"><span>Nama ' + (mhs ? '' : '& gelar') + '</span><input type="text" id="u-nama" value="' + esc(p.nama) + '"></label>' +
      (mhs ? '<label class="f"><span>NIM</span><input type="text" id="u-nim" value="' + esc(p.nim) + '"></label>' :
        '<label class="f"><span>' + (p.kategori === 'CI' ? 'Lahan praktik' : p.kategori === 'Umum' ? 'Instansi' : 'Jabatan / unit kerja') + '</span><input type="text" id="u-inst" value="' + esc(p.instansi) + '"></label>' +
        '<label class="f"><span>NIP / NIK</span><input type="text" id="u-nip" value="' + esc(p.nipNik) + '"></label>') +
      '<label class="f"><span>Email</span><input type="email" id="u-email" value="' + esc(p.email) + '"></label>' +
      (k.modeSertifikat !== 'tanpa' ? '<p class="kecil">Di sertifikat: <b id="u-prev">' + esc(H.namaSertifikat(p.nama)) + '</b></p>' : '');
    var setelBuka = setTimeout(function () {
      var n = document.getElementById('u-nama'), pv = document.getElementById('u-prev');
      if (n && pv) n.oninput = function () { pv.textContent = H.namaSertifikat(n.value); };
    }, 50);
    var data = await H.dialog('Ubah data peserta', html, [
      { label: 'Batal', kelas: 'garis', nilai: null },
      {
        label: 'Simpan', nilai: function (l) {
          return {
            id: p.id, nama: l.querySelector('#u-nama').value, email: l.querySelector('#u-email').value,
            nim: mhs ? l.querySelector('#u-nim').value : p.nim,
            instansi: mhs ? p.instansi : l.querySelector('#u-inst').value, nipNik: mhs ? p.nipNik : l.querySelector('#u-nip').value
          };
        }
      }]);
    clearTimeout(setelBuka);
    if (!data) return;
    var r = await H.api('ubahPeserta', { data: data });
    if (!r.ok) return H.toast(r.pesan, true);
    H.toast('Data peserta diperbarui.'); selesai();
  }

  async function hapusPeserta(p, selesai) {
    if (!await H.konfirmasi('Hapus peserta?', 'Data kehadiran <b>' + esc(p.nama) + '</b> beserta tanda tangannya akan dihapus.', 'Hapus', true)) return;
    var r = await H.api('hapusPeserta', { id: p.id });
    if (!r.ok) return H.toast(r.pesan, true);
    H.toast('Peserta dihapus.'); selesai();
  }

  async function ambilTemplat(k, paksa) {
    if (TEMPLAT[k.id] && !paksa) return TEMPLAT[k.id];
    var d = await H.api('ambilTemplat', { k: k.id });
    if (!d.ok) throw new Error(d.pesan);
    TEMPLAT[k.id] = { bytes: H.base64KeBytes(d.pdf), halaman: d.halaman, total: d.total, posisi: d.posisi };
    return TEMPLAT[k.id];
  }

  async function unduhSatu(k, p, btn) {
    var asli = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="putar kcl"></span>';
    try {
      var t = await ambilTemplat(k);
      var bytes = await H.buatSertifikat(t.bytes, t.halaman, t.posisi, p.nama);
      H.unduhBytes(bytes, 'Sertifikat - ' + H.namaFile(p.nama) + '.pdf');
    } catch (e) { H.toast(e.message, true); }
    finally { btn.disabled = false; btn.innerHTML = asli; }
  }

  /* ---------- Tab: Sertifikat ---------- */
  async function tabSertifikat(k) {
    var wadah = $('isi-tab');
    if (k.modeSertifikat === 'tanpa') {
      wadah.innerHTML = '<div class="kartu kosong"><span class="em">📄</span><p>Kegiatan ini diatur <b>tanpa sertifikat</b>.</p>' +
        '<a class="tbl garis" href="#/edit/' + esc(k.id) + '">Ubah pengaturan sertifikat</a></div>';
      return;
    }
    var P = Object.assign({}, H.POSISI_BAWAAN, k.posisi || {});
    var halaman = k.templatHalaman || 1, total = k.templatTotal || 0;
    var contoh = 'Nama Peserta Contoh, S.Gz';

    wadah.innerHTML =
      '<div class="kartu"><h3>1. Templat sertifikat dari SRIKANDI</h3>' +
      (k.adaTemplat ? '<p class="sub">📎 ' + esc(k.templatNama || 'templat.pdf') + ' · ' + total + ' halaman</p>' :
        '<p class="sub">Buat sertifikat di SRIKANDI dengan nama siapa saja (atau ketik "NAMA PESERTA"), lalu unggah PDF hasil tanda tangannya di sini.</p>') +
      '<label class="unggah" for="file-pdf">' + (k.adaTemplat ? '🔄 Ganti PDF templat' : '⬆️ Pilih PDF sertifikat dari SRIKANDI') +
      '<br><span class="kecil">Hanya satu halaman yang dipakai; peserta menerima 1 lembar sertifikat.</span></label>' +
      '<input type="file" id="file-pdf" accept="application/pdf" hidden></div>' +
      '<div id="atur"></div><div id="terbit"></div>';

    $('file-pdf').onchange = async function () {
      var f = this.files[0]; if (!f) return;
      if (f.size > 10 * 1024 * 1024) return H.toast('File terlalu besar (maks. 10 MB).', true);
      var lbl = document.querySelector('label.unggah'); lbl.innerHTML = '<span class="putar kcl"></span> Mengunggah…';
      try {
        var bytes = new Uint8Array(await f.arrayBuffer());
        var doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        var r = await H.api('uploadTemplat', { k: k.id, nama: f.name, pdf: H.bytesKeBase64(bytes), total: doc.getPageCount(), halaman: 1, posisi: k.posisi || H.POSISI_BAWAAN });
        if (!r.ok) { H.toast(r.pesan, true); tabSertifikat(k); return; }
        TEMPLAT[k.id] = { bytes: bytes, halaman: 1, total: doc.getPageCount(), posisi: k.posisi || H.POSISI_BAWAAN };
        await segarkan(); H.toast('Templat tersimpan. Periksa posisi nama di pratinjau.');
        tabSertifikat(cariKeg(k.id));
      } catch (e) { H.toast('PDF tidak dapat dibaca: ' + e.message, true); tabSertifikat(k); }
    };

    if (!k.adaTemplat) return;
    $('atur').innerHTML = '<div class="muat"><span class="putar"></span> Memuat pratinjau…</div>';
    var t;
    try { t = await ambilTemplat(k); } catch (e) { $('atur').innerHTML = '<div class="pesan galat">' + esc(e.message) + '</div>'; return; }
    try { var dp = PESERTA[k.id] || await muatPeserta(k); if (dp.peserta.length) contoh = dp.peserta[0].nama; } catch (e) { }

    $('atur').innerHTML =
      '<div class="kartu"><h3>2. Posisi nama peserta</h3>' +
      '<p class="sub"><b>Klik/ketuk pada pratinjau</b> di tempat nama mulai ditulis. Kotak merah putus-putus = area nama contoh yang ditutup (tidak ikut tercetak).</p>' +
      (t.total > 1 ? '<label class="f"><span>Halaman yang dipakai untuk peserta</span><select id="p-hal">' +
        Array.from({ length: t.total }, function (_, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === halaman ? ' selected' : '') + '>Halaman ' + (i + 1) + '</option>'; }).join('') + '</select></label>' : '') +
      '<div class="pratinjau" id="prv"><canvas id="kanvas"></canvas></div>' +
      '<div class="atur-posisi mt">' +
      '<label class="f"><span>Nama contoh</span><input type="text" id="p-contoh" value="' + esc(contoh) + '"></label>' +
      '<label class="f"><span>Ukuran huruf</span><input type="number" id="p-uk" min="8" max="40" step="0.5" value="' + P.ukuran + '"></label>' +
      '<label class="f"><span>Warna</span><input type="color" id="p-warna" value="' + P.warna + '" style="height:42px;padding:4px"></label>' +
      '<label class="f"><span>Rata</span><select id="p-rata"><option value="kiri">Kiri</option><option value="tengah">Tengah</option></select></label>' +
      '<label class="f"><span>Lebar area (pt)</span><input type="number" id="p-lebar" min="100" max="800" step="10" value="' + P.lebar + '"></label>' +
      '<label class="f"><span>Huruf</span><select id="p-huruf"><option value="HelveticaBold">Arial/Helvetica Tebal</option><option value="Helvetica">Arial/Helvetica</option><option value="TimesRomanBold">Times Tebal</option></select></label>' +
      '</div>' +
      '<div class="baris antara"><div class="pilihan"><label><input type="checkbox" id="p-tutup"' + (P.tutup ? ' checked' : '') + '> Tutup nama contoh di PDF</label></div>' +
      '<div class="baris"><span class="kecil">Geser halus:</span>' +
      ['←', '→', '↑', '↓'].map(function (a) { return '<button class="tbl garis ikon kecil" data-g="' + a + '">' + a + '</button>'; }).join('') + '</div></div>' +
      '<div class="baris mt"><button class="tbl" id="p-simpan">💾 Simpan posisi</button><button class="tbl garis" id="p-reset">Kembalikan bawaan</button>' +
      '<button class="tbl lembut" id="p-uji">⬇️ Unduh contoh PDF</button></div></div>';
    $('p-rata').value = P.rata; $('p-huruf').value = P.huruf;

    var renderJalan = null, ukuranHal = { w: 842, h: 595 };
    async function render() {
      var nonce = renderJalan = {};
      try {
        var hal = $('p-hal') ? Number($('p-hal').value) : 1;
        var bytes = await H.buatSertifikat(t.bytes, hal, P, $('p-contoh').value || contoh, { garisBantu: true });
        if (nonce !== renderJalan) return;
        var doc = await pdfjsLib.getDocument({ data: bytes }).promise;
        var pg = await doc.getPage(1);
        var v1 = pg.getViewport({ scale: 1 }); ukuranHal = { w: v1.width, h: v1.height };
        var cv = $('kanvas'); if (!cv) return;
        var skala = Math.min(2.2, (cv.parentElement.clientWidth * (window.devicePixelRatio || 1)) / v1.width);
        var vp = pg.getViewport({ scale: skala });
        var tmp = document.createElement('canvas'); tmp.width = vp.width; tmp.height = vp.height;
        await pg.render({ canvasContext: tmp.getContext('2d'), viewport: vp }).promise;
        if (nonce !== renderJalan) return;
        cv.width = vp.width; cv.height = vp.height; cv.getContext('2d').drawImage(tmp, 0, 0);
      } catch (e) { H.toast('Pratinjau gagal: ' + e.message, true); }
    }
    var tunda = null;
    function ubah() { clearTimeout(tunda); tunda = setTimeout(render, 250); }
    function baca() {
      P.ukuran = Number($('p-uk').value) || 14; P.warna = $('p-warna').value; P.rata = $('p-rata').value;
      P.lebar = Number($('p-lebar').value) || 500; P.huruf = $('p-huruf').value; P.tutup = $('p-tutup').checked;
    }
    ['p-uk', 'p-warna', 'p-rata', 'p-lebar', 'p-huruf', 'p-tutup', 'p-contoh'].forEach(function (id) { $(id).addEventListener('input', function () { baca(); ubah(); }); $(id).addEventListener('change', function () { baca(); ubah(); }); });
    if ($('p-hal')) $('p-hal').onchange = render;
    $('kanvas').addEventListener('click', function (e) {
      var r = this.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width * ukuranHal.w, py = (e.clientY - r.top) / r.height * ukuranHal.h;
      P.x = Math.round(px * 10) / 10;
      P.y = Math.round((py + P.ukuran * 0.35) * 10) / 10;   // klik = tengah tinggi huruf
      render();
    });
    document.querySelectorAll('[data-g]').forEach(function (b) {
      b.onclick = function () { var g = b.dataset.g; if (g === '←') P.x -= 2; if (g === '→') P.x += 2; if (g === '↑') P.y -= 2; if (g === '↓') P.y += 2; render(); };
    });
    $('p-reset').onclick = function () {
      P = Object.assign({}, H.POSISI_BAWAAN);
      $('p-uk').value = P.ukuran; $('p-warna').value = P.warna; $('p-rata').value = P.rata; $('p-lebar').value = P.lebar; $('p-huruf').value = P.huruf; $('p-tutup').checked = P.tutup;
      render();
    };
    $('p-uji').onclick = async function () {
      var hal = $('p-hal') ? Number($('p-hal').value) : 1;
      H.unduhBytes(await H.buatSertifikat(t.bytes, hal, P, $('p-contoh').value || contoh), 'Contoh Sertifikat - ' + H.namaFile(k.nama) + '.pdf');
    };
    $('p-simpan').onclick = async function () {
      var b = this; b.disabled = true;
      try {
        var hal = $('p-hal') ? Number($('p-hal').value) : 1;
        var r = await H.api('simpanPosisi', { k: k.id, halaman: hal, posisi: P });
        if (!r.ok) return H.toast(r.pesan, true);
        t.posisi = Object.assign({}, P); t.halaman = hal;
        await segarkan(); H.toast('Posisi nama tersimpan.');
      } catch (e) { H.toast(e.message, true); } finally { b.disabled = false; }
    };
    render();
    gambarTerbit(k);
  }

  async function gambarTerbit(k) {
    var w = $('terbit'); if (!w) return;
    var d = PESERTA[k.id] || await muatPeserta(k).catch(function () { return null; });
    var list = d ? d.peserta : [];
    var adaEmail = list.filter(function (p) { return p.email; }).length;
    var terkirim = list.filter(function (p) { return p.emailStatus === 'Terkirim'; }).length;
    var gagal = list.filter(function (p) { return /^Gagal/.test(p.emailStatus); }).length;
    var belum = list.filter(function (p) { return p.email && p.emailStatus !== 'Terkirim'; }).length;
    var langsung = k.modeSertifikat === 'langsung';
    w.innerHTML = '<div class="kartu"><h3>3. ' + (langsung ? 'Pengiriman sertifikat' : 'Terbitkan & kirim sertifikat') + '</h3>' +
      '<div class="statistik"><div class="stat"><b>' + list.length + '</b><span>Peserta</span></div><div class="stat"><b>' + adaEmail + '</b><span>Punya email</span></div>' +
      '<div class="stat"><b>' + terkirim + '</b><span>Email terkirim</span></div><div class="stat"><b>' + gagal + '</b><span>Gagal</span></div>' +
      '<div class="stat"><b>' + DATA.kuotaEmail + '</b><span>Sisa kuota email</span></div></div>' +
      (langsung ? '<p class="sub">Mode <b>langsung</b>: peserta mengunduh sertifikat begitu selesai absen, dan link-nya otomatis dikirim ke email (bila diisi).</p>' :
        '<p class="sub">Mode <b>setelah kegiatan</b>: sertifikat belum bisa diunduh sampai Anda menerbitkannya. ' +
        (k.sertifikatDibuka ? '<span class="lbl buka" style="animation:none">Sudah diterbitkan</span>' : '<span class="lbl belum">Belum diterbitkan</span>') + '</p>') +
      '<div class="baris">' +
      '<button class="tbl" id="kirim"' + (belum ? '' : ' disabled') + '>📧 ' + (langsung ? 'Kirim ke yang belum terkirim' : 'Terbitkan & kirim ke email') + ' (' + belum + ')</button>' +
      (!langsung ? '<button class="tbl garis" id="buka-unduh">' + (k.sertifikatDibuka ? '🔒 Tutup akses unduh' : '🔓 Terbitkan tanpa email') + '</button>' : '') +
      '</div><p class="kecil">Mahasiswa juga dapat mengunduh sertifikat di menu Daftar Hadir Kegiatan pada Gizi-Link setelah diterbitkan.</p></div>';
    if ($('kirim')) $('kirim').onclick = async function () {
      if (!await H.konfirmasi('Kirim sertifikat?', 'Link sertifikat akan dikirim ke <b>' + belum + '</b> email peserta' + (langsung ? '' : ' dan sertifikat diterbitkan') + '.', 'Kirim')) return;
      var b = this; b.disabled = true; b.innerHTML = '<span class="putar kcl"></span> Mengirim… (jangan tutup halaman)';
      try {
        var r = await H.api('kirimSertifikat', { k: k.id });
        if (!r.ok) { H.toast(r.pesan, true); return; }
        await H.dialog('Pengiriman selesai', '<p>Terkirim: <b>' + r.terkirim + '</b> · Gagal: <b>' + r.gagal + '</b>' +
          (r.sisa ? '<br>Belum terkirim: <b>' + r.sisa + '</b> — tekan tombol kirim lagi untuk melanjutkan' + (r.kuota < 1 ? ' besok (kuota email hari ini habis)' : '') + '.' : '') + '</p>');
        await segarkan(); await muatPeserta(k); gambarTerbit(cariKeg(k.id));
      } catch (e) { H.toast(e.message, true); }
      finally { if (b.isConnected) b.disabled = false; }
    };
    if ($('buka-unduh')) $('buka-unduh').onclick = async function () {
      var r = await H.api('bukaSertifikat', { k: k.id, buka: !k.sertifikatDibuka });
      if (!r.ok) return H.toast(r.pesan, true);
      await segarkan(); H.toast(r.dibuka ? 'Sertifikat diterbitkan.' : 'Akses unduh ditutup.'); gambarTerbit(cariKeg(k.id));
    };
  }

  /* ---------- Tab: Rekap ---------- */
  function tabRekap(k) {
    var serti = k.modeSertifikat !== 'tanpa' && k.adaTemplat;
    $('isi-tab').innerHTML =
      '<div class="kartu" style="border-top:4px solid var(--lime)"><h3>📑 Laporan Kegiatan</h3><p class="sub">Sampul, lembar pengesahan (tanda tangan & stempel), BAB I–IV dari notulensi & evaluasi, ' +
      'lampiran daftar hadir, dokumentasi foto, materi, dan contoh sertifikat. Huruf Cambria 12 pt.</p>' +
      '<div class="baris"><button class="tbl" id="lap-word">⬇️ Unduh Word (.docx)</button><a class="tbl garis" target="_blank" href="laporan.html?k=' + encodeURIComponent(k.id) + '">🖨️ Versi Cetak / PDF</a>' +
      '<span class="kecil" id="lap-status"></span></div></div>' +
      '<div class="grid2">' +
      '<div class="kartu"><h3>🖨️ Daftar hadir resmi</h3><p class="sub">Kop Jurusan Gizi, tabel peserta dengan tanda tangan, dan pengesahan Ketua Jurusan. Simpan sebagai PDF lewat menu cetak.</p>' +
      '<a class="tbl penuh" target="_blank" href="rekap.html?k=' + encodeURIComponent(k.id) + '">Buka & Cetak Daftar Hadir</a></div>' +
      '<div class="kartu"><h3>📊 Excel</h3><p class="sub">Semua data peserta (tanpa gambar tanda tangan) untuk diolah lebih lanjut.</p>' +
      '<button class="tbl garis penuh" id="excel">Unduh Excel</button></div>' +
      (serti ? '<div class="kartu"><h3>📄 Semua sertifikat</h3><p class="sub">Satu file PDF berisi sertifikat seluruh peserta (1 halaman per orang), siap dicetak.</p>' +
        '<button class="tbl garis penuh" id="semua">Unduh Semua Sertifikat (PDF)</button></div>' : '') +
      '</div>';
    $('lap-word').onclick = async function () {
      var b = this; b.disabled = true;
      try {
        if (!window.docx) { $('lap-status').textContent = 'Memuat modul Word…'; await muatSkrip('vendor/docx.iife.js'); }
        var bahan = await Laporan.siapkan(k.id, function (t) { $('lap-status').textContent = t; });
        $('lap-status').textContent = 'Menyusun dokumen Word…';
        var blob = await Laporan.keDocx(Laporan.model(bahan), 'Laporan ' + k.nama);
        H.unduhBytes(blob, 'Laporan Kegiatan - ' + H.namaFile(k.nama) + '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        $('lap-status').textContent = '✔ Laporan terunduh.';
      } catch (e) { $('lap-status').textContent = ''; H.toast(e.message, true); }
      finally { b.disabled = false; }
    };
    $('excel').onclick = async function () {
      var b = this; b.disabled = true;
      try {
        var d = await muatPeserta(k);
        var rows = d.peserta.map(function (p, i) {
          return {
            No: i + 1, 'Waktu Hadir': p.waktu, Kategori: p.kategori, NIM: p.nim, Nama: p.nama, 'Nama di Sertifikat': H.namaSertifikat(p.nama),
            'Prodi': p.kategori === 'Mahasiswa' ? p.prodi : '', Kelas: p.kelas, 'Instansi / Lahan Praktik': p.instansi, 'NIP/NIK': p.nipNik,
            Email: p.email, 'Cara Isi': p.sumber, 'Status Email Sertifikat': p.emailStatus
          };
        });
        var ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 11 }, { wch: 17 }, { wch: 34 }, { wch: 34 }, { wch: 22 }, { wch: 9 }, { wch: 30 }, { wch: 20 }, { wch: 28 }, { wch: 10 }, { wch: 18 }];
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Daftar Hadir');
        XLSX.writeFile(wb, 'Daftar Hadir - ' + H.namaFile(k.nama) + '.xlsx');
      } catch (e) { H.toast(e.message, true); } finally { b.disabled = false; }
    };
    if ($('semua')) $('semua').onclick = async function () {
      var b = this; b.disabled = true;
      try {
        var d = await muatPeserta(k);
        if (!d.peserta.length) return H.toast('Belum ada peserta.', true);
        var t = await ambilTemplat(k);
        var bytes = await H.buatSertifikat(t.bytes, t.halaman, t.posisi, d.peserta.map(function (p) { return p.nama; }), {
          kemajuan: function (i, n) { b.textContent = 'Menyusun ' + i + '/' + n + '…'; }
        });
        H.unduhBytes(bytes, 'Sertifikat Semua Peserta - ' + H.namaFile(k.nama) + '.pdf');
      } catch (e) { H.toast(e.message, true); } finally { b.disabled = false; b.textContent = 'Unduh Semua Sertifikat (PDF)'; }
    };
  }

  /* ---------- Pengaturan (super admin) ---------- */
  function pengaturan() {
    var p = DATA.pengaturan || {};
    var adm = (DATA.admin || []).map(function (a) {
      return '<tr><td>' + esc(a.nama) + '</td><td class="kecil">' + esc(a.id) + '</td><td>' + (a.peran === 'superadmin' ? '<span class="lbl lime">Super Admin</span>' : '<span class="lbl info">Admin</span>') + '</td></tr>';
    }).join('');
    isi.innerHTML =
      '<div class="baris" style="margin-bottom:12px"><a class="tbl garis kecil" href="#/">← Kembali</a></div>' +
      '<form class="kartu" id="fp"><h2>Pengaturan</h2><p class="sub">Dipakai pada pengesahan rekap daftar hadir.</p>' +
      '<div class="grid2">' +
      '<label class="f"><span>Jabatan penanda tangan</span><input type="text" id="s-jab" value="' + esc(p.pengesahan_jabatan || '') + '"></label>' +
      '<label class="f"><span>Nama penanda tangan</span><input type="text" id="s-nama" value="' + esc(p.pengesahan_nama || '') + '"></label>' +
      '<label class="f"><span>NIP</span><input type="text" id="s-nip" value="' + esc(p.pengesahan_nip || '') + '"></label>' +
      '<label class="f"><span>Kota (tanggal pengesahan)</span><input type="text" id="s-kota" value="' + esc(p.kota || '') + '"></label>' +
      '<label class="f"><span>Nama unit pada kop</span><input type="text" id="s-unit" value="' + esc(p.unit || '') + '"></label>' +
      '</div><button class="tbl" type="submit">Simpan Pengaturan</button></form>' +
      '<div class="kartu"><h3>✍️ Tanda tangan & stempel pengesah</h3><p class="sub">Otomatis tampil di halaman terakhir daftar hadir dan lembar pengesahan laporan. Unggah foto/scan di kertas putih — latar putih dibuang otomatis.</p>' +
      '<div class="grid2">' + ['ttd', 'stempel'].map(function (j) {
        var g = (DATA.gambar || {})[j];
        return '<div class="blok-not"><h4>' + (j === 'ttd' ? 'Tanda tangan' : 'Stempel / cap') + '</h4>' +
          '<div style="height:120px;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#F1F5F9 0 25%,#fff 0 50%) 0 0/16px 16px;border-radius:8px;margin-bottom:8px">' +
          (g ? '<img src="' + g + '" style="max-height:110px;max-width:100%">' : '<span class="kecil">Belum diunggah</span>') + '</div>' +
          '<div class="baris"><label class="tbl lembut kecil">⬆️ Unggah<input type="file" accept="image/*" hidden data-gambar="' + j + '"></label>' +
          (g ? '<button class="tbl bahaya kecil" data-hapus-gambar="' + j + '">Hapus</button>' : '') + '</div></div>';
      }).join('') + '</div></div>' +
      '<div class="kartu"><h3>Admin Daftar Hadir</h3><p class="sub">Diatur dari kolom <b>Daftar Hadir</b> di sheet <b>Staf</b> portal Gizi-Link (isi <code>superadmin</code> atau <code>admin</code>). Perubahan berlaku ±5 menit.</p>' +
      (adm ? '<div class="tabel-wrap"><table class="tabel"><thead><tr><th>Nama</th><th>NIP</th><th>Peran</th></tr></thead><tbody>' + adm + '</tbody></table></div>' : '<p class="kecil">Belum ada.</p>') + '</div>';
    $('fp').onsubmit = async function (e) {
      e.preventDefault();
      var r = await H.api('simpanPengaturan', { data: { pengesahan_jabatan: $('s-jab').value, pengesahan_nama: $('s-nama').value, pengesahan_nip: $('s-nip').value, kota: $('s-kota').value, unit: $('s-unit').value } });
      if (!r.ok) return H.toast(r.pesan, true);
      DATA.pengaturan = r.pengaturan; H.toast('Pengaturan tersimpan.');
    };
    document.querySelectorAll('[data-gambar]').forEach(function (inp) {
      inp.onchange = async function () {
        var f = this.files[0]; if (!f) return;
        try {
          H.toast('Memproses gambar…');
          var data = await gambarTransparan(f);
          var r = await H.api('gambarPengesahan', { jenis: inp.dataset.gambar, data: data });
          if (!r.ok) return H.toast(r.pesan, true);
          DATA.gambar = r.gambar; H.toast('Gambar tersimpan.'); pengaturan();
        } catch (e) { H.toast(e.message, true); }
      };
    });
    document.querySelectorAll('[data-hapus-gambar]').forEach(function (b) {
      b.onclick = async function () {
        if (!await H.konfirmasi('Hapus gambar?', 'Gambar ini tidak akan tampil lagi di daftar hadir dan laporan.', 'Hapus', true)) return;
        var r = await H.api('gambarPengesahan', { jenis: b.dataset.hapusGambar, data: '' });
        if (!r.ok) return H.toast(r.pesan, true);
        DATA.gambar = r.gambar; pengaturan();
      };
    });
  }

  /** Buang latar putih/abu terang, pangkas tepi kosong, lebar maks. 900 px → data URL PNG. */
  function gambarTransparan(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var s = Math.min(1, 900 / Math.max(im.width, im.height));
        var c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        var x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height);
        var d = x.getImageData(0, 0, c.width, c.height), p = d.data;
        var minX = c.width, minY = c.height, maxX = 0, maxY = 0;
        for (var i = 0; i < p.length; i += 4) {
          var terang = (p[i] + p[i + 1] + p[i + 2]) / 3, jenuh = Math.max(p[i], p[i + 1], p[i + 2]) - Math.min(p[i], p[i + 1], p[i + 2]);
          if (terang > 215 && jenuh < 40) p[i + 3] = 0;
          else if (terang > 175 && jenuh < 40) p[i + 3] = Math.round(p[i + 3] * (215 - terang) / 40);
          if (p[i + 3] > 20) { var px = (i / 4) % c.width, py = Math.floor(i / 4 / c.width); if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py; }
        }
        x.putImageData(d, 0, 0);
        URL.revokeObjectURL(url);
        if (maxX <= minX) return rej(new Error('Gambar tampak kosong. Pastikan tanda tangan/stempel terlihat jelas.'));
        var pad = 6, w2 = maxX - minX + pad * 2, h2 = maxY - minY + pad * 2;
        var o = document.createElement('canvas'); o.width = w2; o.height = h2;
        o.getContext('2d').drawImage(c, minX - pad, minY - pad, w2, h2, 0, 0, w2, h2);
        res(o.toDataURL('image/png'));
      };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('File bukan gambar.')); };
      im.src = url;
    });
  }

  function muatSkrip(src) {
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Gagal memuat ' + src)); }; document.head.appendChild(s); });
  }

  /* =================== NOTULENSI =================== */
  var LAP = {};
  async function muatLaporan(k, denganNama) {
    var d = await H.api('ambilLaporan', { k: k.id, denganNama: !!denganNama });
    if (!d.ok) throw new Error(d.pesan);
    LAP[k.id] = d;
    return d;
  }

  async function tabNotulensi(k) {
    var wadah = $('isi-tab');
    wadah.innerHTML = '<div class="muat"><span class="putar"></span> Memuat notulensi…</div>';
    var d;
    try { d = await muatLaporan(k, true); } catch (e) { wadah.innerHTML = '<div class="pesan galat">' + esc(e.message) + '</div>'; return; }
    var L = JSON.parse(JSON.stringify(d.laporan || {}));
    var draf = null;
    try { draf = JSON.parse(localStorage.getItem('notulen_' + k.id) || 'null'); } catch (e) { }
    if (draf && draf.t > Date.parse(String(d.diubahPada || '').replace(' ', 'T') + ':00+08:00') + 1000) { L = draf.data; setTimeout(function () { H.toast('Draf notulen yang belum tersimpan dipulihkan.'); }, 300); }
    var baku = Laporan.teksBaku(k);
    var nara = d.narasumber.length ? d.narasumber : [];
    L.materi = L.materi || [];
    nara.forEach(function (n) { if (!L.materi.some(function (m) { return m.narasumber === n; })) L.materi.push({ narasumber: n, judul: '', poin: '' }); });
    if (!L.materi.length) L.materi.push({ narasumber: '', judul: '', poin: '' });
    L.diskusi = L.diskusi || [];
    L.rtl = L.rtl || [];

    var namaPeserta = d.peserta.map(function (p) { return p.nama; });
    var semuaNama = Array.from(new Set(namaPeserta.concat(d.namaStaf || [], d.namaMhs || [])));
    var namaJawab = Array.from(new Set(nara.concat(d.namaStaf || [])));

    wadah.innerHTML =
      '<datalist id="dl-penanya">' + semuaNama.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' +
      '<datalist id="dl-penjawab">' + namaJawab.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' +
      '<div class="pesan info">💡 Tulis <b>satu poin per baris</b> — tidak perlu nomor, titik, atau huruf kapital; aplikasi merapikan otomatis. Notulen tersimpan otomatis.</div>' +
      '<div class="kartu"><h3>1. Pendahuluan <span class="kecil" style="font-weight:400">— sudah terisi teks baku, ubah bila perlu</span></h3>' +
      '<label class="f"><span>Dasar kegiatan (nomor surat/SK/undangan, satu per baris)</span><textarea id="n-dasar" rows="2" spellcheck="true" lang="id" placeholder="' + esc(baku.dasar) + '">' + esc(L.dasar || '') + '</textarea></label>' +
      '<label class="f"><span>Latar belakang</span><textarea id="n-latar" rows="5" spellcheck="true" lang="id">' + esc(L.latarBelakang || baku.latarBelakang) + '</textarea></label>' +
      '<label class="f"><span>Tujuan (satu per baris)</span><textarea id="n-tujuan" rows="3" spellcheck="true" lang="id">' + esc(L.tujuan || baku.tujuan) + '</textarea></label></div>' +
      '<div class="kartu"><h3>2. Pokok materi per narasumber</h3><div id="n-materi"></div>' +
      (nara.length ? '' : '<button type="button" class="tbl lembut kecil" id="n-tambah-materi">＋ Tambah narasumber/materi</button>') + '</div>' +
      '<div class="kartu"><div class="baris antara"><h3 style="margin:0">3. Diskusi / tanya jawab</h3><button type="button" class="tbl garis kecil" id="n-cocok">🔎 Cocokkan nama dengan daftar hadir</button></div>' +
      '<p class="sub kecil">Penanya: ketik beberapa huruf lalu pilih saran (dosen, mahasiswa, peserta yang sudah absen), atau ketik bebas.</p>' +
      '<div id="n-diskusi"></div><button type="button" class="tbl lembut kecil" id="n-tambah-tanya">＋ Tambah pertanyaan</button></div>' +
      '<div class="kartu"><h3>4. Penutup</h3>' +
      '<label class="f"><span>Kesimpulan (satu per baris) <button type="button" class="tbl garis kecil" id="n-draf-kes" style="margin-left:6px">✨ Buat draf otomatis</button></span><textarea id="n-kesimpulan" rows="4" spellcheck="true" lang="id">' + esc(L.kesimpulan || '') + '</textarea></label>' +
      '<label class="f"><span>Kendala (kosongkan bila tidak ada)</span><textarea id="n-kendala" rows="2" spellcheck="true" lang="id" placeholder="Kegiatan berjalan lancar tanpa kendala yang berarti.">' + esc(L.kendala || '') + '</textarea></label>' +
      '<label class="f"><span>Rekomendasi <button type="button" class="tbl garis kecil" id="n-draf-rek" style="margin-left:6px">✨ Isi dari hasil evaluasi</button></span><textarea id="n-rekomendasi" rows="3" spellcheck="true" lang="id">' + esc(L.rekomendasi || '') + '</textarea></label>' +
      '<label class="f"><span>Rencana tindak lanjut (opsional)</span></label><div id="n-rtl"></div><button type="button" class="tbl lembut kecil" id="n-tambah-rtl">＋ Tambah RTL</button></div>' +
      '<div class="bar-simpan"><span class="simpan-status" id="n-status">' + (d.diubahPada ? 'Tersimpan ' + esc(d.diubahPada) + (d.diubahOleh ? ' oleh ' + esc(d.diubahOleh) : '') : 'Belum disimpan') + '</span>' +
      '<div class="baris"><button type="button" class="tbl garis" id="n-pratinjau">👁️ Pratinjau</button><button type="button" class="tbl" id="n-simpan">💾 Simpan</button></div></div>';

    function gambarMateri() {
      $('n-materi').innerHTML = L.materi.map(function (m, i) {
        return '<div class="blok-not" data-i="' + i + '"><h4><span class="no">' + (i + 1) + '</span>' +
          (nara.length ? esc(m.narasumber) : '<input type="text" data-f="narasumber" placeholder="Nama narasumber" value="' + esc(m.narasumber) + '" style="flex:1">') +
          (!nara.length && L.materi.length > 1 ? '<button type="button" class="tbl bahaya ikon kecil" data-hapus-materi="' + i + '">✕</button>' : '') + '</h4>' +
          '<label class="f"><span>Judul materi</span><input type="text" data-f="judul" value="' + esc(m.judul) + '" spellcheck="true" lang="id"></label>' +
          '<label class="f" style="margin:0"><span>Pokok materi (satu poin per baris)</span><textarea data-f="poin" rows="4" spellcheck="true" lang="id" placeholder="contoh:\nNCP terdiri dari 4 langkah\nasesmen gizi atlet berbeda dengan non-atlet">' + esc(m.poin) + '</textarea></label></div>';
      }).join('');
    }
    function gambarDiskusi() {
      $('n-diskusi').innerHTML = L.diskusi.length ? L.diskusi.map(function (q, i) {
        return '<div class="kartu-tanya" data-i="' + i + '"><div class="kepala">Pertanyaan ' + (i + 1) + '<span>' +
          (i > 0 ? '<button type="button" class="tbl garis ikon kecil" data-naik="' + i + '" title="Naikkan">↑</button> ' : '') +
          '<button type="button" class="tbl bahaya ikon kecil" data-hapus-tanya="' + i + '" title="Hapus">✕</button></span></div>' +
          '<div class="grid2"><label class="f"><span>Penanya</span><input type="text" data-f="penanya" list="dl-penanya" value="' + esc(q.penanya) + '" placeholder="ketik nama…"></label>' +
          '<label class="f"><span>Dijawab oleh</span><input type="text" data-f="penjawab" list="dl-penjawab" value="' + esc(q.penjawab) + '" placeholder="pilih narasumber…"></label></div>' +
          '<label class="f"><span>Pertanyaan</span><textarea data-f="pertanyaan" rows="2" spellcheck="true" lang="id">' + esc(q.pertanyaan) + '</textarea></label>' +
          '<label class="f" style="margin:0"><span>Jawaban (satu poin per baris)</span><textarea data-f="jawaban" rows="3" spellcheck="true" lang="id">' + esc(q.jawaban) + '</textarea></label></div>';
      }).join('') : '<div class="kosong kecil">Belum ada pertanyaan. Tekan <b>＋ Tambah pertanyaan</b> setiap ada penanya.</div>';
    }
    function gambarRtl() {
      $('n-rtl').innerHTML = L.rtl.map(function (r, i) {
        return '<div class="rtl-baris" data-i="' + i + '"><input type="text" data-f="uraian" placeholder="Uraian tindak lanjut" value="' + esc(r.uraian) + '">' +
          '<input type="text" data-f="pj" placeholder="Penanggung jawab" list="dl-penjawab" value="' + esc(r.pj) + '"><input type="date" data-f="tenggat" value="' + esc(r.tenggat) + '">' +
          '<button type="button" class="tbl bahaya ikon kecil" data-hapus-rtl="' + i + '">✕</button></div>';
      }).join('');
    }
    function kumpulkan() {
      L.dasar = $('n-dasar').value; L.latarBelakang = $('n-latar').value; L.tujuan = $('n-tujuan').value;
      L.kesimpulan = $('n-kesimpulan').value; L.kendala = $('n-kendala').value; L.rekomendasi = $('n-rekomendasi').value;
      document.querySelectorAll('#n-materi [data-i]').forEach(function (el) { var m = L.materi[el.dataset.i]; el.querySelectorAll('[data-f]').forEach(function (f) { m[f.dataset.f] = f.value; }); });
      document.querySelectorAll('#n-diskusi [data-i]').forEach(function (el) { var q = L.diskusi[el.dataset.i]; el.querySelectorAll('[data-f]').forEach(function (f) { q[f.dataset.f] = f.value; }); });
      document.querySelectorAll('#n-rtl [data-i]').forEach(function (el) { var r = L.rtl[el.dataset.i]; el.querySelectorAll('[data-f]').forEach(function (f) { r[f.dataset.f] = f.value; }); });
      return L;
    }
    gambarMateri(); gambarDiskusi(); gambarRtl();

    var kotor = false, tunda = null;
    function berubah() {
      kotor = true; $('n-status').textContent = 'Ada perubahan…';
      try { localStorage.setItem('notulen_' + k.id, JSON.stringify({ t: Date.now(), data: kumpulkan() })); } catch (e) { }
      clearTimeout(tunda); tunda = setTimeout(simpan, 4000);
    }
    async function simpan(manual) {
      clearTimeout(tunda);
      if (!$('n-status')) return;
      if (!kotor && !manual) return;
      var data = kumpulkan();
      data.foto = (LAP[k.id] && LAP[k.id].laporan && LAP[k.id].laporan.foto) || data.foto;
      $('n-status').textContent = 'Menyimpan…';
      try {
        var r = await H.api('simpanLaporan', { k: k.id, data: data });
        if (!r.ok) { $('n-status').textContent = '⚠️ ' + r.pesan; return; }
        kotor = false; LAP[k.id].laporan = data; LAP[k.id].diubahPada = r.diubahPada;
        try { localStorage.removeItem('notulen_' + k.id); } catch (e) { }
        if ($('n-status')) $('n-status').textContent = '✔ Tersimpan ' + r.diubahPada;
        if (manual) H.toast('Notulensi tersimpan.');
      } catch (e) { if ($('n-status')) $('n-status').textContent = '⚠️ Gagal menyimpan — draf aman di perangkat ini. ' + e.message; }
    }
    wadah.addEventListener('input', berubah);
    wadah.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      kumpulkan();
      if (b.id === 'n-tambah-tanya') { L.diskusi.push({ penanya: '', pertanyaan: '', penjawab: nara.length === 1 ? nara[0] : '', jawaban: '' }); gambarDiskusi(); var c = document.querySelectorAll('#n-diskusi [data-f="penanya"]'); c[c.length - 1].focus(); berubah(); }
      else if (b.dataset.hapusTanya != null) { if (L.diskusi[b.dataset.hapusTanya].pertanyaan && !confirm('Hapus pertanyaan ini?')) return; L.diskusi.splice(Number(b.dataset.hapusTanya), 1); gambarDiskusi(); berubah(); }
      else if (b.dataset.naik != null) { var i = Number(b.dataset.naik); var t = L.diskusi[i]; L.diskusi[i] = L.diskusi[i - 1]; L.diskusi[i - 1] = t; gambarDiskusi(); berubah(); }
      else if (b.id === 'n-tambah-rtl') { L.rtl.push({ uraian: '', pj: '', tenggat: '' }); gambarRtl(); berubah(); }
      else if (b.dataset.hapusRtl != null) { L.rtl.splice(Number(b.dataset.hapusRtl), 1); gambarRtl(); berubah(); }
      else if (b.id === 'n-tambah-materi') { L.materi.push({ narasumber: '', judul: '', poin: '' }); gambarMateri(); berubah(); }
      else if (b.dataset.hapusMateri != null) { L.materi.splice(Number(b.dataset.hapusMateri), 1); gambarMateri(); berubah(); }
      else if (b.id === 'n-draf-kes') {
        var ring = Laporan.ringkasEvaluasi(d.evaluasi, d.aspek, d.narasumber);
        if ($('n-kesimpulan').value.trim() && !confirm('Ganti isi kesimpulan dengan draf otomatis?')) return;
        $('n-kesimpulan').value = Laporan.drafKesimpulan(k, d.peserta.length, ring); berubah();
      } else if (b.id === 'n-draf-rek') {
        var ring2 = Laporan.ringkasEvaluasi(d.evaluasi, d.aspek, d.narasumber);
        if ($('n-rekomendasi').value.trim() && !confirm('Ganti isi rekomendasi dengan draf dari hasil evaluasi?')) return;
        $('n-rekomendasi').value = Laporan.drafRekomendasi(ring2); berubah();
      } else if (b.id === 'n-simpan') { kotor = true; simpan(true); }
      else if (b.id === 'n-pratinjau') { pratinjauNotulen(k, kumpulkan(), nara); }
      else if (b.id === 'n-cocok') { cocokkanNama(namaPeserta); }
    });
    function cocokkanNama(daftar) {
      kumpulkan();
      var usul = [];
      L.diskusi.forEach(function (q, i) {
        var n = String(q.penanya || '').trim();
        if (!n || daftar.indexOf(n) >= 0) return;
        var m = cariMirip(n, daftar);
        if (m) usul.push({ i: i, dari: n, ke: m });
      });
      if (!usul.length) return H.toast('Tidak ada nama penanya yang perlu dicocokkan.');
      H.dialog('Cocokkan nama penanya', '<p class="kecil">Centang nama yang ingin diganti dengan nama resmi dari daftar hadir:</p>' + usul.map(function (u, j) {
        return '<label class="pilihan" style="margin-bottom:6px;display:block"><label style="display:flex;width:100%"><input type="checkbox" checked data-u="' + j + '"> ' + esc(u.dari) + ' → <b>' + esc(u.ke) + '</b></label></label>';
      }).join(''), [{ label: 'Batal', kelas: 'garis', nilai: null }, { label: 'Ganti', nilai: function (l) { return [].map.call(l.querySelectorAll('[data-u]:checked'), function (x) { return usul[x.dataset.u]; }); } }])
        .then(function (pilih) {
          if (!pilih || !pilih.length) return;
          pilih.forEach(function (u) { L.diskusi[u.i].penanya = u.ke; });
          gambarDiskusi(); berubah(); H.toast(pilih.length + ' nama diperbarui.');
        });
    }
    window.addEventListener('beforeunload', function () { if (kotor) simpan(); }, { once: true });
    var cekRute = function () { if (kotor) simpan(); window.removeEventListener('hashchange', cekRute); };
    window.addEventListener('hashchange', cekRute);
  }

  /** Nama paling mirip (abaikan gelar & sapaan). */
  function cariMirip(n, daftar) {
    function token(x) {
      return String(x).toLowerCase().replace(/\(.*?\)/g, ' ').split(',')[0].replace(/\b(ibu|bapak|bpk|pak|bu|sdr|sdri|dr|drs|dra|prof|ir|hj|h|ns|apt)\b\.?/g, ' ')
        .replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(function (t) { return t.length > 1; });
    }
    var a = token(n.split(/[–—-]/)[0]), terbaik = null, skor = 0;
    if (!a.length) return null;
    daftar.forEach(function (d) {
      var b = token(d), cocok = 0;
      a.forEach(function (t) { if (b.some(function (u) { return u === t || (t.length >= 4 && (u.indexOf(t) === 0 || t.indexOf(u) === 0)); })) cocok++; });
      var s = cocok / Math.max(a.length, 1);
      if (s > skor) { skor = s; terbaik = d; }
    });
    return skor >= 0.5 ? terbaik : null;
  }

  function pratinjauNotulen(k, L, nara) {
    var ol = function (t) { var a = H.rapikanPoin(t); return a.length ? '<ol>' + a.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' : '<p class="kecil">—</p>'; };
    var ul = function (t) { var a = H.rapikanPoin(t); return a.length ? '<ul>' + a.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; };
    var html = '<div class="pratinjau-notulen">' +
      '<h5>A. Pokok-Pokok Materi</h5>' + (L.materi || []).map(function (m, i) {
        return '<p style="margin:6px 0 0"><b>' + (i + 1) + '. ' + esc(m.narasumber || 'Narasumber') + (m.judul ? ' — ' + esc(m.judul) : '') + '</b></p>' + ul(m.poin);
      }).join('') +
      ((L.diskusi || []).some(function (q) { return q.pertanyaan; }) ? '<h5>B. Diskusi dan Tanya Jawab</h5>' + L.diskusi.filter(function (q) { return q.pertanyaan; }).map(function (q, i) {
        return '<p style="margin:8px 0 0"><b>' + (i + 1) + '. Pertanyaan dari <span style="color:var(--teal-tua)">' + esc(q.penanya || 'Peserta') + '</span></b></p>' +
          '<p style="margin:0 0 0 18px;font-style:italic">' + esc(H.rapikanKalimat(q.pertanyaan)) + '</p>' +
          (q.jawaban ? '<p style="margin:2px 0 0 18px"><b>Tanggapan' + (q.penjawab ? ' ' + esc(q.penjawab) : '') + ':</b></p><div style="margin-left:18px">' + ul(q.jawaban) + '</div>' : '');
      }).join('') : '') +
      '<h5>Kesimpulan</h5>' + ol(L.kesimpulan) + '</div>';
    H.dialog('Pratinjau notulensi (seperti di laporan)', html);
  }

  /* =================== DOKUMENTASI =================== */
  var FOTO = {};
  async function tabDokumentasi(k) {
    var wadah = $('isi-tab');
    wadah.innerHTML = '<div class="muat"><span class="putar"></span> Memuat dokumentasi…</div>';
    var d;
    try { d = LAP[k.id] || await muatLaporan(k); } catch (e) { wadah.innerHTML = '<div class="pesan galat">' + esc(e.message) + '</div>'; return; }
    var L = d.laporan || {}; L.foto = L.foto || { tataLetak: 3, keterangan: '' };
    var foto = d.berkas.filter(function (b) { return b.jenis === 'foto'; });
    wadah.innerHTML =
      '<div class="kartu"><div class="baris antara"><h3 style="margin:0">📷 Foto dokumentasi (' + foto.length + ')</h3>' +
      '<label class="tbl">＋ Tambah foto<input type="file" accept="image/*" multiple hidden id="in-foto"></label></div>' +
      '<p class="sub kecil" style="margin-top:6px">Pilih banyak foto sekaligus. Foto diperkecil otomatis (±300 KB) agar laporan tidak berat. Urutkan dengan tombol ← →.</p>' +
      '<div id="galeri" class="galeri"></div></div>' +
      '<div class="kartu"><h3>Tata letak di laporan</h3>' +
      '<div class="pilihan" id="tata-letak" style="margin-bottom:12px">' +
      '<label><input type="radio" name="tl" value="3"' + (Number(L.foto.tataLetak) !== 4 ? ' checked' : '') + '> 3 foto per halaman (besar)</label>' +
      '<label><input type="radio" name="tl" value="4"' + (Number(L.foto.tataLetak) === 4 ? ' checked' : '') + '> 4 foto per halaman (2 × 2)</label></div>' +
      '<label class="f"><span>Keterangan foto (satu untuk semua halaman dokumentasi)</span><input type="text" id="ket-foto" value="' + esc(L.foto.keterangan) + '" placeholder="Dokumentasi ' + esc(k.nama) + ', ' + esc(H.tglPanjang(k.tanggal)) + '"></label>' +
      '<button class="tbl" id="simpan-tl">💾 Simpan tata letak</button></div>';

    async function gambarGaleri() {
      var g = $('galeri'); if (!g) return;
      if (!foto.length) { g.innerHTML = '<div class="kosong kecil" style="grid-column:1/-1">Belum ada foto.</div>'; return; }
      g.innerHTML = foto.map(function (f, i) {
        return '<figure data-id="' + f.id + '"><span class="no-foto">' + (i + 1) + '</span><img alt="" ' + (FOTO[f.id] ? 'src="' + FOTO[f.id] + '"' : '') + '>' +
          '<div class="aksi-foto"><span><button class="tbl garis ikon kecil" data-geser="-1" title="Geser kiri">←</button> <button class="tbl garis ikon kecil" data-geser="1" title="Geser kanan">→</button></span>' +
          '<button class="tbl bahaya ikon kecil" data-hapus="1" title="Hapus">✕</button></div></figure>';
      }).join('');
      for (var i = 0; i < foto.length; i++) {
        var f = foto[i];
        if (FOTO[f.id]) continue;
        try {
          var r = await H.api('ambilBerkas', { id: f.id });
          if (r.ok) { FOTO[f.id] = 'data:' + r.mime + ';base64,' + r.data; var im = g.querySelector('[data-id="' + f.id + '"] img'); if (im) im.src = FOTO[f.id]; }
        } catch (e) { }
      }
    }
    gambarGaleri();
    $('galeri').onclick = async function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var id = b.closest('figure').dataset.id, i = foto.findIndex(function (x) { return x.id === id; });
      if (b.dataset.hapus) {
        if (!await H.konfirmasi('Hapus foto?', 'Foto ini akan dihapus dari dokumentasi kegiatan.', 'Hapus', true)) return;
        var r = await H.api('hapusBerkas', { id: id }); if (!r.ok) return H.toast(r.pesan, true);
        d.berkas = r.berkas; foto = r.berkas.filter(function (x) { return x.jenis === 'foto'; }); $('isi-tab').querySelector('h3').textContent = '📷 Foto dokumentasi (' + foto.length + ')'; gambarGaleri();
      } else if (b.dataset.geser) {
        var j = i + Number(b.dataset.geser); if (j < 0 || j >= foto.length) return;
        var t = foto[i]; foto[i] = foto[j]; foto[j] = t; gambarGaleri();
        var r2 = await H.api('urutBerkas', { k: k.id, ids: foto.map(function (x) { return x.id; }) });
        if (r2.ok) d.berkas = r2.berkas;
      }
    };
    $('in-foto').onchange = async function () {
      var files = Array.from(this.files); this.value = '';
      for (var i = 0; i < files.length; i++) {
        H.toast('Mengunggah foto ' + (i + 1) + '/' + files.length + '…');
        try {
          var g = await H.kecilkanGambar(files[i], 1600, 0.82);
          var r = await H.api('unggahBerkas', { k: k.id, jenis: 'foto', nama: files[i].name.replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg', data: g.dataUrl.split(',')[1] });
          if (!r.ok) { H.toast(r.pesan, true); continue; }
          d.berkas = r.berkas;
          var baru = r.berkas.filter(function (x) { return x.jenis === 'foto'; });
          baru.forEach(function (x) { if (!foto.some(function (y) { return y.id === x.id; })) FOTO[x.id] = g.dataUrl; });
          foto = baru;
          $('isi-tab').querySelector('h3').textContent = '📷 Foto dokumentasi (' + foto.length + ')';
          gambarGaleri();
        } catch (e) { H.toast(e.message, true); }
      }
      H.toast('Selesai mengunggah ' + files.length + ' foto.');
    };
    $('simpan-tl').onclick = async function () {
      var data = Object.assign({}, d.laporan || {});
      data.foto = { tataLetak: Number((document.querySelector('#tata-letak input:checked') || {}).value) || 3, keterangan: $('ket-foto').value.trim() };
      var r = await H.api('simpanLaporan', { k: k.id, data: data });
      if (!r.ok) return H.toast(r.pesan, true);
      d.laporan = data; H.toast('Tata letak dokumentasi tersimpan.');
    };
  }

  /* =================== MATERI =================== */
  async function tabMateri(k) {
    var wadah = $('isi-tab');
    wadah.innerHTML = '<div class="muat"><span class="putar"></span> Memuat materi…</div>';
    var d;
    try { d = LAP[k.id] || await muatLaporan(k); } catch (e) { wadah.innerHTML = '<div class="pesan galat">' + esc(e.message) + '</div>'; return; }
    var link = (H.CFG.URL_APLIKASI || '') + 'materi.html?k=' + encodeURIComponent(k.id);
    function ikon(m, n) { n = String(n).toLowerCase(); return /pdf/.test(m) || /\.pdf$/.test(n) ? '📕' : /presentation|powerpoint/.test(m) || /\.pptx?$/.test(n) ? '📙' : /word|document/.test(m) || /\.docx?$/.test(n) ? '📘' : '📄'; }
    function gambar() {
      var materi = d.berkas.filter(function (b) { return b.jenis === 'materi'; });
      wadah.innerHTML =
        '<div class="kartu"><h3>⬆️ Unggah materi narasumber</h3><p class="sub kecil">PPT, PDF, atau Word · maks. 20 MB per file. Peserta dapat mengunduh setelah mengisi daftar hadir dan di menu Gizi-Link.</p>' +
        '<div class="grid2"><label class="f"><span>Narasumber</span><select id="m-nara">' + d.narasumber.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') + '<option value="">Lainnya / umum</option></select></label>' +
        '<label class="f"><span>File materi</span><input type="file" id="m-file" accept=".pdf,.ppt,.pptx,.doc,.docx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label></div>' +
        '<button class="tbl" id="m-unggah">⬆️ Unggah</button> <span class="kecil" id="m-status"></span></div>' +
        '<div class="kartu"><div class="baris antara"><h3 style="margin:0">📚 Materi (' + materi.length + ')</h3>' +
        (materi.length ? '<div class="baris"><button class="tbl garis kecil" id="m-salin">🔗 Salin link materi</button><a class="tbl wa kecil" target="_blank" rel="noopener" href="https://wa.me/?text=' +
          encodeURIComponent('*Materi ' + k.nama + '*\nSilakan unduh materi narasumber melalui link berikut:\n' + link) + '">💬 Bagikan ke WA</a></div>' : '') + '</div>' +
        (materi.length ? '<div class="daftar-materi mt">' + materi.map(function (m) {
          return '<div class="materi-item"><span class="ikon">' + ikon(m.mime, m.nama) + '</span><div class="info"><b>' + esc(m.nama) + '</b><span class="kecil">' + esc(m.narasumber || 'Umum') + ' · ' + esc(H.ukuranFile(m.ukuran)) + '</span></div>' +
            '<button class="tbl lembut kecil" data-unduh="' + m.id + '">⬇️</button><button class="tbl bahaya kecil" data-hapus="' + m.id + '">✕</button></div>';
        }).join('') + '</div>' : '<div class="kosong kecil">Belum ada materi.</div>') + '</div>';
      $('m-unggah').onclick = unggah;
      if ($('m-salin')) $('m-salin').onclick = function () { navigator.clipboard.writeText(link).then(function () { H.toast('Link materi tersalin.'); }); };
      wadah.querySelectorAll('[data-unduh]').forEach(function (b) {
        b.onclick = async function () {
          b.disabled = true;
          try { var r = await H.api('ambilBerkas', { id: b.dataset.unduh }); if (!r.ok) return H.toast(r.pesan, true); H.unduhBytes(H.base64KeBytes(r.data), r.nama, r.mime); }
          catch (e) { H.toast(e.message, true); } finally { b.disabled = false; }
        };
      });
      wadah.querySelectorAll('[data-hapus]').forEach(function (b) {
        b.onclick = async function () {
          if (!await H.konfirmasi('Hapus materi?', 'File materi ini akan dihapus dan tidak bisa diunduh peserta lagi.', 'Hapus', true)) return;
          var r = await H.api('hapusBerkas', { id: b.dataset.hapus }); if (!r.ok) return H.toast(r.pesan, true);
          d.berkas = r.berkas; gambar();
        };
      });
    }
    async function unggah() {
      var f = $('m-file').files[0];
      if (!f) return H.toast('Pilih file materi dulu.', true);
      if (!/\.(pdf|pptx?|docx?)$/i.test(f.name)) return H.toast('Format harus PDF, PPT/PPTX, atau DOC/DOCX.', true);
      if (f.size > 20 * 1024 * 1024) return H.toast('File terlalu besar (maks. 20 MB).', true);
      var b = $('m-unggah'); b.disabled = true; $('m-status').textContent = 'Mengunggah ' + H.ukuranFile(f.size) + '… (jangan tutup halaman)';
      try {
        var data = await H.fileKeBase64(f);
        var r = await H.api('unggahBerkas', { k: k.id, jenis: 'materi', nama: f.name, mime: f.type || 'application/octet-stream', data: data, narasumber: $('m-nara').value });
        if (!r.ok) { H.toast(r.pesan, true); return; }
        d.berkas = r.berkas; H.toast('Materi terunggah.'); gambar();
      } catch (e) { H.toast(e.message, true); }
      finally { if ($('m-unggah')) { $('m-unggah').disabled = false; $('m-status').textContent = ''; } }
    }
    gambar();
  }

  /* =================== SURAT KEGIATAN =================== */
  var JENIS_SURAT = ['Undangan Narasumber', 'Undangan Peserta / CI', 'Surat Tugas / SK Panitia', 'Surat Permohonan', 'Lainnya'];
  async function tabSurat(k) {
    var wadah = $('isi-tab');
    wadah.innerHTML = '<div class="muat"><span class="putar"></span> Memuat surat…</div>';
    var d;
    try { d = LAP[k.id] || await muatLaporan(k); } catch (e) { wadah.innerHTML = '<div class="pesan galat">' + esc(e.message) + '</div>'; return; }
    function gambar() {
      var surat = d.berkas.filter(function (b) { return b.jenis === 'surat'; });
      wadah.innerHTML =
        '<div class="kartu"><h3>⬆️ Unggah surat kegiatan</h3><p class="sub kecil">PDF hasil SRIKANDI atau foto/scan (JPG/PNG), maks. 20 MB. Surat masuk ke <b>Lampiran</b> laporan (tiap halaman ditampilkan utuh) dan nomornya otomatis ditulis di <b>Dasar Kegiatan</b>.</p>' +
        '<div class="grid2"><label class="f"><span>Jenis surat</span><select id="s-jenis">' + JENIS_SURAT.map(function (j) { return '<option>' + esc(j) + '</option>'; }).join('') + '</select></label>' +
        '<label class="f"><span>Nomor surat <em class="kecil" style="font-style:normal">(opsional)</em></span><input type="text" id="s-nomor" placeholder="mis. PP.05.01/F.XII.11.8/1342/2026"></label></div>' +
        '<label class="f"><span>File surat</span><input type="file" id="s-file" accept=".pdf,image/jpeg,image/png,application/pdf"></label>' +
        '<button class="tbl" id="s-unggah">⬆️ Unggah</button> <span class="kecil" id="s-status"></span></div>' +
        '<div class="kartu"><h3>✉️ Surat kegiatan (' + surat.length + ')</h3>' +
        (surat.length ? '<div class="daftar-materi">' + surat.map(function (m, i) {
          return '<div class="materi-item"><span class="ikon">' + (/pdf/.test(m.mime) ? '📕' : '🖼️') + '</span><div class="info"><b>' + esc(m.narasumber || 'Surat') + '</b>' +
            '<span class="kecil">' + (m.keterangan ? 'Nomor ' + esc(m.keterangan) + ' · ' : '') + esc(m.nama) + ' · ' + esc(H.ukuranFile(m.ukuran)) + '</span></div>' +
            (i > 0 ? '<button class="tbl garis ikon kecil" data-naik="' + m.id + '" title="Naikkan">↑</button>' : '') +
            '<button class="tbl lembut kecil" data-unduh="' + m.id + '">⬇️</button><button class="tbl bahaya kecil" data-hapus="' + m.id + '">✕</button></div>';
        }).join('') + '</div>' : '<div class="kosong kecil">Belum ada surat. Unggah undangan narasumber, undangan peserta/CI, atau surat tugas agar laporan lengkap.</div>') + '</div>';
      $('s-unggah').onclick = unggah;
      wadah.querySelectorAll('[data-unduh]').forEach(function (b) {
        b.onclick = async function () {
          b.disabled = true;
          try { var r = await H.api('ambilBerkas', { id: b.dataset.unduh }); if (!r.ok) return H.toast(r.pesan, true); H.unduhBytes(H.base64KeBytes(r.data), r.nama, r.mime); }
          catch (e) { H.toast(e.message, true); } finally { b.disabled = false; }
        };
      });
      wadah.querySelectorAll('[data-hapus]').forEach(function (b) {
        b.onclick = async function () {
          if (!await H.konfirmasi('Hapus surat?', 'Surat ini akan dihapus dari lampiran laporan.', 'Hapus', true)) return;
          var r = await H.api('hapusBerkas', { id: b.dataset.hapus }); if (!r.ok) return H.toast(r.pesan, true);
          d.berkas = r.berkas; gambar();
        };
      });
      wadah.querySelectorAll('[data-naik]').forEach(function (b) {
        b.onclick = async function () {
          var ids = surat.map(function (x) { return x.id; }), i = ids.indexOf(b.dataset.naik);
          ids.splice(i - 1, 0, ids.splice(i, 1)[0]);
          var r = await H.api('urutBerkas', { k: k.id, ids: ids }); if (!r.ok) return H.toast(r.pesan, true);
          d.berkas = r.berkas; gambar();
        };
      });
    }
    async function unggah() {
      var f = $('s-file').files[0];
      if (!f) return H.toast('Pilih file surat dulu.', true);
      if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return H.toast('Format harus PDF, JPG, atau PNG.', true);
      if (f.size > 20 * 1024 * 1024) return H.toast('File terlalu besar (maks. 20 MB).', true);
      var b = $('s-unggah'); b.disabled = true; $('s-status').textContent = 'Mengunggah…';
      try {
        var data, mime = f.type || 'application/pdf', nama = f.name;
        if (/^image\//.test(mime)) { var g = await H.kecilkanGambar(f, 2200, 0.88); data = g.dataUrl.split(',')[1]; mime = 'image/jpeg'; nama = nama.replace(/\.[^.]+$/, '') + '.jpg'; }
        else data = await H.fileKeBase64(f);
        var r = await H.api('unggahBerkas', { k: k.id, jenis: 'surat', nama: nama, mime: mime, data: data, narasumber: $('s-jenis').value, keterangan: $('s-nomor').value.trim() });
        if (!r.ok) { H.toast(r.pesan, true); return; }
        d.berkas = r.berkas; H.toast('Surat terunggah.'); gambar();
      } catch (e) { H.toast(e.message, true); }
      finally { if ($('s-unggah')) { $('s-unggah').disabled = false; $('s-status').textContent = ''; } }
    }
    gambar();
  }

  /* =================== EVALUASI =================== */
  async function tabEvaluasi(k) {
    var wadah = $('isi-tab');
    if (!k.evaluasi) {
      wadah.innerHTML = '<div class="kartu kosong"><span class="em">⭐</span><p>Evaluasi kepuasan peserta <b>tidak diaktifkan</b> untuk kegiatan ini.</p><a class="tbl garis" href="#/edit/' + esc(k.id) + '">Aktifkan di pengaturan kegiatan</a></div>';
      return;
    }
    wadah.innerHTML = '<div class="muat"><span class="putar"></span> Menghitung hasil evaluasi…</div>';
    var d;
    try { d = await muatLaporan(k); } catch (e) { wadah.innerHTML = '<div class="pesan galat">' + esc(e.message) + '</div>'; return; }
    var r = Laporan.ringkasEvaluasi(d.evaluasi, d.aspek, d.narasumber);
    if (!r.n) { wadah.innerHTML = '<div class="kartu kosong"><span class="em">⭐</span>Belum ada peserta yang mengisi evaluasi.</div>'; return; }
    var barisNilai = function (x) {
      return '<div class="baris-nilai"><span>' + esc(x.label) + '</span><div class="batang"><i style="width:' + (x.rata / 5 * 100) + '%"></i></div><b>' + Laporan.koma(x.rata) + '</b></div>';
    };
    wadah.innerHTML =
      '<div class="statistik"><div class="stat"><b>' + r.n + '</b><span>Responden</span></div><div class="stat"><b>' + Laporan.koma(r.indeks) + '</b><span>Indeks kepuasan (1–5)</span></div>' +
      '<div class="stat"><b style="font-size:18px">' + esc(r.kategori) + '</b><span>Kategori</span></div><div class="stat"><b>' + r.saran.length + '</b><span>Saran tertulis</span></div></div>' +
      '<div class="kartu"><h3>Penilaian per aspek</h3>' + r.aspek.map(barisNilai).join('') + '</div>' +
      (r.narasumber.length ? '<div class="kartu"><h3>Penilaian narasumber</h3>' + r.narasumber.map(barisNilai).join('') + '</div>' : '') +
      '<div class="kartu"><h3>Saran peserta</h3>' + (r.saran.length ? '<ul>' + r.saran.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '<p class="kecil">Belum ada saran.</p>') + '</div>' +
      '<p class="kecil">Kategori: 4,21–5,00 Sangat Baik · 3,41–4,20 Baik · 2,61–3,40 Cukup · 1,81–2,60 Kurang · 1,00–1,80 Sangat Kurang.</p>';
  }

  mulai();
})();
