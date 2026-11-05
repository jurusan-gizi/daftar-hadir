/* Pad tanda tangan: jari (HP), stylus, dan mouse. Hasil PNG transparan yang sudah dipangkas & diperkecil. */
(function (w) {
  'use strict';
  function TandaTangan(canvas, opsi) {
    opsi = opsi || {};
    var ctx = canvas.getContext('2d');
    var warna = opsi.warna || '#0d2a6b';
    var gores = [], aktif = null, onUbah = opsi.onUbah || function () { };

    function ukur() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.max(1, w.devicePixelRatio || 1);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gambarUlang();
    }
    function titik(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.pressure && e.pressure !== 0.5 ? e.pressure : 0.55 };
    }
    function tebal(p) { return 1.4 + 2.4 * p.t; }
    function gambarGores(g) {
      ctx.strokeStyle = warna; ctx.fillStyle = warna; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (g.length === 1) { ctx.beginPath(); ctx.arc(g[0].x, g[0].y, tebal(g[0]) / 2, 0, Math.PI * 2); ctx.fill(); return; }
      for (var i = 1; i < g.length; i++) {
        var a = g[i - 1], b = g[i];
        ctx.lineWidth = tebal(b);
        ctx.beginPath();
        if (i > 1) {
          var p = g[i - 2];
          ctx.moveTo((p.x + a.x) / 2, (p.y + a.y) / 2);
          ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
        } else { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
        ctx.stroke();
      }
    }
    function gambarUlang() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      gores.forEach(gambarGores);
    }

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      aktif = [titik(e)]; gores.push(aktif); gambarGores(aktif); onUbah(true);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!aktif) return;
      e.preventDefault();
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      evs.forEach(function (ev) { aktif.push(titik(ev)); });
      gambarUlang();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) {
      canvas.addEventListener(n, function () { aktif = null; });
    });
    w.addEventListener('resize', function () { ukur(); });
    ukur();

    return {
      kosong: function () { return [].concat.apply([], gores).length < 6; },
      hapus: function () { gores = []; gambarUlang(); onUbah(false); },
      ukur: ukur,
      /** PNG data URL: dipangkas ke area coretan, lebar maks 420 px. */
      dataUrl: function () {
        var semua = [].concat.apply([], gores);
        if (!semua.length) return '';
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        semua.forEach(function (p) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
        var pad = 8; minX -= pad; minY -= pad; maxX += pad; maxY += pad;
        var bw = Math.max(20, maxX - minX), bh = Math.max(20, maxY - minY);
        var skala = Math.min(1.6, 420 / bw, 170 / bh);
        var c = document.createElement('canvas');
        c.width = Math.round(bw * skala); c.height = Math.round(bh * skala);
        var x = c.getContext('2d');
        x.setTransform(skala, 0, 0, skala, -minX * skala, -minY * skala);
        var simpanCtx = ctx; ctx = x; gores.forEach(gambarGores); ctx = simpanCtx;
        return c.toDataURL('image/png');
      }
    };
  }
  w.TandaTangan = TandaTangan;
})(window);
