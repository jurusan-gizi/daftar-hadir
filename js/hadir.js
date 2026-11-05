/* Form daftar hadir peserta (publik, dibuka dari QR / link WA / chat Zoom / menu Gizi-Link) */
(function () {
  'use strict';
  var H = window.Hadir, $ = H.$, esc = H.esc;
  var kId = new URLSearchParams(location.search).get('k') || '';
  var KEG = null, pad = null;
  var st = { kategori: '', mhs: null, nimDicek: '', pakaiSso: false, emailSamar: '' };

  var isi = $('isi');

  function galat(pesan) {
    isi.innerHTML = '<div class="kartu kosong"><span class="em">⚠️</span><p>' + esc(pesan) + '</p></div>';
  }

  async function mulai() {
    if (!kId) return galat('Link daftar hadir tidak lengkap. Minta link yang benar kepada panitia.');
    try {
      var d = await H.api('info', { k: kId }, { tanpaToken: true });
      if (!d.ok) return galat(d.pesan);
      KEG = d.kegiatan;
      document.title = 'Daftar Hadir · ' + KEG.nama;
      var simpan = bacaTerakhir();
      if (simpan) return tampilSukses(simpan, true);
      tampilForm();
    } catch (e) { galat(e.message); }
  }

  function pita() {
    var k = KEG;
    return '<section class="pita">' +
      '<p style="margin:0 0 4px;opacity:.85">' + esc(k.jenis || 'Kegiatan') + (k.penyelenggara ? ' · ' + esc(k.penyelenggara) : '') + '</p>' +
      '<h1>' + esc(k.nama) + '</h1>' +
      '<div class="meta">' +
      '<span>📅 ' + esc(H.tglPanjang(k.tanggal, true)) + (k.waktu ? ', ' + esc(k.waktu) : '') + '</span>' +
      (k.tempat ? '<span>📍 ' + esc(k.tempat) + '</span>' : '') +
      (k.narasumber ? '<span>🎤 ' + esc(k.narasumber) + '</span>' : '') +
      '</div></section>';
  }

  function sasaranMhs() { return KEG.sasaran.filter(function (s) { return H.PRODI_MHS.indexOf(s) >= 0; }); }

  function tampilForm() {
    var k = KEG;
    if (k.absen !== 'buka') {
      isi.innerHTML = pita() + '<div class="kartu kosong"><span class="em">' + (k.absen === 'belum' ? '⏳' : '🔒') + '</span>' +
        '<h2>' + (k.absen === 'belum' ? 'Daftar hadir belum dibuka' : 'Daftar hadir sudah ditutup') + '</h2>' +
        (k.absen === 'belum' && k.bukaAbsen ? '<p>Dibuka ' + esc(H.waktuPanjang(k.bukaAbsen)) + '.</p>' : '') +
        (k.absen === 'tutup' ? '<p>Silakan hubungi panitia bila Anda hadir namun belum tercatat.</p>' : '') +
        (k.absen === 'belum' ? '<button class="tbl garis" onclick="location.reload()">Muat ulang</button>' : '') + '</div>';
      return;
    }

    var sso = window.GiziSSO && GiziSSO.get();
    var kodeSso = sso ? kodeProdi(sso.prodi) : '';
    st.pakaiSso = !!(sso && k.sasaran.indexOf(kodeSso) >= 0);

    var opsiKat = [];
    if (sasaranMhs().length) opsiKat.push(['MHS', '🎓', 'Mahasiswa', 'Jurusan Gizi']);
    if (k.sasaran.indexOf('CI') >= 0) opsiKat.push(['CI', '🏥', 'CI', 'Clinical Instructor']);
    if (k.sasaran.indexOf('UMUM') >= 0) opsiKat.push(['UMUM', '👥', 'Peserta Umum', 'Instansi / masyarakat']);

    isi.innerHTML = pita() +
      '<div id="pesan"></div>' +
      '<form class="kartu" id="form" novalidate>' +
      '<h2>Isi Daftar Hadir</h2>' +
      '<p class="sub">Ditutup ' + (k.tutupAbsen ? esc(H.waktuPanjang(k.tutupAbsen)) : 'oleh panitia') + ' · ' + esc(H.labelMode(k.modeSertifikat)) + '</p>' +
      '<div id="blok-sso"></div>' +
      '<div id="blok-kategori"' + (st.pakaiSso ? ' hidden' : '') + '>' +
      '<label class="f"><span>Saya hadir sebagai <i>*</i></span></label>' +
      '<div class="kategori" id="kategori">' + opsiKat.map(function (o) {
        return '<button type="button" data-k="' + o[0] + '"><span class="em">' + o[1] + '</span><b>' + o[2] + '</b><span>' + o[3] + '</span></button>';
      }).join('') + '</div></div>' +
      '<div id="blok-isian" class="mt"></div>' +
      '<div id="blok-akhir" hidden>' +
      '<div id="pratinjau-nama"></div>' +
      '<label class="f"><span>Tanda tangan <i>*</i></span></label>' +
      '<div class="ttd-kotak" id="ttd-kotak"><canvas id="ttd"></canvas><div class="garis-ttd"></div><div class="petunjuk" id="ttd-petunjuk">✍️ Tanda tangan di sini</div></div>' +
      '<div class="baris antara" style="margin:6px 0 16px"><span class="kecil">Gunakan jari atau mouse.</span><button type="button" class="tbl garis kecil" id="ttd-ulang">↺ Ulangi</button></div>' +
      '<button type="submit" class="tbl penuh" id="kirim">Kirim Daftar Hadir</button>' +
      '</div></form>';

    $('kategori').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-k]');
      if (!b) return;
      pilihKategori(b.dataset.k);
    });
    $('form').addEventListener('submit', kirim);
    $('ttd-ulang').onclick = function () { pad && pad.hapus(); };

    if (st.pakaiSso) tampilSso(sso);
    else if (opsiKat.length === 1) pilihKategori(opsiKat[0][0]);
  }

  function kodeProdi(t) {
    t = String(t || '').toUpperCase();
    if (t.indexOf('D3') === 0) return 'D3';
    if (t.indexOf('D4') === 0) return 'D4';
    if (t.indexOf('PROF') === 0) return 'PROF';
    return '';
  }

  function tampilSso(sso) {
    st.kategori = 'MHS';
    $('blok-sso').innerHTML =
      '<div class="cek-nama"><span>Masuk lewat Gizi-Link sebagai</span><b>' + esc(sso.nama) + '</b>' +
      '<span>' + esc(sso.nim) + ' · ' + esc(sso.prodi) + (sso.kelas ? ' · ' + esc(sso.kelas) : '') + '</span></div>' +
      '<p class="kecil" style="margin:-4px 0 12px">Bukan Anda? <a href="#" id="bukan-saya">Isi sebagai peserta lain</a></p>';
    $('bukan-saya').onclick = function (e) {
      e.preventDefault(); st.pakaiSso = false; $('blok-sso').innerHTML = ''; $('blok-kategori').hidden = false;
      $('blok-isian').innerHTML = ''; $('blok-akhir').hidden = true; st.kategori = '';
    };
    $('blok-isian').innerHTML = isianEmail(false, 'Email tersimpan akan dipakai bila dikosongkan.');
    st.mhs = { nama: sso.nama };
    tampilAkhir();
  }

  function isianEmail(wajib, bantu) {
    return '<label class="f"><span>Email' + (wajib ? ' <i>*</i>' : ' <em class="kecil" style="font-style:normal">(opsional)</em>') + '</span>' +
      '<input type="email" id="email" inputmode="email" autocomplete="email" placeholder="nama@contoh.com">' +
      '<small>' + esc(bantu || '') + '</small></label>';
  }

  function pilihKategori(kat) {
    st.kategori = kat; st.mhs = null; st.nimDicek = '';
    document.querySelectorAll('#kategori button').forEach(function (b) { b.classList.toggle('aktif', b.dataset.k === kat); });
    var serti = KEG.modeSertifikat !== 'tanpa';
    var bantuEmail = serti ? 'Link sertifikat dikirim ke email ini.' : '';
    var h = '';
    if (kat === 'MHS') {
      h = '<label class="f"><span>NIM <i>*</i></span>' +
        '<div class="link-kotak"><input type="text" id="nim" autocomplete="off" autocapitalize="characters" placeholder="Contoh: PO713231251001">' +
        '<button type="button" class="tbl lembut" id="cek">Cek</button></div>' +
        '<small>Ketik NIM, nama & prodi akan muncul otomatis.</small></label>' +
        '<div id="hasil-nim"></div>';
    } else if (kat === 'CI') {
      h = '<label class="f"><span>Nama lengkap & gelar <i>*</i></span><input type="text" id="nama" autocomplete="name" placeholder="Contoh: Hasnah, S.Gz, RD"></label>' +
        '<label class="f"><span>Lahan praktik <i>*</i></span><input type="text" id="instansi" placeholder="Contoh: RSUP Dr. Wahidin Sudirohusodo"></label>' +
        '<label class="f"><span>NIP / NIK <em class="kecil" style="font-style:normal">(opsional)</em></span><input type="text" id="nipnik" inputmode="numeric"></label>' +
        isianEmail(serti, bantuEmail);
    } else {
      h = '<label class="f"><span>Nama lengkap & gelar <i>*</i></span><input type="text" id="nama" autocomplete="name" placeholder="Contoh: Dr. Andi Nurul, S.Gz, M.Kes"></label>' +
        '<label class="f"><span>Instansi / asal <i>*</i></span><input type="text" id="instansi" placeholder="Contoh: Puskesmas Sudiang"></label>' +
        isianEmail(serti, bantuEmail);
    }
    $('blok-isian').innerHTML = h;
    if (kat === 'MHS') {
      $('blok-akhir').hidden = true;
      $('cek').onclick = cekNim;
      $('nim').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); cekNim(); } });
      $('nim').addEventListener('input', function () { if (st.nimDicek) { st.nimDicek = ''; st.mhs = null; $('hasil-nim').innerHTML = ''; $('blok-akhir').hidden = true; } });
      $('nim').focus();
    } else {
      $('nama').addEventListener('input', perbaruiPratinjau);
      tampilAkhir();
    }
  }

  async function cekNim() {
    var nim = $('nim').value.trim();
    if (nim.length < 5) { H.toast('Ketik NIM dengan lengkap.', true); return; }
    var btn = $('cek'); btn.disabled = true; btn.innerHTML = '<span class="putar kcl"></span>';
    try {
      var d = await H.api('cekNim', { nim: nim }, { tanpaToken: true });
      if (!d.ok) { H.toast(d.pesan, true); return; }
      st.nimDicek = nim;
      var serti = KEG.modeSertifikat !== 'tanpa';
      var bantu = serti ? 'Untuk menerima link sertifikat. Sertifikat juga tersedia di akun Gizi-Link Anda.' : '';
      if (d.ditemukan) {
        if (KEG.sasaran.indexOf(d.prodiKode) < 0) {
          st.mhs = null;
          $('hasil-nim').innerHTML = '<div class="pesan galat">NIM terdaftar atas nama <b>' + esc(d.nama) + '</b> (' + esc(d.prodi) + '). Kegiatan ini hanya untuk: ' +
            esc(KEG.sasaran.map(function (s) { return H.SASARAN[s]; }).join(', ')) + '.</div>';
          $('blok-akhir').hidden = true;
          return;
        }
        st.mhs = d;
        $('hasil-nim').innerHTML = '<div class="cek-nama"><b>' + esc(d.nama) + '</b><span>' + esc(d.nim) + ' · ' + esc(d.prodi) + (d.kelas ? ' · ' + esc(d.kelas) : '') + '</span></div>' +
          isianEmail(false, d.emailSamar ? 'Kosongkan untuk memakai email tersimpan (' + d.emailSamar + ').' : bantu);
      } else {
        var pilih = sasaranMhs();
        st.mhs = { manual: true };
        $('hasil-nim').innerHTML = '<div class="pesan peringatan">NIM belum terdaftar di Gizi-Link. Silakan isi data secara manual.</div>' +
          '<label class="f"><span>Nama lengkap <i>*</i></span><input type="text" id="nama" autocomplete="name"></label>' +
          '<label class="f"><span>Program studi <i>*</i></span><select id="prodi">' +
          (pilih.length > 1 ? '<option value="">— pilih —</option>' : '') +
          pilih.map(function (p) { return '<option value="' + p + '">' + esc(H.SASARAN[p]) + '</option>'; }).join('') + '</select></label>' +
          isianEmail(false, bantu);
        $('nama').addEventListener('input', perbaruiPratinjau);
      }
      tampilAkhir();
    } catch (e) { H.toast(e.message, true); }
    finally { btn.disabled = false; btn.textContent = 'Cek'; }
  }

  function namaSekarang() {
    if (st.pakaiSso || (st.mhs && !st.mhs.manual)) return st.mhs ? st.mhs.nama : '';
    return $('nama') ? $('nama').value : '';
  }

  function perbaruiPratinjau() {
    var el = $('pratinjau-nama');
    if (!el) return;
    if (KEG.modeSertifikat === 'tanpa') { el.innerHTML = ''; return; }
    var n = namaSekarang().trim();
    el.innerHTML = '<div class="pesan info"><span class="kecil">Nama yang akan tercetak di sertifikat:</span><br><b style="font-size:16px">' +
      (n ? esc(H.namaSertifikat(n)) : '—') + '</b><br><span class="kecil">Pastikan nama & gelar sudah benar sebelum dikirim.</span></div>';
  }

  function tampilAkhir() {
    $('blok-akhir').hidden = false;
    perbaruiPratinjau();
    if (!pad) {
      pad = TandaTangan($('ttd'), {
        onUbah: function (ada) { $('ttd-petunjuk').hidden = ada; $('ttd-kotak').classList.toggle('terisi', ada); }
      });
    } else pad.ukur();
  }

  async function kirim(e) {
    e.preventDefault();
    var data = { k: kId, kategori: st.kategori };
    var opsi = {};
    if (!st.kategori) return H.toast('Pilih kategori peserta dulu.', true);
    if (st.kategori === 'MHS' && !st.pakaiSso) {
      opsi.tanpaToken = true;
      if (!st.nimDicek || !st.mhs) return H.toast('Ketik NIM lalu tekan Cek.', true);
      data.nim = st.nimDicek;
      if (st.mhs.manual) {
        data.nama = $('nama').value.trim(); data.prodiKode = $('prodi').value;
        if (data.nama.length < 3) return H.toast('Nama lengkap wajib diisi.', true);
        if (!data.prodiKode) return H.toast('Pilih program studi.', true);
      }
    } else if (st.kategori === 'CI' || st.kategori === 'UMUM') {
      opsi.tanpaToken = true;
      data.nama = $('nama').value.trim(); data.instansi = $('instansi').value.trim();
      data.nipNik = $('nipnik') ? $('nipnik').value.trim() : '';
      if (data.nama.length < 3) return H.toast('Nama lengkap wajib diisi.', true);
      if (!data.instansi) return H.toast((st.kategori === 'CI' ? 'Lahan praktik' : 'Instansi/asal') + ' wajib diisi.', true);
    }
    data.email = $('email') ? $('email').value.trim() : '';
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) return H.toast('Format email tidak valid.', true);
    if ((st.kategori === 'CI' || st.kategori === 'UMUM') && KEG.modeSertifikat !== 'tanpa' && !data.email) return H.toast('Email wajib diisi agar sertifikat dapat dikirim.', true);
    if (!pad || pad.kosong()) return H.toast('Silakan tanda tangan dulu.', true);
    data.ttd = pad.dataUrl();

    var btn = $('kirim'); btn.disabled = true; btn.innerHTML = '<span class="putar kcl"></span> Mengirim…';
    try {
      var d = await H.api('hadir', data, opsi);
      if (!d.ok) { $('pesan').innerHTML = '<div class="pesan galat">' + esc(d.pesan) + '</div>'; window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      simpanTerakhir(d);
      tampilSukses(d, false);
    } catch (err) { H.toast(err.message, true); }
    finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = 'Kirim Daftar Hadir'; } }
  }

  /* Ingat pengisian terakhir di perangkat ini supaya tidak terkirim dua kali saat halaman dibuka ulang */
  function kunciLokal() { return 'hadir_' + kId; }
  function simpanTerakhir(d) { try { localStorage.setItem(kunciLokal(), JSON.stringify({ nama: d.nama, waktu: d.waktu, modeSertifikat: d.modeSertifikat, sertifikatSiap: d.sertifikatSiap, unduh: d.unduh, emailTerkirim: d.emailTerkirim, dobel: d.dobel })); } catch (e) { } }
  function bacaTerakhir() { try { return JSON.parse(localStorage.getItem(kunciLokal()) || 'null'); } catch (e) { return null; } }

  function tampilSukses(d, dariSimpanan) {
    var serti = '';
    if (d.sertifikatSiap && d.unduh) {
      serti = '<a class="tbl penuh mt" href="' + H.linkSertifikat(kId, d.unduh) + '">📄 Unduh Sertifikat</a>' +
        (d.emailTerkirim ? '<p class="kecil">Link sertifikat juga sudah dikirim ke email Anda.</p>' : '');
    } else if (d.modeSertifikat === 'setelah' || (d.modeSertifikat === 'langsung' && !d.sertifikatSiap)) {
      serti = '<div class="pesan info mt">Sertifikat akan dikirim ke email setelah kegiatan. Mahasiswa juga dapat mengunduhnya di menu <b>Daftar Hadir Kegiatan</b> pada Gizi-Link.</div>';
    }
    isi.innerHTML = pita() + '<div class="kartu pusat">' +
      '<div class="sukses-ikon">' + (d.dobel ? 'ℹ️' : '✅') + '</div>' +
      '<h2>' + (d.dobel ? 'Anda sudah tercatat hadir' : 'Terima kasih, kehadiran tercatat!') + '</h2>' +
      '<p><b>' + esc(d.nama) + '</b><br><span class="kecil">' + esc(d.waktu || '') + ' WITA</span></p>' +
      serti +
      '<div class="garis-atas"><button class="tbl garis kecil" id="lagi">Isi untuk peserta lain di perangkat ini</button></div>' +
      '</div>';
    $('lagi').onclick = function () {
      try { localStorage.removeItem(kunciLokal()); } catch (e) { }
      pad = null; st = { kategori: '', mhs: null, nimDicek: '', pakaiSso: false };
      tampilForm();
      window.scrollTo(0, 0);
    };
  }

  mulai();
})();
