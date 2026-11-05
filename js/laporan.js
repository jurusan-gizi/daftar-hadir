/**
 * Laporan Kegiatan — disusun otomatis dari data daftar hadir, notulensi, evaluasi, foto & materi.
 * Satu "model" (daftar blok) dirender menjadi Word (.docx, pustaka docx) dan HTML siap cetak/PDF.
 * Huruf isi: Cambria 12 pt · nuansa warna Kemenkes (teal & hijau limau).
 */
(function (w) {
  'use strict';
  var H = w.Hadir;
  var TEAL = '007F7F', TEAL2 = '00B8AD', LIME = 'CDDC29';
  var FONT = 'Cambria';
  var ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  var HURUF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  /* =================== EVALUASI =================== */
  function kategoriNilai(x) {
    if (!x) return '-';
    return x >= 4.21 ? 'Sangat Baik' : x >= 3.41 ? 'Baik' : x >= 2.61 ? 'Cukup' : x >= 1.81 ? 'Kurang' : 'Sangat Kurang';
  }
  function rata(arr) { var a = arr.filter(function (x) { return x > 0; }); return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : 0; }
  function koma(x, d) { return (Number(x) || 0).toFixed(d == null ? 2 : d).replace('.', ','); }

  function ringkasEvaluasi(ev, aspek, nara) {
    ev = ev || []; aspek = aspek || []; nara = nara || [];
    var ra = aspek.map(function (label, i) { var r = rata(ev.map(function (e) { return Number(e.a[i]) || 0; })); return { label: label, rata: r, kategori: kategoriNilai(r) }; });
    var rn = nara.map(function (nama, i) { var r = rata(ev.map(function (e) { return Number((e.n || [])[i]) || 0; })); return { label: nama, rata: r, kategori: kategoriNilai(r) }; });
    var indeks = rata(ra.map(function (x) { return x.rata; }));
    var saran = ev.map(function (e) { return String(e.saran || '').trim(); }).filter(function (s) { return s.length > 2; });
    var terendah = ra.slice().sort(function (a, b) { return a.rata - b.rata; })[0];
    return { n: ev.length, aspek: ra, narasumber: rn, indeks: indeks, kategori: kategoriNilai(indeks), saran: saran, terendah: terendah };
  }

  /* =================== TEKS BAKU =================== */
  function topik(k) {
    var t = String(k.nama || '').replace(/^(kuliah\s+(tamu|pakar|umum)|workshop|pembekalan|seminar|pelatihan|sosialisasi)\s*/i, '').replace(/["“”]/g, '').trim();
    return t || k.nama;
  }
  function jenisKecil(k) { return String(k.jenis || 'kegiatan').toLowerCase(); }
  function sasaranTeks(k) {
    var s = (k.sasaran || []).map(function (x) {
      return { D3: 'mahasiswa Prodi D3 Gizi', D4: 'mahasiswa Prodi Sarjana Terapan Gizi dan Dietetika', PROF: 'mahasiswa Pendidikan Profesi Dietisien',
        STAF: 'dosen, PLP, dan tenaga kependidikan', CI: 'Clinical Instructor (CI)', UMUM: 'peserta umum' }[x];
    }).filter(Boolean);
    return s.length > 1 ? s.slice(0, -1).join(', ') + ', dan ' + s[s.length - 1] : (s[0] || 'sivitas akademika');
  }

  function teksBaku(k) {
    var j = jenisKecil(k), tp = topik(k), thn = String(k.tanggal || '').slice(0, 4) || String(new Date().getFullYear());
    var pembuka = /pembekalan/.test(j)
      ? 'Kesiapan mahasiswa sebelum memasuki lahan praktik merupakan salah satu kunci keberhasilan pembelajaran praktik di Jurusan Gizi Poltekkes Kemenkes Makassar. Oleh karena itu, mahasiswa perlu dibekali pengetahuan, sikap, dan keterampilan yang memadai sebelum melaksanakan kegiatan di lapangan.'
      : /workshop|pelatihan/.test(j)
        ? 'Penguatan keterampilan praktis sivitas akademika merupakan bagian penting dari upaya Jurusan Gizi Poltekkes Kemenkes Makassar dalam menjaga mutu pendidikan dan pelayanan gizi. Perkembangan ilmu dan praktik di bidang kesehatan menuntut peningkatan kompetensi yang berkelanjutan.'
        : 'Perkembangan ilmu pengetahuan dan praktik di bidang gizi dan kesehatan berlangsung sangat cepat, sehingga sivitas akademika perlu terus memperbarui wawasan agar tetap relevan dengan kebutuhan di lapangan. Jurusan Gizi Poltekkes Kemenkes Makassar berupaya menjawab kebutuhan tersebut melalui berbagai kegiatan akademik.';
    var latar = pembuka + '\n' +
      'Sehubungan dengan hal tersebut, Jurusan Gizi menyelenggarakan ' + j + ' dengan tema "' + tp + '"' +
      (H.daftarNarasumber(k.narasumber).length ? ' yang menghadirkan narasumber yang kompeten di bidangnya' : '') +
      '. Kegiatan ini ditujukan bagi ' + sasaranTeks(k) + ', dan diharapkan dapat memperluas wawasan peserta, memperbarui pengetahuan sesuai perkembangan terkini, serta memperkuat keterkaitan antara pembelajaran di kampus dengan praktik di lapangan.';
    var tujuan = [
      'Meningkatkan pengetahuan dan wawasan peserta tentang ' + tp + '.',
      'Memberikan kesempatan kepada peserta untuk berdiskusi langsung dengan narasumber.',
      /pembekalan/.test(j) ? 'Mempersiapkan peserta agar siap melaksanakan kegiatan praktik di lapangan.' : 'Memperkuat kompetensi sivitas akademika Jurusan Gizi sesuai perkembangan ilmu dan praktik terkini.'
    ].join('\n');
    var dasar = 'Program kerja Jurusan Gizi Poltekkes Kemenkes Makassar Tahun ' + thn + '.';
    return { latarBelakang: latar, tujuan: tujuan, dasar: dasar };
  }

  function drafKesimpulan(k, jumlah, ring) {
    var a = ['Kegiatan ' + k.nama + ' telah terlaksana dengan baik pada ' + H.tglPanjang(k.tanggal, true) + (k.tempat ? ' bertempat di ' + k.tempat : '') + ' dan diikuti oleh ' + jumlah + ' peserta.'];
    if (ring && ring.n) a.push('Hasil evaluasi menunjukkan tingkat kepuasan peserta berada pada kategori ' + ring.kategori.toLowerCase() + ' dengan nilai rata-rata ' + koma(ring.indeks) + ' dari skala 5.');
    a.push('Peserta memperoleh tambahan pengetahuan dan wawasan terkait ' + topik(k) + '.');
    return a.join('\n');
  }

  function drafRekomendasi(ring) {
    var a = [];
    if (ring && ring.n) {
      var lemah = ring.aspek.filter(function (x) { return x.rata && x.rata < 4.21; }).sort(function (p, q) { return p.rata - q.rata; });
      if (lemah.length) lemah.slice(0, 2).forEach(function (x) { a.push('Perlu peningkatan pada aspek "' + x.label.toLowerCase() + '" (nilai rata-rata ' + koma(x.rata) + ') pada kegiatan berikutnya.'); });
      else a.push('Kegiatan serupa dapat diselenggarakan kembali secara berkala karena seluruh aspek dinilai sangat baik oleh peserta.');
      ring.saran.slice(0, 3).forEach(function (s) { a.push('Saran peserta: ' + H.rapikanKalimat(s).replace(/\.$/, '') + '.'); });
    } else {
      a.push('Kegiatan serupa dapat diselenggarakan kembali secara berkala sesuai kebutuhan peningkatan kompetensi sivitas akademika.');
    }
    return a.join('\n');
  }

  /* =================== GAMBAR (canvas) =================== */
  function muatGambar(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error('Gambar gagal dimuat.')); };
      im.src = src;
    });
  }
  async function urlKeDataUrl(url) {
    var r = await fetch(url);
    var b = await r.blob();
    return new Promise(function (res) { var f = new FileReader(); f.onload = function () { res(f.result); }; f.readAsDataURL(b); });
  }
  async function infoGambar(dataUrl) { var im = await muatGambar(dataUrl); return { data: dataUrl, w: im.naturalWidth, h: im.naturalHeight }; }

  function bungkus(ctx, teks, maks) {
    var kata = String(teks).split(/\s+/), out = [], b = '';
    kata.forEach(function (x) { var c = b ? b + ' ' + x : x; if (ctx.measureText(c).width > maks && b) { out.push(b); b = x; } else b = c; });
    if (b) out.push(b);
    return out;
  }

  /** Sampul A4 (1240×1754 px) bernuansa Kemenkes. */
  async function buatSampul(k, logo, unit) {
    var W = 1240, Hh = 1754, mm = W / 210;
    var c = document.createElement('canvas'); c.width = W; c.height = Hh;
    var x = c.getContext('2d');
    var bg = await muatGambar('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(w.Cover.coverSvg({ dark: '#007F7F', dark2: '#004F4C', mid: '#00B8AD', lime: '#CDDC29' })));
    x.drawImage(bg, 0, 0, W, Hh);
    var sans = '"Plus Jakarta Sans", Arial, Helvetica, sans-serif';
    x.textBaseline = 'alphabetic';
    // kicker
    x.fillStyle = '#CDDC29'; x.font = '700 ' + Math.round(5 * mm) + 'px ' + sans;
    x.fillText('LAPORAN KEGIATAN', 20 * mm, 32 * mm);
    // judul
    var judul = String(k.nama || '').toUpperCase(), uk = judul.length > 110 ? 8 : judul.length > 70 ? 9.5 : 11;
    x.fillStyle = '#FFFFFF'; x.font = '800 ' + Math.round(uk * mm) + 'px ' + sans;
    var baris = bungkus(x, judul, 165 * mm), y = 37 * mm + uk * mm;
    baris.slice(0, 6).forEach(function (b) { x.fillText(b, 20 * mm, y); y += uk * mm * 1.18; });
    // logo di area putih
    var lw = 125 * mm, lh = lw * logo.h / logo.w;
    var limg = await muatGambar(logo.data);
    x.drawImage(limg, (W - lw) / 2, 150 * mm - lh / 2, lw, lh);
    // detail
    x.textAlign = 'center';
    x.fillStyle = '#6B7C80'; x.font = '500 ' + Math.round(3.6 * mm) + 'px ' + sans;
    x.fillText('Diselenggarakan oleh', W / 2, 190 * mm);
    x.fillStyle = '#007F7F'; x.font = '700 ' + Math.round(4.8 * mm) + 'px ' + sans;
    x.fillText(unit + ' Poltekkes Kemenkes Makassar', W / 2, 198 * mm);
    x.fillStyle = '#333333'; x.font = '500 ' + Math.round(4.2 * mm) + 'px ' + sans;
    x.fillText(H.tglPanjang(k.tanggal, true), W / 2, 210 * mm);
    if (k.tempat) bungkus(x, k.tempat, 160 * mm).slice(0, 2).forEach(function (b, i) { x.fillText(b, W / 2, (217 + i * 6) * mm); });
    // kaki
    x.fillStyle = '#FFFFFF'; x.font = '700 ' + Math.round(5.2 * mm) + 'px ' + sans;
    x.fillText('POLITEKNIK KESEHATAN MAKASSAR', W / 2, 268 * mm);
    x.fillStyle = '#CFEDEA'; x.font = '500 ' + Math.round(3.6 * mm) + 'px ' + sans;
    x.fillText('KEMENTERIAN KESEHATAN', W / 2, 275 * mm);
    x.fillStyle = '#CDDC29'; x.font = '800 ' + Math.round(6.4 * mm) + 'px ' + sans;
    x.fillText(String(k.tanggal || '').slice(0, 4), W / 2, 287 * mm);
    return { data: c.toDataURL('image/png'), w: W, h: Hh };
  }

  /** Tanda tangan + stempel digabung (stempel sedikit menimpa tanda tangan). */
  async function gabungTtd(ttd, stempel) {
    if (!ttd && !stempel) return null;
    var c = document.createElement('canvas'); c.width = 700; c.height = 300;
    var x = c.getContext('2d');
    if (stempel) { var s = await muatGambar(stempel); var sh = 280, sw = sh * s.naturalWidth / s.naturalHeight; x.globalAlpha = 0.9; x.drawImage(s, 10, 10, sw, sh); x.globalAlpha = 1; }
    if (ttd) { var t = await muatGambar(ttd); var th = 220, tw = Math.min(460, th * t.naturalWidth / t.naturalHeight); th = tw * t.naturalHeight / t.naturalWidth; x.drawImage(t, stempel ? 150 : 40, (300 - th) / 2, tw, th); }
    return { data: c.toDataURL('image/png'), w: 700, h: 300 };
  }

  /** Grafik batang horizontal nilai (skala 1–5). */
  function grafikNilai(baris, judul) {
    var W = 1400, rowH = 78, top = 80, left = 520, right = 120;
    var Hh = top + baris.length * rowH + 40;
    var c = document.createElement('canvas'); c.width = W; c.height = Hh;
    var x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, Hh);
    x.fillStyle = '#1F2D3A'; x.font = 'bold 32px Arial'; x.fillText(judul, 20, 48);
    var lebar = W - left - right;
    // garis bantu 1..5
    x.strokeStyle = '#E2E8F0'; x.lineWidth = 2; x.fillStyle = '#94A3B8'; x.font = '22px Arial'; x.textAlign = 'center';
    for (var g = 0; g <= 5; g++) { var gx = left + lebar * g / 5; x.beginPath(); x.moveTo(gx, top - 10); x.lineTo(gx, Hh - 30); x.stroke(); x.fillText(String(g), gx, Hh - 6); }
    baris.forEach(function (b, i) {
      var yy = top + i * rowH;
      x.textAlign = 'right'; x.fillStyle = '#33474b'; x.font = '26px Arial';
      var lb = bungkus(x, b.label, left - 40);
      lb.slice(0, 2).forEach(function (t, j) { x.fillText(t, left - 20, yy + (lb.length > 1 ? 30 + j * 28 : 44)); });
      var wv = Math.round(lebar * (b.rata || 0) / 5);
      var gr = x.createLinearGradient(left, 0, left + wv, 0); gr.addColorStop(0, '#00B8AD'); gr.addColorStop(1, '#72D48A');
      x.fillStyle = '#EEF3F3'; x.fillRect(left, yy + 14, lebar, 44);
      x.fillStyle = gr; x.fillRect(left, yy + 14, Math.max(wv, 6), 44);
      x.textAlign = 'left'; x.fillStyle = '#1F2D3A'; x.font = 'bold 26px Arial';
      x.fillText(koma(b.rata), left + Math.max(wv, 6) + 12, yy + 46);
    });
    return { data: c.toDataURL('image/png'), w: W, h: Hh };
  }

  /** Contoh sertifikat → PNG (render pdf.js). */
  async function gambarSertifikat(k, namaContoh) {
    var t = await H.api('ambilTemplat', { k: k.id });
    if (!t.ok) return null;
    var bytes = await H.buatSertifikat(H.base64KeBytes(t.pdf), t.halaman, t.posisi, namaContoh || 'Nama Peserta');
    if (!w.pdfjsLib) return null;
    w.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    var doc = await w.pdfjsLib.getDocument({ data: bytes }).promise;
    var pg = await doc.getPage(1);
    var v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 1600 / v1.width });
    var c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    return { data: c.toDataURL('image/jpeg', 0.88), w: c.width, h: c.height };
  }

  /** Halaman PDF → gambar JPEG (±150 dpi). */
  async function halamanPdf(bytes, maks) {
    if (!w.pdfjsLib) return [];
    w.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    var doc = await w.pdfjsLib.getDocument({ data: bytes }).promise, out = [];
    for (var i = 1; i <= Math.min(doc.numPages, maks || 15); i++) {
      var pg = await doc.getPage(i), v1 = pg.getViewport({ scale: 1 });
      var vp = pg.getViewport({ scale: Math.min(1240 / v1.width, 1754 / v1.height) });
      var c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: x, viewport: vp }).promise;
      out.push({ data: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height });
    }
    return out;
  }

  /* =================== BAHAN =================== */
  /** Kumpulkan semua bahan laporan dari server. kemajuan(teks) opsional. */
  async function siapkan(kid, kemajuan) {
    kemajuan = kemajuan || function () { };
    kemajuan('Mengambil data kegiatan…');
    var d = await H.api('dataLaporan', { k: kid });
    if (!d.ok) throw new Error(d.pesan);
    var fotoList = (d.berkas || []).filter(function (b) { return b.jenis === 'foto'; });
    var foto = [];
    for (var i = 0; i < fotoList.length; i++) {
      kemajuan('Mengambil foto ' + (i + 1) + '/' + fotoList.length + '…');
      var f = await H.api('ambilBerkas', { id: fotoList[i].id });
      if (f.ok) foto.push(await infoGambar('data:' + f.mime + ';base64,' + f.data));
    }
    var suratList = (d.berkas || []).filter(function (b) { return b.jenis === 'surat'; }), surat = [];
    for (var si = 0; si < suratList.length; si++) {
      kemajuan('Mengambil surat ' + (si + 1) + '/' + suratList.length + '…');
      var sr = await H.api('ambilBerkas', { id: suratList[si].id });
      if (!sr.ok) continue;
      var hal = [];
      try {
        if (/pdf/.test(sr.mime)) hal = await halamanPdf(H.base64KeBytes(sr.data), 15);
        else hal = [await infoGambar('data:' + sr.mime + ';base64,' + sr.data)];
      } catch (e) { hal = []; }
      surat.push({ jenis: suratList[si].narasumber || 'Surat', nomor: suratList[si].keterangan || '', halaman: hal });
    }
    kemajuan('Menyiapkan gambar…');
    var kop = await infoGambar(await urlKeDataUrl('kop.png'));
    var logo = await infoGambar(await urlKeDataUrl('logo.png'));
    var p = d.pengaturan || {};
    var sampul = await buatSampul(d.kegiatan, logo, p.unit || 'Jurusan Gizi');
    var pengesah = await gabungTtd(d.gambar && d.gambar.ttd, d.gambar && d.gambar.stempel);
    var ring = ringkasEvaluasi(d.evaluasi, d.aspek, d.narasumber);
    var grafik = ring.n ? grafikNilai(ring.aspek, 'Rata-rata Penilaian Peserta per Aspek (skala 1–5)') : null;
    var grafikN = ring.n && ring.narasumber.length ? grafikNilai(ring.narasumber, 'Rata-rata Penilaian Narasumber (skala 1–5)') : null;
    var serti = null;
    if (d.sertifikat && d.sertifikat.adaTemplat && d.sertifikat.mode !== 'tanpa') {
      kemajuan('Menyiapkan contoh sertifikat…');
      try { serti = await gambarSertifikat(d.kegiatan, (d.peserta[0] || {}).nama); } catch (e) { serti = null; }
    }
    var ttdPeserta = {};
    for (var j = 0; j < d.peserta.length; j++) {
      var tt = d.peserta[j].ttd;
      if (tt) { try { ttdPeserta[d.peserta[j].id] = await infoGambar(tt); } catch (e) { } }
    }
    return { d: d, surat: surat, foto: foto, kop: kop, logo: logo, sampul: sampul, pengesah: pengesah, ring: ring, grafik: grafik, grafikN: grafikN, serti: serti, ttdPeserta: ttdPeserta };
  }

  /* =================== MODEL =================== */
  function baris(t) { return String(t || '').replace(/\r/g, '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }

  function model(B) {
    var d = B.d, k = d.kegiatan, L = d.laporan || {}, p = d.pengaturan || {}, ring = B.ring;
    var baku = teksBaku(k);
    var unit = p.unit || 'Jurusan Gizi';
    var peserta = d.peserta || [];
    var nara = d.narasumber || [];
    var blok = [];
    var tglTtd = (p.kota || 'Makassar') + ', ' + H.tglPanjang(k.tanggal);
    var pengesahan = { t: 'pengesahan', tanggal: tglTtd, atas: 'Mengetahui,', jabatan: p.pengesahan_jabatan || 'Ketua Jurusan Gizi', nama: p.pengesahan_nama || '', nip: p.pengesahan_nip || '', gambar: B.pengesah };

    // ---- Sampul ----
    blok.push({ t: 'sampul', img: B.sampul });

    // ---- Lembar pengesahan ----
    blok.push({ t: 'halaman' });
    blok.push({ t: 'judul', text: 'LEMBAR PENGESAHAN' });
    blok.push({ t: 'spasi' });
    blok.push({ t: 'info', rows: [['Nama Kegiatan', k.nama], ['Jenis Kegiatan', k.jenis || '-'], ['Hari/Tanggal', H.tglPanjang(k.tanggal, true)],
      ['Waktu', k.waktu || '-'], ['Tempat', k.tempat || '-'], ['Penyelenggara', k.penyelenggara || unit], ['Jumlah Peserta', peserta.length + ' orang']] });
    blok.push({ t: 'spasi' });
    blok.push({ t: 'p', text: 'Laporan kegiatan ini telah diperiksa dan disahkan sebagai pertanggungjawaban pelaksanaan kegiatan.', indent: false });
    blok.push({ t: 'spasi' });
    blok.push(pengesahan);

    // ---- Kata pengantar ----
    blok.push({ t: 'halaman' });
    blok.push({ t: 'judul', text: 'KATA PENGANTAR' });
    blok.push({ t: 'spasi' });
    [
      'Puji syukur kami panjatkan ke hadirat Tuhan Yang Maha Esa atas rahmat dan karunia-Nya sehingga laporan kegiatan ' + k.nama + ' dapat diselesaikan dengan baik.',
      'Laporan ini disusun sebagai bentuk pertanggungjawaban atas pelaksanaan kegiatan yang diselenggarakan oleh ' + unit + ' Poltekkes Kemenkes Makassar pada ' + H.tglPanjang(k.tanggal, true) + '. Laporan memuat latar belakang, pelaksanaan, hasil kegiatan termasuk evaluasi dari peserta, serta rekomendasi untuk kegiatan selanjutnya.',
      'Kami mengucapkan terima kasih kepada narasumber, panitia, dan seluruh peserta yang telah berpartisipasi sehingga kegiatan ini dapat terlaksana dengan baik. Semoga laporan ini bermanfaat bagi pengembangan kegiatan akademik di lingkungan Poltekkes Kemenkes Makassar.'
    ].forEach(function (t) { blok.push({ t: 'p', text: t }); });
    blok.push({ t: 'spasi' });
    blok.push({ t: 'tandaKanan', lines: [tglTtd, (p.pengesahan_jabatan || 'Ketua Jurusan Gizi') + ','], nama: p.pengesahan_nama || '', nip: p.pengesahan_nip || '' });

    // ---- BAB I ----
    blok.push({ t: 'bab', no: 'I', text: 'PENDAHULUAN' });
    blok.push({ t: 'sub', text: 'A. Latar Belakang' });
    baris(L.latarBelakang || baku.latarBelakang).forEach(function (t) { blok.push({ t: 'p', text: t }); });
    blok.push({ t: 'sub', text: 'B. Dasar Kegiatan' });
    var dasar = H.rapikanPoin(L.dasar || baku.dasar);
    (B.surat || []).forEach(function (s) {
      if (!s.nomor) return;
      var sudah = dasar.some(function (x) { return x.indexOf(s.nomor) >= 0; });
      if (!sudah) dasar.push(s.jenis + ' Nomor ' + s.nomor + '.');
    });
    blok.push({ t: 'ol', items: dasar });
    blok.push({ t: 'sub', text: 'C. Tujuan' });
    blok.push({ t: 'ol', items: H.rapikanPoin(L.tujuan || baku.tujuan) });

    // ---- BAB II ----
    blok.push({ t: 'bab', no: 'II', text: 'PELAKSANAAN KEGIATAN' });
    blok.push({ t: 'sub', text: 'A. Waktu dan Tempat' });
    blok.push({ t: 'p', text: 'Kegiatan dilaksanakan pada:', indent: false });
    blok.push({ t: 'info', rows: [['Hari/Tanggal', H.tglPanjang(k.tanggal, true)], ['Waktu', k.waktu || '-'], ['Tempat', k.tempat || '-']] });
    blok.push({ t: 'sub', text: 'B. Narasumber dan Materi' });
    var materi = L.materi || [];
    if (nara.length) {
      blok.push({ t: 'tabel', head: ['No', 'Narasumber', 'Materi'], widths: [8, 46, 46],
        rows: nara.map(function (n, i) { var m = materi.filter(function (x) { return x.narasumber === n; })[0] || {}; return [String(i + 1), n, m.judul || '-']; }) });
    } else blok.push({ t: 'p', text: 'Kegiatan dipandu oleh panitia ' + unit + '.', indent: false });
    blok.push({ t: 'sub', text: 'C. Peserta' });
    var per = {};
    peserta.forEach(function (x) { var kunci = x.kategori === 'Mahasiswa' ? x.prodi : x.kategori; per[kunci] = (per[kunci] || 0) + 1; });
    var kunciPer = Object.keys(per);
    blok.push({ t: 'p', text: 'Kegiatan diikuti oleh ' + peserta.length + ' peserta yang tercatat melalui daftar hadir elektronik bertanda tangan, dengan rincian sebagai berikut:', indent: false });
    blok.push({ t: 'tabel', head: ['No', 'Kategori Peserta', 'Jumlah', '%'], widths: [8, 56, 18, 18], tengah: [0, 2, 3],
      rows: kunciPer.map(function (x, i) { return [String(i + 1), x, String(per[x]), koma(per[x] * 100 / (peserta.length || 1), 1)]; })
        .concat([['', 'Jumlah', String(peserta.length), '100']]), tebalAkhir: true });
    if (d.sertifikat && d.sertifikat.mode !== 'tanpa') {
      blok.push({ t: 'p', text: 'Setiap peserta yang mengisi daftar hadir memperoleh sertifikat elektronik yang diterbitkan melalui SRIKANDI' + (d.sertifikat.mode === 'langsung' ? ' dan dapat diunduh langsung setelah mengisi daftar hadir.' : ' dan dikirimkan setelah kegiatan.') });
    }

    // ---- BAB III ----
    blok.push({ t: 'bab', no: 'III', text: 'HASIL KEGIATAN' });
    var nSub = 0;
    blok.push({ t: 'sub', text: HURUF[nSub++] + '. Pokok-Pokok Materi' });
    var adaMateri = false;
    nara.forEach(function (n, i) {
      var m = materi.filter(function (x) { return x.narasumber === n; })[0] || {};
      var poin = H.rapikanPoin(m.poin);
      if (!poin.length) return;
      adaMateri = true;
      blok.push({ t: 'subsub', text: (i + 1) + '. ' + n + (m.judul ? ' — ' + m.judul : '') });
      blok.push({ t: 'ul', items: poin });
    });
    materi.filter(function (m) { return nara.indexOf(m.narasumber) < 0 && H.rapikanPoin(m.poin).length; }).forEach(function (m) {
      adaMateri = true;
      blok.push({ t: 'subsub', text: (m.narasumber || 'Materi') + (m.judul ? ' — ' + m.judul : '') });
      blok.push({ t: 'ul', items: H.rapikanPoin(m.poin) });
    });
    if (!adaMateri) blok.push({ t: 'p', text: 'Materi disampaikan oleh narasumber sesuai dengan tema kegiatan. Bahan paparan narasumber terlampir.' });

    var diskusi = (L.diskusi || []).filter(function (q) { return String(q.pertanyaan || '').trim(); });
    if (diskusi.length) {
      blok.push({ t: 'sub', text: HURUF[nSub++] + '. Diskusi dan Tanya Jawab' });
      blok.push({ t: 'p', text: 'Sesi diskusi berlangsung interaktif dengan ' + diskusi.length + ' pertanyaan dari peserta, yaitu:', indent: false });
      diskusi.forEach(function (q, i) {
        blok.push({ t: 'qa', no: i + 1, penanya: String(q.penanya || '').trim() || 'Peserta', pertanyaan: H.rapikanKalimat(q.pertanyaan),
          penjawab: String(q.penjawab || '').trim(), jawaban: H.rapikanPoin(q.jawaban) });
      });
    }

    blok.push({ t: 'sub', text: HURUF[nSub++] + '. Evaluasi Kepuasan Peserta' });
    if (ring.n) {
      blok.push({ t: 'p', text: 'Evaluasi diisi oleh ' + ring.n + ' peserta melalui formulir daftar hadir menggunakan skala 1 (sangat kurang) sampai 5 (sangat baik). Rata-rata keseluruhan sebesar ' + koma(ring.indeks) + ' dengan kategori ' + ring.kategori + '.' });
      blok.push({ t: 'tabel', head: ['No', 'Aspek yang Dinilai', 'Rata-rata', 'Kategori'], widths: [8, 52, 18, 22], tengah: [0, 2, 3],
        rows: ring.aspek.map(function (a, i) { return [String(i + 1), a.label, koma(a.rata), a.kategori]; }).concat([['', 'Rata-rata keseluruhan', koma(ring.indeks), ring.kategori]]), tebalAkhir: true });
      if (B.grafik) blok.push({ t: 'img', img: B.grafik, wmm: 150, caption: 'Grafik 1. Rata-rata penilaian peserta per aspek' });
      if (ring.narasumber.length) {
        blok.push({ t: 'p', text: 'Penilaian peserta terhadap narasumber adalah sebagai berikut:', indent: false });
        blok.push({ t: 'tabel', head: ['No', 'Narasumber', 'Rata-rata', 'Kategori'], widths: [8, 52, 18, 22], tengah: [0, 2, 3],
          rows: ring.narasumber.map(function (a, i) { return [String(i + 1), a.label, koma(a.rata), a.kategori]; }) });
      }
      if (ring.saran.length) {
        blok.push({ t: 'p', text: 'Saran dan masukan dari peserta:', indent: false });
        blok.push({ t: 'ul', items: ring.saran.slice(0, 20).map(H.rapikanKalimat) });
        if (ring.saran.length > 20) blok.push({ t: 'p', text: '(dan ' + (ring.saran.length - 20) + ' saran lainnya)', indent: false, kecil: true });
      }
    } else {
      blok.push({ t: 'p', text: 'Evaluasi kepuasan peserta tidak dilaksanakan pada kegiatan ini.' });
    }

    var rtl = (L.rtl || []).filter(function (r) { return String(r.uraian || '').trim(); });
    if (rtl.length) {
      blok.push({ t: 'sub', text: HURUF[nSub++] + '. Rencana Tindak Lanjut' });
      blok.push({ t: 'tabel', head: ['No', 'Rencana Tindak Lanjut', 'Penanggung Jawab', 'Tenggat'], widths: [8, 50, 22, 20], tengah: [0, 3],
        rows: rtl.map(function (r, i) { return [String(i + 1), H.rapikanKalimat(r.uraian), r.pj || '-', r.tenggat ? H.tglPanjang(r.tenggat) : '-']; }) });
    }

    // ---- BAB IV ----
    blok.push({ t: 'bab', no: 'IV', text: 'PENUTUP' });
    blok.push({ t: 'sub', text: 'A. Kesimpulan' });
    blok.push({ t: 'ol', items: H.rapikanPoin(L.kesimpulan || drafKesimpulan(k, peserta.length, ring)) });
    blok.push({ t: 'sub', text: 'B. Kendala' });
    blok.push({ t: 'ol', items: H.rapikanPoin(L.kendala || 'Kegiatan berjalan lancar tanpa kendala yang berarti.') });
    blok.push({ t: 'sub', text: 'C. Rekomendasi' });
    blok.push({ t: 'ol', items: H.rapikanPoin(L.rekomendasi || drafRekomendasi(ring)) });
    blok.push({ t: 'spasi' });
    blok.push({ t: 'p', text: 'Demikian laporan ini disusun sebagai bahan pertanggungjawaban dan evaluasi pelaksanaan kegiatan. Atas perhatian dan kerja sama semua pihak, kami ucapkan terima kasih.' });
    blok.push({ t: 'spasi' });
    blok.push(pengesahan);

    // ---- Lampiran ----
    var noLamp = 1;
    var adaSurat = (B.surat || []).filter(function (s) { return s.halaman.length; });
    if (adaSurat.length) {
      var noSurat = noLamp++;
      adaSurat.forEach(function (s, si) {
        s.halaman.forEach(function (g, gi) {
          blok.push({ t: 'halaman' });
          if (si === 0 && gi === 0) blok.push({ t: 'judul', text: 'LAMPIRAN ' + noSurat + '. SURAT KEGIATAN' });
          if (gi === 0) blok.push({ t: 'judulKecil', text: HURUF[si].toLowerCase() + '. ' + s.jenis + (s.nomor ? ' Nomor ' + s.nomor : '') });
          blok.push({ t: 'img', img: g, wmm: 150, hmm: si === 0 && gi === 0 ? 200 : 215, bingkai: true });
        });
      });
    }
    blok.push({ t: 'halaman' });
    blok.push({ t: 'kop', img: B.kop });
    blok.push({ t: 'judul', text: 'LAMPIRAN ' + (noLamp++) + '. DAFTAR HADIR' });
    blok.push({ t: 'judulKecil', text: k.nama });
    blok.push({ t: 'info', rows: [['Hari/Tanggal', H.tglPanjang(k.tanggal, true)], ['Waktu', k.waktu || '-'], ['Tempat', k.tempat || '-']] });
    blok.push({ t: 'daftarHadir', peserta: peserta, ttd: B.ttdPeserta });
    blok.push({ t: 'p', text: 'Jumlah peserta hadir: ' + peserta.length + ' orang', indent: false, kecil: true });
    blok.push(pengesahan);

    if (B.foto.length) {
      var per2 = Number((L.foto || {}).tataLetak) === 4 ? 4 : 3;
      var ket = String((L.foto || {}).keterangan || '').trim() || ('Dokumentasi ' + k.nama + ', ' + H.tglPanjang(k.tanggal));
      var nomorFoto = noLamp++;
      for (var i = 0; i < B.foto.length; i += per2) {
        blok.push({ t: 'halaman' });
        if (i === 0) blok.push({ t: 'judul', text: 'LAMPIRAN ' + nomorFoto + '. DOKUMENTASI KEGIATAN' });
        blok.push({ t: 'foto', items: B.foto.slice(i, i + per2), perHalaman: per2, keterangan: ket });
      }
    }

    var berkasMateri = (d.berkas || []).filter(function (b) { return b.jenis === 'materi'; });
    if (berkasMateri.length) {
      blok.push({ t: 'halaman' });
      blok.push({ t: 'judul', text: 'LAMPIRAN ' + (noLamp++) + '. MATERI NARASUMBER' });
      var link = (H.CFG.URL_APLIKASI || '') + 'materi.html?k=' + encodeURIComponent(k.id);
      blok.push({ t: 'tabel', head: ['No', 'Judul File', 'Narasumber', 'Ukuran'], widths: [8, 50, 28, 14], tengah: [0, 3],
        rows: berkasMateri.map(function (b, i) { return [String(i + 1), b.nama, b.narasumber || '-', H.ukuranFile(b.ukuran)]; }) });
      blok.push({ t: 'p', text: 'Seluruh materi dapat diunduh melalui tautan berikut atau dengan memindai kode QR:', indent: false });
      blok.push({ t: 'p', text: link, indent: false, kecil: true, tautan: link });
      blok.push({ t: 'img', img: { data: H.qrDataUrl(link, 10), w: 400, h: 400 }, wmm: 35 });
    }

    if (B.serti) {
      blok.push({ t: 'halaman' });
      blok.push({ t: 'judul', text: 'LAMPIRAN ' + (noLamp++) + '. CONTOH SERTIFIKAT' });
      blok.push({ t: 'img', img: B.serti, wmm: 155 });
    }
    return blok;
  }

  /* =================== RENDER: WORD (.docx) =================== */
  function dataUrlKeBytes(u) { return H.base64KeBytes(String(u).replace(/^data:[^;]+;base64,/, '')); }
  function tipeGambar(u) { return /^data:image\/jpe?g/.test(u) ? 'jpg' : 'png'; }

  async function keDocx(blok, judulDok) {
    var D = w.docx;
    var mmTw = function (v) { return Math.round(v * 56.6929); };
    var mmPx = function (v) { return Math.round(v * 96 / 25.4); };
    var CWmm = 210 - 40 - 30;   // lebar isi: kiri 4 cm, kanan 3 cm
    var CW = mmTw(CWmm);
    var J = D.AlignmentType.JUSTIFIED, C = D.AlignmentType.CENTER, R = D.AlignmentType.RIGHT;
    var run = function (t, o) { return new D.TextRun(Object.assign({ text: String(t == null ? '' : t), font: FONT }, o || {})); };
    var para = function (children, o) {
      if (typeof children === 'string') children = [run(children)];
      o = Object.assign({ spacing: { line: 360, after: 120 } }, o || {});
      o.spacing = Object.assign({}, o.spacing);
      if (o.spacing.line && !o.spacing.lineRule) o.spacing.lineRule = D.LineRuleType.AUTO;   // tanpa ini gambar terpotong di LibreOffice/WPS
      return new D.Paragraph(Object.assign({ children: children }, o));
    };
    var LN = { style: D.BorderStyle.SINGLE, size: 4, color: '7A8A8F' };
    var BORDER = { top: LN, bottom: LN, left: LN, right: LN, insideHorizontal: LN, insideVertical: LN };
    var NB = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    var NOBORDER = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
    var cell = function (children, wTw, o) {
      if (!Array.isArray(children)) children = [children];
      children = children.map(function (c) { return typeof c === 'string' ? para([run(c, { size: 22 })], { spacing: { after: 0, line: 264 } }) : c; });
      return new D.TableCell(Object.assign({ children: children, width: { size: wTw, type: D.WidthType.DXA }, margins: { top: 50, bottom: 50, left: 90, right: 90 }, verticalAlign: D.VerticalAlign.CENTER }, o || {}));
    };
    var tabel = function (widths, rows, borders) {
      return new D.Table({ width: { size: widths.reduce(function (a, b) { return a + b; }, 0), type: D.WidthType.DXA }, columnWidths: widths, borders: borders || BORDER, rows: rows });
    };
    var gambar = function (img, wmm, hmm) {
      return new D.ImageRun({ type: tipeGambar(img.data), data: dataUrlKeBytes(img.data), transformation: { width: mmPx(wmm), height: mmPx(hmm) } });
    };
    var ukurPas = function (img, maksW, maksH) {
      var r = img.h / img.w, wv = maksW, hv = wv * r;
      if (hv > maksH) { hv = maksH; wv = hv / r; }
      return [wv, hv];
    };
    function blokTtd(b) {
      var kol = [];
      if (b.tanggal) kol.push(para(b.tanggal, { alignment: C, spacing: { after: 0, line: 300 } }));
      if (b.atas) kol.push(para(b.atas, { alignment: C, spacing: { after: 0, line: 300 } }));
      kol.push(para(b.jabatan + ',', { alignment: C, spacing: { after: 0, line: 300 } }));
      if (b.gambar) kol.push(para([gambar(b.gambar, 56, 24)], { alignment: C, spacing: { after: 0, line: 240 } }));
      else for (var i = 0; i < 4; i++) kol.push(para('', { spacing: { after: 0, line: 240 } }));
      kol.push(para([run(b.nama, { bold: true, underline: {} })], { alignment: C, spacing: { after: 0, line: 300 } }));
      if (b.nip) kol.push(para('NIP. ' + b.nip, { alignment: C, spacing: { after: 0, line: 300 } }));
      var half = Math.round(CW / 2);
      return tabel([CW - half, half], [new D.TableRow({ cantSplit: true, children: [cell(para(''), CW - half), cell(kol, half, { verticalAlign: D.VerticalAlign.TOP })] })], NOBORDER);
    }
    function daftarItem(items, angka, kiri) {
      return items.map(function (t, i) {
        return para([run((angka ? (i + 1) + '.' : '•') + '\t' + t)], {
          alignment: J, indent: { left: mmTw(kiri || 8), hanging: mmTw(6) }, tabStops: [{ type: D.TabStopType.LEFT, position: mmTw(kiri || 8) }], spacing: { line: 360, after: 40 }
        });
      });
    }

    var sampul = [], isi = [];
    var babPertama = true;
    blok.forEach(function (b) {
      switch (b.t) {
        case 'sampul':
          sampul.push(para([new D.ImageRun({ type: 'png', data: dataUrlKeBytes(b.img.data), transformation: { width: mmPx(210), height: mmPx(297) },
            floating: { horizontalPosition: { relative: D.HorizontalPositionRelativeFrom.PAGE, offset: 0 }, verticalPosition: { relative: D.VerticalPositionRelativeFrom.PAGE, offset: 0 },
              behindDocument: true, allowOverlap: true, wrap: { type: D.TextWrappingType.NONE } } })], { spacing: { after: 0, line: 240 } }));
          break;
        case 'halaman': if (isi.length) isi.push(para([new D.PageBreak()], { spacing: { after: 0 } })); break;
        case 'judul': isi.push(para([run(b.text, { bold: true, size: 26, color: TEAL })], { alignment: C, spacing: { after: 120, line: 300 } })); break;
        case 'judulKecil': isi.push(para([run(b.text, { bold: true })], { alignment: C, spacing: { after: 160, line: 300 } })); break;
        case 'spasi': isi.push(para('', { spacing: { after: 0, line: 240 } })); break;
        case 'bab':
          isi.push(para([run('BAB ' + b.no, { bold: true, size: 26, color: TEAL }), run(b.text, { bold: true, size: 26, color: TEAL, break: 1 })],
            { alignment: C, pageBreakBefore: true, spacing: { after: 240, line: 300 }, heading: D.HeadingLevel.HEADING_1 }));
          babPertama = false;
          break;
        case 'sub': isi.push(para([run(b.text, { bold: true, color: TEAL })], { spacing: { before: 200, after: 80, line: 300 }, keepNext: true, heading: D.HeadingLevel.HEADING_2 })); break;
        case 'subsub': isi.push(para([run(b.text, { bold: true })], { spacing: { before: 120, after: 40, line: 300 }, indent: { left: mmTw(4) }, keepNext: true })); break;
        case 'p':
          isi.push(para(b.tautan ? [new D.ExternalHyperlink({ link: b.tautan, children: [run(b.text, { color: '0563C1', underline: {}, size: b.kecil ? 20 : 24 })] })] : [run(b.text, { size: b.kecil ? 20 : 24 })],
            { alignment: b.indent === false ? D.AlignmentType.LEFT : J, indent: b.indent === false ? undefined : { firstLine: mmTw(12.5) } }));
          break;
        case 'ol': isi = isi.concat(daftarItem(b.items, true)); break;
        case 'ul': isi = isi.concat(daftarItem(b.items, false)); break;
        case 'info': {
          var w1 = mmTw(40), w2 = mmTw(5);
          isi.push(tabel([w1, w2, CW - w1 - w2], b.rows.map(function (r) {
            return new D.TableRow({ children: [cell(para(r[0], { spacing: { after: 0, line: 300 } }), w1, { margins: { top: 10, bottom: 10, left: 0, right: 60 } }),
              cell(para(':', { spacing: { after: 0, line: 300 } }), w2, { margins: { top: 10, bottom: 10, left: 0, right: 0 } }),
              cell(para(String(r[1]), { spacing: { after: 0, line: 300 } }), CW - w1 - w2, { margins: { top: 10, bottom: 10, left: 40, right: 40 } })] });
          }), NOBORDER));
          isi.push(para('', { spacing: { after: 60, line: 200 } }));
          break;
        }
        case 'tabel': {
          var ws = b.widths.map(function (x) { return Math.round(CW * x / 100); });
          var tengah = b.tengah || [0];
          var rows = [new D.TableRow({ tableHeader: true, children: b.head.map(function (h, i) {
            return cell(para([run(h, { bold: true, color: 'FFFFFF', size: 22 })], { alignment: C, spacing: { after: 0, line: 264 } }), ws[i], { shading: { type: D.ShadingType.CLEAR, color: 'auto', fill: TEAL2 } });
          }) })];
          b.rows.forEach(function (r, ri) {
            var akhir = b.tebalAkhir && ri === b.rows.length - 1;
            rows.push(new D.TableRow({ cantSplit: true, children: r.map(function (v, i) {
              return cell(para([run(v, { size: 22, bold: akhir })], { alignment: tengah.indexOf(i) >= 0 ? C : D.AlignmentType.LEFT, spacing: { after: 0, line: 264 } }), ws[i],
                akhir ? { shading: { type: D.ShadingType.CLEAR, color: 'auto', fill: 'E6F7F6' } } : (ri % 2 ? { shading: { type: D.ShadingType.CLEAR, color: 'auto', fill: 'F7FBFB' } } : {}));
            }) }));
          });
          isi.push(tabel(ws, rows));
          isi.push(para('', { spacing: { after: 80, line: 200 } }));
          break;
        }
        case 'img': {
          var u = ukurPas(b.img, Math.min(b.wmm || CWmm, CWmm), b.hmm || 200);
          isi.push(para([gambar(b.img, u[0], u[1])], { alignment: C, spacing: { before: 80, after: b.caption ? 20 : 120, line: 240 } }));
          if (b.caption) isi.push(para([run(b.caption, { italics: true, size: 20 })], { alignment: C, spacing: { after: 160, line: 260 } }));
          break;
        }
        case 'qa':
          isi.push(para([run(b.no + '. Pertanyaan dari ', { bold: true }), run(b.penanya, { bold: true, color: TEAL })], { spacing: { before: 120, after: 20, line: 300 }, keepNext: true, indent: { left: mmTw(4) } }));
          isi.push(para([run(b.pertanyaan, { italics: true })], { alignment: J, indent: { left: mmTw(9) }, spacing: { after: 40, line: 340 }, keepNext: true }));
          if (b.jawaban.length) {
            isi.push(para([run('Tanggapan' + (b.penjawab ? ' ' + b.penjawab : '') + ':', { bold: true, size: 22 })], { indent: { left: mmTw(9) }, spacing: { after: 20, line: 300 }, keepNext: true }));
            isi = isi.concat(daftarItem(b.jawaban, false, 15));
          }
          break;
        case 'pengesahan': isi.push(blokTtd(b)); break;
        case 'tandaKanan':
          isi.push(blokTtd({ tanggal: b.lines[0], jabatan: b.lines[1].replace(/,$/, ''), nama: b.nama, nip: b.nip }));
          break;
        case 'kop': {
          var k1 = ukurPas(b.img, CWmm, 40);
          isi.push(para([gambar(b.img, k1[0], k1[1])], { alignment: C, spacing: { after: 160, line: 240 } }));
          break;
        }
        case 'daftarHadir': {
          var wd = [8, 34, 22, 20, 16].map(function (x) { return Math.round(CW * x / 100); });
          var head = new D.TableRow({ tableHeader: true, children: ['No', 'Nama', 'NIM / NIP / NIK', 'Prodi / Instansi', 'Tanda Tangan'].map(function (h, i) {
            return cell(para([run(h, { bold: true, color: 'FFFFFF', size: 20 })], { alignment: C, spacing: { after: 0, line: 252 } }), wd[i], { shading: { type: D.ShadingType.CLEAR, color: 'auto', fill: TEAL2 } });
          }) });
          var rws = [head];
          b.peserta.forEach(function (x, i) {
            var t = b.ttd[x.id];
            var ket = x.kategori === 'Mahasiswa' ? x.prodi : (x.instansi || x.kategori);
            var ttdP = t ? (function () { var u2 = ukurPas(t, 24, 10); return para([gambar(t, u2[0], u2[1])], { alignment: C, spacing: { after: 0, line: 240 } }); })() : para('');
            rws.push(new D.TableRow({ cantSplit: true, height: { value: mmTw(12), rule: D.HeightRule.ATLEAST }, children: [
              cell(para([run(String(i + 1), { size: 20 })], { alignment: C, spacing: { after: 0 } }), wd[0]),
              cell(para([run(x.nama, { size: 20 })], { spacing: { after: 0, line: 252 } }), wd[1]),
              cell(para([run(x.nim || x.nipNik || '-', { size: 20 })], { spacing: { after: 0, line: 252 } }), wd[2]),
              cell(para([run(ket || '-', { size: 20 })], { spacing: { after: 0, line: 252 } }), wd[3]),
              cell(ttdP, wd[4])] }));
          });
          isi.push(tabel(wd, rws));
          isi.push(para('', { spacing: { after: 60, line: 200 } }));
          break;
        }
        case 'foto': {
          var tinggiHal = 297 - 30 - 30 - (b.items.length && blok.indexOf(b) ? 22 : 10) - 14;
          if (b.perHalaman === 4) {
            var cw2 = Math.round(CW / 2), boxW = CWmm / 2 - 4, boxH = (tinggiHal - 10) / 2;
            var sel = b.items.map(function (f) { var u3 = ukurPas(f, boxW, boxH); return cell(para([gambar(f, u3[0], u3[1])], { alignment: C, spacing: { after: 0, line: 240 } }), cw2); });
            while (sel.length < 4) sel.push(cell(para(''), cw2));
            isi.push(tabel([cw2, cw2], [new D.TableRow({ children: sel.slice(0, 2), height: { value: mmTw(boxH + 4), rule: D.HeightRule.ATLEAST } }),
              new D.TableRow({ children: sel.slice(2, 4), height: { value: mmTw(boxH + 4), rule: D.HeightRule.ATLEAST } })], NOBORDER));
          } else {
            var bh = (tinggiHal - 12) / 3;
            b.items.forEach(function (f) { var u4 = ukurPas(f, CWmm, bh); isi.push(para([gambar(f, u4[0], u4[1])], { alignment: C, spacing: { after: 80, line: 240 } })); });
          }
          isi.push(para([run(b.keterangan, { italics: true, size: 20 })], { alignment: C, spacing: { before: 60, after: 0, line: 260 } }));
          break;
        }
      }
    });

    var footer = new D.Footer({ children: [new D.Paragraph({ alignment: C, children: [new D.TextRun({ children: [D.PageNumber.CURRENT], font: FONT, size: 20, color: '6B7C80' })] })] });
    var doc = new D.Document({
      creator: 'Daftar Hadir Kegiatan · Jurusan Gizi Poltekkes Kemenkes Makassar', title: judulDok,
      styles: {
        default: { document: { run: { font: FONT, size: 24 }, paragraph: { spacing: { line: 360 } } } },
        paragraphStyles: [
          { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true, color: TEAL } },
          { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, color: TEAL } }
        ]
      },
      sections: [
        { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0 } } }, children: sampul },
        { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: mmTw(30), bottom: mmTw(30), left: mmTw(40), right: mmTw(30), header: mmTw(12), footer: mmTw(15) } } },
          footers: { default: footer }, children: isi }
      ]
    });
    return D.Packer.toBlob(doc);
  }

  /* =================== RENDER: HTML (cetak / PDF) =================== */
  function keHtml(blok, judulDok) {
    var e = H.esc, out = [];
    var ttdHtml = function (b) {
      return '<div class="ttd"><div>' + (b.tanggal ? e(b.tanggal) + '<br>' : '') + (b.atas ? e(b.atas) + '<br>' : '') + e(b.jabatan) + ',' +
        (b.gambar ? '<img class="ttd-img" src="' + b.gambar.data + '" alt="">' : '<div class="ttd-ruang"></div>') +
        '<b><u>' + e(b.nama) + '</u></b>' + (b.nip ? '<br>NIP. ' + e(b.nip) : '') + '</div></div>';
    };
    var halamanTerbuka = false;
    function buka(kelas) { if (halamanTerbuka) out.push('</section>'); out.push('<section class="hal ' + (kelas || '') + '">'); halamanTerbuka = true; }
    blok.forEach(function (b) {
      switch (b.t) {
        case 'sampul': out.push('<section class="hal sampul"><img src="' + b.img.data + '" alt="Sampul"></section>'); break;
        case 'halaman': buka(); break;
        case 'judul': out.push('<h2 class="judul">' + e(b.text) + '</h2>'); break;
        case 'judulKecil': out.push('<p class="judul-kecil">' + e(b.text) + '</p>'); break;
        case 'spasi': out.push('<div class="spasi"></div>'); break;
        case 'bab': buka(); out.push('<h1 class="bab">BAB ' + b.no + '<br>' + e(b.text) + '</h1>'); break;
        case 'sub': out.push('<h3 class="sub">' + e(b.text) + '</h3>'); break;
        case 'subsub': out.push('<h4 class="subsub">' + e(b.text) + '</h4>'); break;
        case 'p': out.push('<p class="' + (b.indent === false ? 'kiri' : 'ind') + (b.kecil ? ' kecil' : '') + '">' + (b.tautan ? '<a href="' + e(b.tautan) + '">' + e(b.text) + '</a>' : e(b.text)) + '</p>'); break;
        case 'ol': out.push('<ol>' + b.items.map(function (x) { return '<li>' + e(x) + '</li>'; }).join('') + '</ol>'); break;
        case 'ul': out.push('<ul>' + b.items.map(function (x) { return '<li>' + e(x) + '</li>'; }).join('') + '</ul>'); break;
        case 'info': out.push('<table class="info">' + b.rows.map(function (r) { return '<tr><td>' + e(r[0]) + '</td><td>:</td><td>' + e(r[1]) + '</td></tr>'; }).join('') + '</table>'); break;
        case 'tabel':
          out.push('<table class="tbl"><colgroup>' + b.widths.map(function (x) { return '<col style="width:' + x + '%">'; }).join('') + '</colgroup><thead><tr>' +
            b.head.map(function (h) { return '<th>' + e(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
            b.rows.map(function (r, ri) {
              return '<tr' + (b.tebalAkhir && ri === b.rows.length - 1 ? ' class="akhir"' : '') + '>' + r.map(function (v, i) { return '<td' + ((b.tengah || [0]).indexOf(i) >= 0 ? ' class="c"' : '') + '>' + e(v) + '</td>'; }).join('') + '</tr>';
            }).join('') + '</tbody></table>');
          break;
        case 'img': out.push('<figure><img src="' + b.img.data + '" style="max-width:' + (b.wmm || 150) + 'mm;max-height:' + (b.hmm || 200) + 'mm;width:auto' + (b.bingkai ? ';border:1px solid #CBD5E1' : '') + '" alt="">' + (b.caption ? '<figcaption>' + e(b.caption) + '</figcaption>' : '') + '</figure>'); break;
        case 'qa':
          out.push('<div class="qa"><p class="q"><b>' + b.no + '. Pertanyaan dari <span class="teal">' + e(b.penanya) + '</span></b></p><p class="tanya">' + e(b.pertanyaan) + '</p>' +
            (b.jawaban.length ? '<p class="jawab-l">Tanggapan' + (b.penjawab ? ' ' + e(b.penjawab) : '') + ':</p><ul>' + b.jawaban.map(function (x) { return '<li>' + e(x) + '</li>'; }).join('') + '</ul>' : '') + '</div>');
          break;
        case 'pengesahan': out.push(ttdHtml(b)); break;
        case 'tandaKanan': out.push(ttdHtml({ tanggal: b.lines[0], jabatan: b.lines[1].replace(/,$/, ''), nama: b.nama, nip: b.nip })); break;
        case 'kop': out.push('<img class="kop" src="' + b.img.data + '" alt="Kop">'); break;
        case 'daftarHadir':
          out.push('<table class="tbl dh"><thead><tr><th style="width:8%">No</th><th>Nama</th><th style="width:22%">NIM / NIP / NIK</th><th style="width:20%">Prodi / Instansi</th><th style="width:17%">Tanda Tangan</th></tr></thead><tbody>' +
            b.peserta.map(function (x, i) {
              var t = b.ttd[x.id];
              return '<tr><td class="c">' + (i + 1) + '</td><td>' + e(x.nama) + '</td><td>' + e(x.nim || x.nipNik || '-') + '</td><td>' + e(x.kategori === 'Mahasiswa' ? x.prodi : (x.instansi || x.kategori)) + '</td><td class="c">' + (t ? '<img src="' + t.data + '" alt="">' : '') + '</td></tr>';
            }).join('') + '</tbody></table>');
          break;
        case 'foto':
          out.push('<div class="foto f' + b.perHalaman + '">' + b.items.map(function (f) { return '<div><img src="' + f.data + '" alt=""></div>'; }).join('') + '</div><p class="ket-foto">' + e(b.keterangan) + '</p>');
          break;
      }
    });
    if (halamanTerbuka) out.push('</section>');
    return '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>' + e(judulDok) + '</title><style>' + CSS_CETAK + '</style></head><body>' + out.join('') + '</body></html>';
  }

  var CSS_CETAK = [
    '@page { size: A4; margin: 30mm 30mm 30mm 40mm; }',
    '@page sampul { margin: 0; }',
    '* { box-sizing: border-box; }',
    'body { margin: 0; font-family: Cambria, "Cambria Math", Georgia, "Times New Roman", serif; font-size: 12pt; line-height: 1.5; color: #111; }',
    '.hal { page-break-before: always; break-before: page; }',
    '.hal:first-child { page-break-before: auto; break-before: auto; }',
    '.sampul { page: sampul; width: 210mm; height: 297mm; overflow: hidden; }',
    '.sampul img { width: 210mm; height: 297mm; display: block; }',
    'h1.bab { text-align: center; color: #007F7F; font-size: 13pt; margin: 0 0 16pt; line-height: 1.35; }',
    'h2.judul { text-align: center; color: #007F7F; font-size: 13pt; margin: 0 0 6pt; }',
    '.judul-kecil { text-align: center; font-weight: bold; margin: 0 0 10pt; }',
    'h3.sub { color: #007F7F; font-size: 12pt; margin: 12pt 0 4pt; page-break-after: avoid; }',
    'h4.subsub { font-size: 12pt; margin: 8pt 0 2pt 4mm; page-break-after: avoid; }',
    'p { margin: 0 0 6pt; text-align: justify; } p.ind { text-indent: 12.5mm; } p.kiri { text-align: left; } p.kecil { font-size: 10pt; }',
    'ol, ul { margin: 2pt 0 8pt; padding-left: 8mm; } li { margin-bottom: 2pt; text-align: justify; }',
    '.spasi { height: 10pt; }',
    'table.info { border-collapse: collapse; margin: 2pt 0 8pt; } table.info td { padding: 1pt 4pt 1pt 0; vertical-align: top; } table.info td:first-child { width: 40mm; }',
    'table.tbl { width: 100%; border-collapse: collapse; margin: 4pt 0 10pt; font-size: 11pt; line-height: 1.3; }',
    'table.tbl th { background: #00B8AD; color: #fff; padding: 4pt 5pt; border: 1px solid #7A8A8F; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    'table.tbl td { border: 1px solid #7A8A8F; padding: 3pt 5pt; vertical-align: middle; } table.tbl td.c { text-align: center; }',
    'table.tbl tbody tr:nth-child(even) td { background: #F7FBFB; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    'table.tbl tr.akhir td { background: #E6F7F6; font-weight: bold; }',
    'table.tbl tr { page-break-inside: avoid; } table.tbl thead { display: table-header-group; }',
    'table.dh { font-size: 10pt; } table.dh td { height: 12mm; } table.dh img { max-height: 10mm; max-width: 24mm; }',
    'figure { margin: 6pt 0 10pt; text-align: center; page-break-inside: avoid; } figure img { width: 100%; height: auto; } figcaption { font-style: italic; font-size: 10pt; }',
    '.qa { margin: 0 0 6pt 4mm; page-break-inside: avoid; } .qa .q { margin: 6pt 0 1pt; text-align: left; } .qa .tanya { font-style: italic; margin-left: 5mm; } .qa .jawab-l { font-weight: bold; font-size: 11pt; margin: 2pt 0 0 5mm; } .qa ul { padding-left: 11mm; } .teal { color: #007F7F; }',
    '.ttd { display: flex; justify-content: flex-end; margin-top: 8pt; page-break-inside: avoid; } .ttd > div { width: 75mm; text-align: center; line-height: 1.4; }',
    '.ttd-img { display: block; width: 56mm; height: 24mm; object-fit: contain; margin: 0 auto; } .ttd-ruang { height: 22mm; }',
    'img.kop { width: 100%; display: block; margin-bottom: 8pt; }',
    '.foto { display: grid; gap: 5mm; } .foto img { width: 100%; height: 100%; object-fit: contain; }',
    '.foto.f3 { grid-template-rows: repeat(3, 70mm); } .foto.f3 > div { height: 70mm; }',
    '.foto.f4 { grid-template-columns: 1fr 1fr; grid-template-rows: repeat(2, 100mm); } .foto.f4 > div { height: 100mm; }',
    '.ket-foto { text-align: center; font-style: italic; font-size: 10pt; margin-top: 4mm; }',
    'a { color: #0563C1; word-break: break-all; }',
    '@media screen { body { background: #E9EEF1; } .hal { background: #fff; width: 210mm; min-height: 297mm; margin: 12px auto; padding: 30mm 30mm 30mm 40mm; box-shadow: 0 4px 18px rgba(0,0,0,.12); } .sampul { padding: 0; } }'
  ].join('\n');

  w.Laporan = {
    ringkasEvaluasi: ringkasEvaluasi, kategoriNilai: kategoriNilai, koma: koma, teksBaku: teksBaku,
    drafKesimpulan: drafKesimpulan, drafRekomendasi: drafRekomendasi,
    siapkan: siapkan, model: model, keDocx: keDocx, keHtml: keHtml
  };
})(window);
