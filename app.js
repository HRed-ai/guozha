/* 过闸 · 第一屏：古地图（绢本山水）
   中国轮廓 → 大运河 → 八闸
   数据：data/china_geo.js（真实国界），无则回退 data/geo.js 手绘轮廓
*/
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const GEO = window.GEO;
  const REAL = !!(window.CHINA_GEO && window.CHINA_GEO.rings && window.CHINA_GEO.rings.length);
  const svg = document.getElementById('map');
  const gLand = document.getElementById('land');
  const gMountain = document.getElementById('mountain');
  const gCanal = document.getElementById('canal');
  const gLocks = document.getElementById('locks');

  // 画心尺寸（按实际渲染区域投影）
  const box0 = svg.getBoundingClientRect();
  const VB = {w: Math.max(360, Math.round(box0.width || 1000)),
              h: Math.max(360, Math.round(box0.height || 1000))};
  svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);
  const PAD = Math.round(Math.min(VB.w, VB.h) * 0.055);

  /* ---------- 题跋：干支纪年按当前日期 ---------- */
  (function colophon() {
    const el = document.getElementById('colophon');
    if (!el) return;
    const GAN = '甲乙丙丁戊己庚辛壬癸';
    const ZHI = '子丑寅卯辰巳午未申酉戌亥';
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const gz = GAN[(y - 4) % 10] + ZHI[(y - 4) % 12];
    const season = m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏'
                 : m >= 9 && m <= 11 ? '秋' : '冬';
    el.innerHTML =
      '<p class="l1">八閘一線　皆在運河</p>' +
      '<p class="l2">歲次' + gz + '　' + season + '月穀旦</p>' +
      '<p class="l3">過閘小築　題</p>';
    requestAnimationFrame(() => setTimeout(() => el.classList.add('show'), 900));
  })();

  /* ---------- 陆地环 ---------- */
  let rings;
  if (REAL) {
    rings = window.CHINA_GEO.rings.map(f => {
      const r = [];
      for (let i = 0; i + 1 < f.length; i += 2) r.push([f[i], f[i + 1]]);
      return r;
    });
  } else {
    rings = [GEO.china].concat(GEO.islands || []);
  }
  // 最大环 = 大陆
  let mainland = rings[0];
  rings.forEach(r => { if (r.length > mainland.length) mainland = r; });

  /* ---------- 投影 ---------- */
  const lon0 = 105;
  function merc(lon, lat) {
    return [(lon - lon0) * Math.PI / 180,
            -Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
  }

  const all = [];
  rings.forEach(r => r.forEach(p => { if (p[1] >= 18) all.push(merc(p[0], p[1])); }));
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const scale = Math.min((VB.w - PAD * 2) / (x1 - x0), (VB.h - PAD * 2) / (y1 - y0));
  const offX = (VB.w - (x1 - x0) * scale) / 2 - x0 * scale;
  const offY = (VB.h - (y1 - y0) * scale) / 2 - y0 * scale;

  function proj(lon, lat) {
    const [x, y] = merc(lon, lat);
    return [x * scale + offX, y * scale + offY];
  }

  function ringPath(r) {
    return r.map((p, i) => {
      const [x, y] = proj(p[0], p[1]);
      return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ') + ' Z';
  }

  /* ---------- 大地：墨晕 + 墨线 ---------- */
  const landPath = rings.map(ringPath).join(' ');

  const bleed = document.createElementNS(NS, 'path');
  bleed.setAttribute('class', 'land-bleed');
  bleed.setAttribute('d', landPath);
  bleed.setAttribute('vector-effect', 'non-scaling-stroke');
  gLand.appendChild(bleed);

  const land = document.createElementNS(NS, 'path');
  land.setAttribute('class', 'land');
  land.setAttribute('fill-rule', 'evenodd');
  land.setAttribute('d', landPath);
  land.setAttribute('vector-effect', 'non-scaling-stroke');
  gLand.appendChild(land);

  /* ---------- 山纹 ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20261215);

  function inRing(lon, lat, r) {
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if ((yi > lat) !== (yj > lat) &&
          lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // 运河走廊，避开
  const canalPts = GEO.canal;
  function nearCanal(lon, lat) {
    for (let i = 0; i < canalPts.length - 1; i++) {
      const [ax, ay] = canalPts[i], [bx, by] = canalPts[i + 1];
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((lon - ax) * dx + (lat - ay) * dy) / (dx * dx + dy * dy || 1)));
      const px = ax + t * dx, py = ay + t * dy;
      if (Math.hypot(lon - px, lat - py) < 1.6) return true;
    }
    return false;
  }

  const bbox = mainland.reduce((a, p) => [
    Math.min(a[0], p[0]), Math.min(a[1], p[1]),
    Math.max(a[2], p[0]), Math.max(a[3], p[1])
  ], [180, 90, -180, -90]);

  let placed = 0, guard = 0;
  const dM = [];
  while (placed < 78 && guard < 4000) {
    guard++;
    const lon = bbox[0] + rnd() * (bbox[2] - bbox[0]);
    const lat = 20 + rnd() * (bbox[3] - 20);
    if (!inRing(lon, lat, mainland)) continue;
    if (nearCanal(lon, lat)) continue;
    const [x, y] = proj(lon, lat);
    if (x < 60 || x > VB.w - 60 || y < 60 || y > VB.h - 60) continue;

    const s = 3.6 + rnd() * 4.2;
    const peaks = 2 + Math.floor(rnd() * 2);
    for (let q = 0; q < peaks; q++) {
      const ox = x + (q - (peaks - 1) / 2) * s * 1.15;
      const oy = y + (q === 0 ? s * 0.12 : -s * 0.06);
      dM.push(
        `M${(ox - s * 0.72).toFixed(1)} ${(oy + s * 0.30).toFixed(1)}` +
        `L${ox.toFixed(1)} ${(oy - s * 0.68).toFixed(1)}` +
        `L${(ox + s * 0.72).toFixed(1)} ${(oy + s * 0.30).toFixed(1)}`
      );
    }
    dM.push(
      `M${(x - s * 0.3).toFixed(1)} ${(y + s * 0.30).toFixed(1)}` +
      `L${(x + s * 0.5).toFixed(1)} ${(y - s * 0.34).toFixed(1)}`
    );
    placed++;
  }
  const mPath = document.createElementNS(NS, 'path');
  mPath.setAttribute('d', dM.join(' '));
  mPath.setAttribute('vector-effect', 'non-scaling-stroke');
  gMountain.appendChild(mPath);

  /* ---------- 运河 ---------- */
  const canalD = canalPts.map((p, i) => {
    const [x, y] = proj(p[0], p[1]);
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
  }).join(' ');

  const ink = document.createElementNS(NS, 'path');
  const line = document.createElementNS(NS, 'path');
  const flow = document.createElementNS(NS, 'path');
  ink.setAttribute('class', 'canal-ink');
  line.setAttribute('class', 'canal-line');
  flow.setAttribute('class', 'canal-flow');
  [ink, line, flow].forEach(p => {
    p.setAttribute('d', canalD);
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    gCanal.appendChild(p);
  });

  /* ---------- 八闸（局部坐标，缩放时反向补偿）---------- */
  const lockNodes = [];
  GEO.locks.forEach((lk, idx) => {
    const [x, y] = proj(lk.lon, lk.lat);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'lock');
    g.setAttribute('transform', `translate(${x} ${y})`);

    const halo = document.createElementNS(NS, 'circle');
    halo.setAttribute('class', 'stamp-halo');
    halo.setAttribute('r', 16);

    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('class', 'dot');
    dot.setAttribute('r', 4.4);

    const sealG = document.createElementNS(NS, 'g');
    sealG.setAttribute('class', 'stamp-g');

    const S = 17;
    const stamp = document.createElementNS(NS, 'rect');
    stamp.setAttribute('class', 'stamp');
    stamp.setAttribute('x', -S / 2);
    stamp.setAttribute('y', -S / 2);
    stamp.setAttribute('width', S);
    stamp.setAttribute('height', S);
    stamp.setAttribute('rx', 1.6);

    const num = document.createElementNS(NS, 'text');
    num.setAttribute('class', 'num');
    num.setAttribute('y', 0.5);
    num.textContent = lk.i;

    sealG.append(stamp, num);

    const hit = document.createElementNS(NS, 'circle');
    hit.setAttribute('r', 21);
    hit.setAttribute('fill', 'rgba(0,0,0,0)');
    hit.setAttribute('pointer-events', 'all');
    hit.setAttribute('class', 'hit');

    g.append(halo, dot, sealG, hit);

    // 竖排站名
    const left = idx % 2 === 0;
    const tx2 = left ? -13 : 13;
    const chars = Array.from(lk.name);
    chars.forEach((ch, i) => {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('class', 'name');
      t.setAttribute('x', tx2);
      t.setAttribute('y', -(chars.length - 1) * 6 + i * 12 + 4);
      t.setAttribute('text-anchor', left ? 'end' : 'start');
      t.textContent = ch;
      g.appendChild(t);
    });

    gLocks.appendChild(g);
    lockNodes.push({g, x, y, num});

    const st = (window.STATIONS || [])[idx];
    if (st) {
      const n = parseInt(st.color.slice(1), 16);
      const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
      const numColor = lum > 0.62 ? '#2B2620' : '#F6EDDC';
      g.style.setProperty('--c', st.color);
      g.style.setProperty('--numc', numColor);
      g.dataset.id = st.id;
      const tint = on => {
        [dot, stamp].forEach(el => {
          if (on) el.style.fill = st.color;
          else el.style.removeProperty('fill');
        });
        if (on) num.style.fill = numColor;
        else num.style.removeProperty('fill');
      };
      g.addEventListener('pointerenter', () => tint(true));
      g.addEventListener('pointerleave', () => tint(false));
    }

    g.addEventListener('click', e => {
      if (dragMoved > 8) return;
      if (window.__placingNode) return;          // 正在放置自定义闸，别开单闸页
      e.stopPropagation();
      if (window.openStation) window.openStation(idx);
    });
  });

  /* ---------- 已读状态 ---------- */
  function paintSeen() {
    lockNodes.forEach((n, i) => {
      const st = (window.STATIONS || [])[i];
      if (!st) return;
      const seen = !!(window.LEDGER && window.LEDGER.hasSeen(st.id));
      n.g.classList.toggle('read', seen);
    });
  }
  paintSeen();
  document.addEventListener('seenchange', paintSeen);

  /* ---------- 南海诸岛插图 ---------- */
  (function inset() {
    const hBox = Math.max(120, Math.round(VB.h * 0.26));
    const wBox = Math.round(hBox * 0.68);
    const box = {x: VB.w - wBox - 30, y: VB.h - hBox - 34, w: wBox, h: hBox};
    const L0 = 105, L1 = 128, B0 = 2, B1 = 24;
    const px = lon => box.x + (lon - L0) / (L1 - L0) * box.w;
    const py = lat => box.y + (B1 - lat) / (B1 - B0) * box.h;

    const paths = [];
    rings.forEach(r => {
      if (!r.every(p => p[0] >= L0 && p[0] <= L1 && p[1] >= B0 && p[1] <= B1)) return;
      paths.push(r.map((p, i) =>
        (i === 0 ? 'M' : 'L') + px(p[0]).toFixed(1) + ' ' + py(p[1]).toFixed(1)
      ).join(' ') + ' Z');
    });
    if (!paths.length) return;

    const g = document.createElementNS(NS, 'g');

    const frame = document.createElementNS(NS, 'rect');
    frame.setAttribute('x', box.x); frame.setAttribute('y', box.y);
    frame.setAttribute('width', box.w); frame.setAttribute('height', box.h);
    frame.setAttribute('class', 'inset-frame');

    const p = document.createElementNS(NS, 'path');
    p.setAttribute('class', 'inset-land');
    p.setAttribute('fill-rule', 'evenodd');
    p.setAttribute('d', paths.join(' '));

    const label = document.createElementNS(NS, 'text');
    label.setAttribute('class', 'inset-label');
    label.setAttribute('x', box.x + box.w / 2);
    label.setAttribute('y', box.y + box.h + 14);
    label.setAttribute('text-anchor', 'middle');
    label.textContent = '南海諸島';

    g.append(frame, p, label);
    gLand.appendChild(g);
  })();

  /* ---------- 世界容器 ---------- */
  const world = document.createElementNS(NS, 'g');
  [gLand, gMountain, gCanal, gLocks].forEach(g => world.appendChild(g));
  svg.appendChild(world);

  let k = 1, tx = 0, ty = 0;
  function apply() {
    world.setAttribute('transform', `translate(${tx} ${ty}) scale(${k})`);
    // 闸标：随缩放适度变大，封顶 1.8 倍
    const f = Math.min(1.8, 0.86 + 0.26 * k);
    const s = f / k;
    lockNodes.forEach(n => {
      n.g.setAttribute('transform', `translate(${n.x} ${n.y}) scale(${s})`);
    });
    svg.classList.toggle('zoomed', k > 1.6);
  }

  /* ---------- 镜头 ---------- */
  const cpts = canalPts.map(p => proj(p[0], p[1]));
  const cxs = cpts.map(p => p[0]), cys = cpts.map(p => p[1]);
  const cx0 = Math.min(...cxs), cx1 = Math.max(...cxs);
  const cy0 = Math.min(...cys), cy1 = Math.max(...cys);
  const bw = Math.max(cx1 - cx0, 40), bh = Math.max(cy1 - cy0, 40);
  const targetK = Math.min(4.2, Math.min(VB.w * 0.58 / bw, VB.h * 0.66 / bh));
  const targetTx = VB.w / 2 - ((cx0 + cx1) / 2) * targetK;
  const targetTy = VB.h / 2 - ((cy0 + cy1) / 2) * targetK;

  function flyTo(k1, tx1, ty1, dur) {
    const k0 = k, ax = tx, ay = ty, t0 = performance.now();
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      const e = ease(t);
      k = k0 + (k1 - k0) * e;
      tx = ax + (tx1 - ax) * e;
      ty = ay + (ty1 - ay) * e;
      apply();
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- 入场 ---------- */
  const len = line.getTotalLength();
  [ink, line].forEach(el => {
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = len;
  });
  flow.style.opacity = 0;
  gLand.style.opacity = 0;
  gMountain.style.opacity = 0;
  gLocks.style.opacity = 0;

  requestAnimationFrame(() => {
    gLand.style.transition = 'opacity 1.4s ease';
    gLand.style.opacity = 1;

    setTimeout(() => {
      gMountain.style.transition = 'opacity 1.6s ease';
      gMountain.style.opacity = 1;
    }, 700);

    setTimeout(() => {
      [ink, line].forEach((el, i) => {
        el.style.transition = `stroke-dashoffset 2.6s cubic-bezier(.4,0,.2,1) ${i * 0.15}s`;
        el.style.strokeDashoffset = 0;
      });
      setTimeout(() => {
        flow.style.transition = 'opacity 1s ease';
        flow.style.strokeDasharray = '1.5 22';
        flow.style.opacity = .8;
        gLocks.style.transition = 'opacity 1s ease';
        gLocks.style.opacity = 1;
        setTimeout(() => flyTo(targetK, targetTx, targetTy, 2200), 500);
      }, 2100);
    }, 500);
  });

  /* ---------- 兜底：点在图符附近也算命中 ---------- */
  svg.addEventListener('click', e => {
    if (dragMoved > 8) return;
    if (window.__placingNode) return;            // 正在放置自定义闸
    if (e.target.closest && e.target.closest('.lock')) return; // 已由闸标处理
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const wx = (pt.x - tx) / k, wy = (pt.y - ty) / k;
    let best = -1, bestD = 22;
    lockNodes.forEach((n, i) => {
      if (n.mine) return;                         // 自己加的闸不参与兜底命中
      if (i >= (window.STATIONS || []).length) return;
      const d = Math.hypot(n.x - wx, n.y - wy);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0 && window.openStation) window.openStation(best);
  });

  /* ---------- 平移 / 缩放 ---------- */
  let dragging = false, px = 0, py = 0, dragMoved = 0;
  svg.addEventListener('pointerdown', e => {
    dragging = true; dragMoved = 0; px = e.clientX; py = e.clientY;
    svg.classList.add('dragging');
  });
  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    const sx = VB.w / svg.clientWidth, sy = VB.h / svg.clientHeight;
    dragMoved += Math.abs(e.clientX - px) + Math.abs(e.clientY - py);
    tx += (e.clientX - px) * sx;
    ty += (e.clientY - py) * sy;
    px = e.clientX; py = e.clientY;
    apply();
  });
  window.addEventListener('pointerup', () => {
    dragging = false; svg.classList.remove('dragging');
  });
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * VB.w;
    const my = (e.clientY - rect.top) / rect.height * VB.h;
    const nk = Math.min(9, Math.max(0.7, k * (e.deltaY < 0 ? 1.12 : 0.89)));
    const r = nk / k;
    tx = mx - (mx - tx) * r;
    ty = my - (my - ty) * r;
    k = nk;
    apply();
  }, {passive: false});

  /* ---------- 对外接口：给「自定义闸」用 ---------- */
  function unproj(x, y) {
    const mx = (x - offX) / scale;
    const my = (y - offY) / scale;
    return [105 + mx * 180 / Math.PI,
            (2 * Math.atan(Math.exp(-my)) - Math.PI / 2) * 180 / Math.PI];
  }

  window.MAP = {
    svg: svg,
    locksGroup: gLocks,
    proj: proj,
    unproj: unproj,
    canal: canalPts,
    zoom: function () { return k; },
    setLockNum: function (i, s) {
      const n = lockNodes[i];
      if (n && n.num) n.num.textContent = s;
    },
    /* 屏幕坐标 → 世界坐标（已含缩放平移） */
    toWorld: function (clientX, clientY) {
      const p = svg.createSVGPoint();
      p.x = clientX; p.y = clientY;
      const m = world.getScreenCTM();
      if (!m) return null;
      const q = p.matrixTransform(m.inverse());
      return [q.x, q.y];
    },
    /* 注册一个随缩放一起缩放的标记 */
    register: function (g, x, y) {
      g.setAttribute('transform', `translate(${x} ${y}) scale(${Math.min(1.8, 0.86 + 0.26 * k) / k})`);
      lockNodes.push({g: g, x: x, y: y, mine: true});
    },
    unregister: function (g) {
      for (let i = lockNodes.length - 1; i >= 0; i--) {
        if (lockNodes[i].g === g) lockNodes.splice(i, 1);
      }
    },
    refresh: apply
  };
})();
