/* Fungsi bersama semua halaman Daftar Hadir Kegiatan */
(function (w) {
  'use strict';
  var CFG = w.HADIR_CONFIG || {};

  var SASARAN = {
    D3: 'D3 Gizi',
    D4: 'D4 Gizi dan Dietetika',
    PROF: 'Profesi Dietisien',
    STAF: 'Dosen/PLP/Tendik',
    CI: 'CI (Clinical Instructor)',
    UMUM: 'Umum'
  };
  var PRODI_MHS = ['D3', 'D4', 'PROF'];
  var JENIS = ['Kuliah Tamu', 'Kuliah Pakar', 'Pembekalan', 'Workshop', 'Seminar', 'Pelatihan', 'Sosialisasi', 'Lainnya'];
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** Panggil Apps Script. Selalu POST text/plain agar tidak kena preflight CORS. */
  async function api(aksi, data, opsi) {
    if (!CFG.API_URL || CFG.API_URL.indexOf('http') !== 0) throw new Error('URL Apps Script belum diisi di js/config.js');
    var body = Object.assign({ aksi: aksi }, data || {});
    var sesi = (w.GiziSSO && (w.GiziSSO.getStaf() || w.GiziSSO.get())) || null;
    if (sesi && !body.token && !(opsi && opsi.tanpaToken)) body.token = sesi.token;
    var r;
    try {
      r = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' });
    } catch (e) {
      throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.');
    }
    var d;
    try { d = await r.json(); } catch (e) { throw new Error('Jawaban server tidak terbaca. Coba lagi sebentar.'); }
    return d;
  }

  function toast(pesan, galat) {
    var t = document.createElement('div');
    t.className = 'toast' + (galat ? ' galat' : '');
    t.textContent = pesan;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, galat ? 5000 : 3000);
  }

  /** Dialog sederhana. isiHtml boleh berisi form; tombol: [{label, kelas, nilai}] → Promise(nilai) */
  function dialog(judul, isiHtml, tombol) {
    return new Promise(function (resolve) {
      var l = document.createElement('div');
      l.className = 'latar-dialog';
      l.innerHTML = '<div class="dialog" role="dialog"><h3>' + esc(judul) + '</h3><div class="isi">' + isiHtml + '</div><div class="tombol"></div></div>';
      var box = l.querySelector('.tombol');
      (tombol || [{ label: 'Tutup', kelas: 'garis', nilai: null }]).forEach(function (b) {
        var el = document.createElement('button');
        el.type = 'button'; el.className = 'tbl ' + (b.kelas || ''); el.textContent = b.label;
        el.onclick = function () {
          if (b.cek && !b.cek(l)) return;
          var v = typeof b.nilai === 'function' ? b.nilai(l) : b.nilai;
          l.remove(); resolve(v);
        };
        box.appendChild(el);
      });
      l.addEventListener('click', function (e) { if (e.target === l) { l.remove(); resolve(null); } });
      document.body.appendChild(l);
      var f = l.querySelector('input,select,textarea'); if (f) f.focus();
    });
  }

  function konfirmasi(judul, pesan, label, bahaya) {
    return dialog(judul, '<p>' + pesan + '</p>', [
      { label: 'Batal', kelas: 'garis', nilai: false },
      { label: label || 'Ya', kelas: bahaya ? 'bahaya' : '', nilai: true }
    ]);
  }

  /* ---------- Tanggal ---------- */
  /** Terima juga format tanggal lain (mis. "Sat Nov 14 2026 00:00:00 GMT+0800") → "2026-11-14T00:00" waktu Makassar. */
  function isoWita(v) {
    var s = String(v || '');
    if (!s || /^\d{4}-\d{2}-\d{2}/.test(s)) return s;
    var d = new Date(s);
    if (isNaN(d)) return s;
    var t = new Date(d.getTime() + 8 * 3600e3);   // WITA = UTC+8
    function d2(n) { return String(n).padStart(2, '0'); }
    return t.getUTCFullYear() + '-' + d2(t.getUTCMonth() + 1) + '-' + d2(t.getUTCDate()) + 'T' + d2(t.getUTCHours()) + ':' + d2(t.getUTCMinutes());
  }
  function tglPanjang(iso, denganHari) {
    iso = isoWita(iso);
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length < 3) return iso;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return (denganHari ? HARI[d.getDay()] + ', ' : '') + Number(p[2]) + ' ' + BULAN[Number(p[1]) - 1] + ' ' + p[0];
  }
  function waktuPanjang(iso) {
    iso = isoWita(iso);
    if (!iso) return '';
    var j = String(iso).split(/[T ]/)[1];
    return tglPanjang(iso) + (j ? ', ' + j.slice(0, 5).replace(':', '.') + ' WITA' : '');
  }
  function jam(iso) {
    iso = isoWita(iso);
    var j = String(iso || '').split(/[T ]/)[1];
    return j ? j.slice(0, 5).replace(':', '.') : '';
  }

  /** "1. A 2. B 3. C" → baris terpisah (HTML aman). */
  function narasumberHtml(t) {
    return String(t || '').split(/\s+(?=\d{1,2}[.)]\s)/).map(esc).join('<br>');
  }

  /** "1. A 2. B" / per baris / titik koma → ['A','B'] (sama dengan server). */
  function daftarNarasumber(t) {
    var s = String(t || '').replace(/\r/g, '').trim();
    if (!s) return [];
    var bagian = /\n/.test(s) ? s.split('\n') : s.split(/\s+(?=\d{1,2}[.)]\s)|;\s*/);
    return bagian.map(function (x) { return x.replace(/^\s*\d{1,2}[.)]\s*/, '').trim(); }).filter(Boolean);
  }

  /** Teks bebas → daftar poin rapi: buang nomor/bullet, spasi ganda, huruf awal kapital, titik di akhir. */
  function rapikanPoin(t) {
    return String(t || '').replace(/\r/g, '').split('\n').map(rapikanKalimat).filter(Boolean);
  }
  function rapikanKalimat(x) {
    x = String(x || '').replace(/^\s*(?:[-•*–·]|\d{1,2}[.)]|[a-zA-Z][.)])\s+/, '').replace(/\s+/g, ' ').trim();
    if (!x) return '';
    x = x.charAt(0).toUpperCase() + x.slice(1);
    if (!/[.!?:;)"”']$/.test(x)) x += '.';
    return x;
  }

  /** ID perangkat acak (untuk pembatasan salah kode). */
  function perangkat() {
    try {
      var v = localStorage.getItem('hadir_perangkat');
      if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('hadir_perangkat', v); }
      return v;
    } catch (e) { return 'tanpa-penyimpanan'; }
  }

  /** Perkecil foto → data URL JPEG. */
  function kecilkanGambar(file, maks, q) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var s = Math.min(1, (maks || 1600) / Math.max(im.width, im.height));
        var c = document.createElement('canvas');
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res({ dataUrl: c.toDataURL('image/jpeg', q || 0.82), w: c.width, h: c.height });
      };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('File ' + file.name + ' bukan gambar yang dapat dibaca.')); };
      im.src = url;
    });
  }

  function fileKeBase64(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).replace(/^data:[^;]*;base64,/, '')); };
      r.onerror = function () { rej(new Error('File tidak dapat dibaca.')); };
      r.readAsDataURL(file);
    });
  }

  function ukuranFile(n) {
    n = Number(n) || 0;
    return n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  }

  /** Kotak bintang 1–5. Mengembalikan elemen; nilai di el.dataset.nilai */
  function bintang(label, onUbah) {
    var el = document.createElement('div');
    el.className = 'bintang-baris';
    el.dataset.nilai = '';
    el.innerHTML = '<span class="bintang-label">' + esc(label) + '</span><span class="bintang" role="radiogroup" aria-label="' + esc(label) + '">' +
      [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" role="radio" aria-label="' + n + ' bintang" data-n="' + n + '">★</button>'; }).join('') +
      '</span><span class="bintang-ket"></span>';
    var KET = ['', 'Sangat kurang', 'Kurang', 'Cukup', 'Baik', 'Sangat baik'];
    el.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () {
        var n = Number(b.dataset.n);
        el.dataset.nilai = n;
        el.querySelectorAll('button').forEach(function (x) { x.classList.toggle('isi', Number(x.dataset.n) <= n); x.setAttribute('aria-checked', Number(x.dataset.n) === n); });
        el.querySelector('.bintang-ket').textContent = KET[n];
        el.classList.remove('kurang');
        if (onUbah) onUbah();
      };
    });
    return el;
  }

  function labelAbsen(s) {
    return { buka: '<span class="lbl buka">Absen dibuka</span>', belum: '<span class="lbl belum">Belum dibuka</span>', tutup: '<span class="lbl tutup">Ditutup</span>' }[s] || '';
  }
  function labelMode(m) {
    return { tanpa: 'Tanpa sertifikat', langsung: 'Sertifikat langsung', setelah: 'Sertifikat setelah kegiatan' }[m] || m;
  }

  /* ---------- Nama di sertifikat ---------- */
  var GELAR_DEPAN = /^(dr|drg|drs|dra|prof|ir|hj|h|ns|apt|bd|ners|st)\.$/i;
  /** Nama otomatis KAPITAL; gelar depan (Dr., Prof., Hj., …) dan gelar belakang (setelah koma) tetap seperti diketik. */
  function namaSertifikat(nama) {
    var s = String(nama || '').replace(/\s+/g, ' ').trim();
    var i = s.indexOf(',');
    var depan = i >= 0 ? s.slice(0, i) : s, belakang = i >= 0 ? s.slice(i + 1).trim() : '';
    depan = depan.split(' ').map(function (t) { return GELAR_DEPAN.test(t) ? t : t.toUpperCase(); }).join(' ');
    return depan + (belakang ? ', ' + belakang : '');
  }

  /* ---------- Sertifikat (pdf-lib) ---------- */
  var POSISI_BAWAAN = { x: 197.3, y: 241.5, ukuran: 14, warna: '#007F7F', rata: 'kiri', lebar: 520, tutup: true, tutupWarna: '#FEFEFE', huruf: 'HelveticaBold' };

  function hexRgb(h) {
    h = String(h || '#000000').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return PDFLib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }

  function base64KeBytes(b64) {
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function bytesKeBase64(bytes) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }

  /** Buang huruf yang tidak bisa ditulis font standar PDF (mis. emoji). */
  function teksAman(font, t) {
    try { font.encodeText(t); return t; } catch (e) { }
    var out = '';
    t.normalize('NFC').split('').forEach(function (ch) {
      try { font.encodeText(ch); out += ch; }
      catch (e) { var b = ch.normalize('NFD').replace(/[̀-ͯ]/g, ''); try { font.encodeText(b); out += b; } catch (e2) { } }
    });
    return out;
  }

  function tulisNama(pg, font, P, nama, opsi) {
    var H = pg.getHeight();
    var ukAsli = Number(P.ukuran) || 14, ukuran = ukAsli, lebar = Number(P.lebar) || 500;
    var teks = teksAman(font, opsi.tanpaKapital ? String(nama || '') : namaSertifikat(nama));
    while (ukuran > 7 && font.widthOfTextAtSize(teks, ukuran) > lebar - 6) ukuran -= 0.5;
    var x0 = P.rata === 'tengah' ? P.x - lebar / 2 : P.x - 2;
    if (P.tutup) {
      pg.drawRectangle({ x: x0, y: H - (P.y + 0.4 * ukAsli), width: lebar, height: 1.6 * ukAsli, color: hexRgb(P.tutupWarna || '#FFFFFF') });
    }
    if (opsi.garisBantu) {
      pg.drawRectangle({ x: x0, y: H - (P.y + 0.4 * ukAsli), width: lebar, height: 1.6 * ukAsli, borderColor: PDFLib.rgb(0.85, 0.28, 0.23), borderWidth: 0.8, borderDashArray: [4, 3] });
    }
    var lebarTeks = font.widthOfTextAtSize(teks, ukuran);
    var x = P.rata === 'tengah' ? P.x - lebarTeks / 2 : P.x;
    pg.drawText(teks, { x: x, y: H - P.y, size: ukuran, font: font, color: hexRgb(P.warna) });
    return teks;
  }

  /**
   * Buat sertifikat: ambil halaman `halaman` dari templat, tutup nama contoh, tulis nama.
   * `nama` boleh berupa array → satu PDF berisi banyak halaman (untuk cetak semua).
   * @param {Uint8Array|ArrayBuffer} pdfBytes  templat PDF dari SRIKANDI
   * @returns {Promise<Uint8Array>}
   */
  async function buatSertifikat(pdfBytes, halaman, posisi, nama, opsi) {
    opsi = opsi || {};
    var P = Object.assign({}, POSISI_BAWAAN, posisi || {});
    var src = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    var idx = Math.min(Math.max(1, Number(halaman) || 1), src.getPageCount()) - 1;
    var out = await PDFLib.PDFDocument.create();
    var font = await out.embedFont(PDFLib.StandardFonts[P.huruf] || PDFLib.StandardFonts.HelveticaBold);
    var daftar = Array.isArray(nama) ? nama : [nama], teks = '';
    for (var i = 0; i < daftar.length; i++) {
      var pg = (await out.copyPages(src, [idx]))[0];
      pg.node.delete(PDFLib.PDFName.of('Annots'));   // buang kotak isian tanda tangan; tampilan TTE tetap ada
      out.addPage(pg);
      teks = tulisNama(pg, font, P, daftar[i], opsi);
      if (opsi.kemajuan) opsi.kemajuan(i + 1, daftar.length);
    }
    out.setTitle(daftar.length === 1 ? 'Sertifikat ' + teks : 'Sertifikat (' + daftar.length + ' peserta)');
    out.setProducer('Daftar Hadir Kegiatan · Jurusan Gizi Poltekkes Kemenkes Makassar');
    return out.save();
  }

  function unduhBytes(bytes, namaFile, tipe) {
    var blob = new Blob([bytes], { type: tipe || 'application/pdf' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = namaFile;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function namaFile(s) {
    return String(s || 'sertifikat').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);
  }

  /* ---------- Link ---------- */
  function linkHadir(id) { return (CFG.URL_APLIKASI || location.href.replace(/[^/]*$/, '')) + 'hadir.html?k=' + encodeURIComponent(id); }
  function linkSertifikat(k, u) { return 'sertifikat.html?k=' + encodeURIComponent(k) + '&p=' + encodeURIComponent(u.p) + '&c=' + encodeURIComponent(u.c); }

  function qrDataUrl(teks, sel) {
    var q = qrcode(0, 'M');
    q.addData(teks); q.make();
    return q.createDataURL(sel || 8, 2);
  }

  // Service worker (PWA)
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    w.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
  }

  w.Hadir = {
    CFG: CFG, SASARAN: SASARAN, PRODI_MHS: PRODI_MHS, JENIS: JENIS, POSISI_BAWAAN: POSISI_BAWAAN,
    $: $, esc: esc, api: api, toast: toast, dialog: dialog, konfirmasi: konfirmasi,
    narasumberHtml: narasumberHtml, daftarNarasumber: daftarNarasumber, rapikanPoin: rapikanPoin, rapikanKalimat: rapikanKalimat,
    perangkat: perangkat, kecilkanGambar: kecilkanGambar, fileKeBase64: fileKeBase64, ukuranFile: ukuranFile, bintang: bintang,
    tglPanjang: tglPanjang, waktuPanjang: waktuPanjang, jam: jam, labelAbsen: labelAbsen, labelMode: labelMode,
    namaSertifikat: namaSertifikat, buatSertifikat: buatSertifikat, base64KeBytes: base64KeBytes, bytesKeBase64: bytesKeBase64,
    unduhBytes: unduhBytes, namaFile: namaFile, linkHadir: linkHadir, linkSertifikat: linkSertifikat, qrDataUrl: qrDataUrl
  };
})(window);
