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
          '<td class="kecil">' + esc(r.waktuHadir) + '</td><td class="aksi">' + aksi + '</td></tr>';
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
        modeSertifikat: (document.querySelector('#f-mode input:checked') || {}).value || 'tanpa'
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
    var tabs = [['bagikan', '🔗 Bagikan'], ['peserta', '👥 Peserta'], ['sertifikat', '📄 Sertifikat'], ['rekap', '🖨️ Rekap']];
    isi.innerHTML =
      '<div class="baris antara" style="margin-bottom:12px"><a class="tbl garis kecil" href="#/">← Semua kegiatan</a>' +
      '<div class="baris"><a class="tbl garis kecil" href="#/edit/' + esc(k.id) + '">✏️ Ubah</a>' +
      (DATA.user.peran === 'superadmin' ? '<button class="tbl bahaya kecil" id="hapus-keg">🗑️ Hapus</button>' : '') + '</div></div>' +
      '<section class="pita">' +
      '<p style="margin:0 0 4px;opacity:.85">' + esc(k.jenis || 'Kegiatan') + (k.penyelenggara ? ' · ' + esc(k.penyelenggara) : '') + '</p>' +
      '<h1>' + esc(k.nama) + '</h1><div class="meta">' +
      '<span>📅 ' + esc(H.tglPanjang(k.tanggal, true)) + (k.waktu ? ', ' + esc(k.waktu) : '') + '</span>' +
      (k.tempat ? '<span>📍 ' + esc(k.tempat) + '</span>' : '') + (k.narasumber ? '<span>🎤 ' + esc(k.narasumber) + '</span>' : '') +
      '<span>👥 ' + k.sasaran.map(function (s) { return esc(H.SASARAN[s]); }).join(', ') + '</span></div></section>' +
      '<div class="kartu"><div class="baris antara"><div>' + H.labelAbsen(k.absen) +
      ' <span class="kecil">' + (k.bukaAbsen ? 'Buka ' + esc(H.waktuPanjang(k.bukaAbsen)) : 'Buka langsung') + ' · ' +
      (k.tutupAbsen ? 'Tutup ' + esc(H.waktuPanjang(k.tutupAbsen)) : 'tutup manual') + '</span></div>' +
      '<div class="pilihan" id="status-absen">' + [['otomatis', 'Ikuti jadwal'], ['buka', 'Buka sekarang'], ['tutup', 'Tutup sekarang']].map(function (s) {
        return '<label><input type="radio" name="sa" value="' + s[0] + '"' + (k.statusAbsen === s[0] ? ' checked' : '') + '> ' + s[1] + '</label>';
      }).join('') + '</div></div></div>' +
      '<div class="tab" id="tab">' + tabs.map(function (t) { return '<button data-t="' + t[0] + '"' + (t[0] === tab ? ' class="aktif"' : '') + '>' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div id="isi-tab"></div>';

    $('tab').onclick = function (e) { var b = e.target.closest('button'); if (b) location.hash = '#/k/' + k.id + '/' + b.dataset.t; };
    $('status-absen').onchange = async function (e) {
      try {
        var r = await H.api('aturAbsen', { k: k.id, status: e.target.value });
        if (!r.ok) return H.toast(r.pesan, true);
        await segarkan(); H.toast('Status absen diperbarui.'); rute();
      } catch (err) { H.toast(err.message, true); }
    };
    if ($('hapus-keg')) $('hapus-keg').onclick = async function () {
      if (!await H.konfirmasi('Hapus kegiatan?', 'Kegiatan <b>' + esc(k.nama) + '</b> akan disembunyikan dari aplikasi. Data kehadiran tetap tersimpan di Google Sheet.', 'Hapus', true)) return;
      var r = await H.api('hapusKegiatan', { k: k.id });
      if (!r.ok) return H.toast(r.pesan, true);
      await segarkan(); H.toast('Kegiatan dihapus.'); location.hash = '#/';
    };

    ({ bagikan: tabBagikan, peserta: tabPeserta, sertifikat: tabSertifikat, rekap: tabRekap }[tab] || tabBagikan)(k);
  }

  /* ---------- Tab: Bagikan ---------- */
  function teksUndangan(k, link) {
    return '*DAFTAR HADIR*\n' + k.nama + '\n📅 ' + H.tglPanjang(k.tanggal, true) + (k.waktu ? ', ' + k.waktu : '') +
      (k.tempat ? '\n📍 ' + k.tempat : '') + '\n\nSilakan isi daftar hadir melalui link berikut:\n' + link +
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
      var hitung = { Mahasiswa: 0, CI: 0, Umum: 0 }, prodi = {};
      list.forEach(function (p) { hitung[p.kategori] = (hitung[p.kategori] || 0) + 1; if (p.kategori === 'Mahasiswa') prodi[p.prodi] = (prodi[p.prodi] || 0) + 1; });
      var serti = k.modeSertifikat !== 'tanpa' && k.adaTemplat;
      var tampil = list.filter(function (p) { return !q || (p.nama + ' ' + p.nim + ' ' + p.instansi + ' ' + p.email + ' ' + p.prodi).toLowerCase().indexOf(q) >= 0; });
      wadah.innerHTML =
        '<div class="statistik"><div class="stat"><b>' + list.length + '</b><span>Total hadir</span></div>' +
        Object.keys(prodi).map(function (p) { return '<div class="stat"><b>' + prodi[p] + '</b><span>' + esc(p) + '</span></div>'; }).join('') +
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
        '<label class="f"><span>' + (p.kategori === 'CI' ? 'Lahan praktik' : 'Instansi') + '</span><input type="text" id="u-inst" value="' + esc(p.instansi) + '"></label>' +
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
      '<div class="grid2">' +
      '<div class="kartu"><h3>🖨️ Daftar hadir resmi</h3><p class="sub">Kop Jurusan Gizi, tabel peserta dengan tanda tangan, dan pengesahan Ketua Jurusan. Simpan sebagai PDF lewat menu cetak.</p>' +
      '<a class="tbl penuh" target="_blank" href="rekap.html?k=' + encodeURIComponent(k.id) + '">Buka & Cetak Daftar Hadir</a></div>' +
      '<div class="kartu"><h3>📊 Excel</h3><p class="sub">Semua data peserta (tanpa gambar tanda tangan) untuk diolah lebih lanjut.</p>' +
      '<button class="tbl garis penuh" id="excel">Unduh Excel</button></div>' +
      (serti ? '<div class="kartu"><h3>📄 Semua sertifikat</h3><p class="sub">Satu file PDF berisi sertifikat seluruh peserta (1 halaman per orang), siap dicetak.</p>' +
        '<button class="tbl garis penuh" id="semua">Unduh Semua Sertifikat (PDF)</button></div>' : '') +
      '</div>';
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
      '<div class="kartu"><h3>Admin Daftar Hadir</h3><p class="sub">Diatur dari kolom <b>Daftar Hadir</b> di sheet <b>Staf</b> portal Gizi-Link (isi <code>superadmin</code> atau <code>admin</code>). Perubahan berlaku ±5 menit.</p>' +
      (adm ? '<div class="tabel-wrap"><table class="tabel"><thead><tr><th>Nama</th><th>NIP</th><th>Peran</th></tr></thead><tbody>' + adm + '</tbody></table></div>' : '<p class="kecil">Belum ada.</p>') + '</div>';
    $('fp').onsubmit = async function (e) {
      e.preventDefault();
      var r = await H.api('simpanPengaturan', { data: { pengesahan_jabatan: $('s-jab').value, pengesahan_nama: $('s-nama').value, pengesahan_nip: $('s-nip').value, kota: $('s-kota').value, unit: $('s-unit').value } });
      if (!r.ok) return H.toast(r.pesan, true);
      DATA.pengaturan = r.pengaturan; H.toast('Pengaturan tersimpan.');
    };
  }

  mulai();
})();
