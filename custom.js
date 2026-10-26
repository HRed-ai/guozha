/* 自定义闸：地图上加节点 + 节点内自由排版
   存储：localStorage['guozha.custom']
   结构：{ v:1, nodes:[{ id, name, lon, lat, color, bg, els:[...] }] }
   els：{ id, type:'text'|'image', x, y, w, size, text, color, align, src, ratio }
         x/y/w 都是画布百分比，size 是“宽度的百分比”
*/
(function () {
  var KEY = 'guozha.custom';
  var V = 1;
  var root = document.getElementById('custom');
  var stage = document.getElementById('map');
  if (!root) return;

  var elCanvas = root.querySelector('.cu-canvas');
  var elName = root.querySelector('.cu-name');
  var elFile = root.querySelector('.cu-file');
  var elJson = root.querySelector('.cu-json');
  var elTools = root.querySelector('.cu-tools');
  var elBack = root.querySelector('.cu-back');
  var elAside = root.querySelector('.cu-checkin');
  var elPrev = root.querySelector('.cu-prev');
  var elNext = root.querySelector('.cu-next');
  var elPoem = root.querySelector('.cu-poem-in');

  /* ---------------- 存储 ---------------- */
  function blank() { return { v: V, nodes: [] }; }

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!d || d.v !== V || !Array.isArray(d.nodes)) return blank();
      return d;
    } catch (_) { return blank(); }
  }

  /* 立即落盘：不能防抖——新建后紧接着要 load() 回来（byId/open/renumber 都依赖它），
     防抖会让它们读到旧数据，节点看着像“没建成” */
  function save(d) {
    try {
      localStorage.setItem(KEY, JSON.stringify(d || load()));
      return true;
    } catch (e) {
      alert('保存失败：浏览器存储已满。图片可以少放几张，或先「匯出」备份。');
      return false;
    }
  }

  function uid(p) {
    return (p || 'n') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  function byId(id) {
    return load().nodes.filter(function (n) { return n.id === id; })[0] || null;
  }

  function upsert(node) {
    var d = load();
    var i = -1;
    d.nodes.forEach(function (n, k) { if (n.id === node.id) i = k; });
    if (i < 0) d.nodes.push(node); else d.nodes[i] = node;
    save(d);
  }

  function drop(id) {
    var d = load();
    d.nodes = d.nodes.filter(function (n) { return n.id !== id; });
    save(d);
  }

  /* ---------------- 地图标记（与八闸同款） ---------------- */
  var NS = 'http://www.w3.org/2000/svg';
  var marks = {};
  var CN_NUM = '〇一二三四五六七八九十';

  function cnIndex(n) {
    if (n <= 10) return CN_NUM[n];
    if (n < 20) return '十' + CN_NUM[n - 10];
    return String(n);
  }

  function paintMarkers() {
    var MAP = window.MAP;
    if (!MAP || !MAP.locksGroup) return;
    // 清掉旧的
    Object.keys(marks).forEach(function (id) {
      var g = marks[id];
      if (g && g.parentNode) g.parentNode.removeChild(g);
      if (g && MAP.unregister) MAP.unregister(g);
      delete marks[id];
    });

    load().nodes.forEach(function (n, idx) {
      if (!MAP.proj) return;
      var xy = MAP.proj(n.lon, n.lat);
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'lock');

      var halo = document.createElementNS(NS, 'circle');
      halo.setAttribute('class', 'stamp-halo');
      halo.setAttribute('r', 16);

      var dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('class', 'dot');
      dot.setAttribute('r', 4.4);

      var sealG = document.createElementNS(NS, 'g');
      sealG.setAttribute('class', 'stamp-g');

      var S = 17;
      var stamp = document.createElementNS(NS, 'rect');
      stamp.setAttribute('class', 'stamp');
      stamp.setAttribute('x', -S / 2);
      stamp.setAttribute('y', -S / 2);
      stamp.setAttribute('width', S);
      stamp.setAttribute('height', S);
      stamp.setAttribute('rx', 1.6);

      var num = document.createElementNS(NS, 'text');
      num.setAttribute('class', 'num');
      num.setAttribute('y', 0.5);
      num.textContent = n.no || cnNum(9 + idx);
      sealG.append(stamp, num);

      var hit = document.createElementNS(NS, 'circle');
      hit.setAttribute('r', 21);
      hit.setAttribute('fill', 'rgba(0,0,0,0)');
      hit.setAttribute('pointer-events', 'all');
      hit.setAttribute('class', 'hit');

      g.append(halo, dot, sealG, hit);

      // 竖排站名（与八闸同一套排布；也交给 app.js 做碰撞避让）
      var left = idx % 2 === 0;
      var tx2 = left ? -13 : 13;
      var chars = Array.from(n.name || '私閘');
      var labelG = document.createElementNS(NS, 'g');
      labelG.setAttribute('class', 'name-g');
      chars.forEach(function (ch, i) {
        var t = document.createElementNS(NS, 'text');
        t.setAttribute('class', 'name');
        t.setAttribute('x', tx2);
        t.setAttribute('y', -(chars.length - 1) * 6 + i * 12 + 4);
        t.setAttribute('text-anchor', left ? 'end' : 'start');
        t.textContent = ch;
        labelG.appendChild(t);
      });
      var leader = document.createElementNS(NS, 'line');
      leader.setAttribute('class', 'name-leader');
      leader.setAttribute('vector-effect', 'non-scaling-stroke');
      leader.setAttribute('x1', left ? -8 : 8);
      leader.setAttribute('x2', left ? -13 : 13);
      leader.setAttribute('y1', 0);
      leader.setAttribute('y2', 4);
      g.append(leader, labelG);

      // 悬停染色：与八闸一致，用这闸自己的颜色
      var col = n.color || '#A6392A';
      var cn = parseInt(col.slice(1), 16);
      var lum = (0.299 * ((cn >> 16) & 255) + 0.587 * ((cn >> 8) & 255) + 0.114 * (cn & 255)) / 255;
      var numColor = lum > 0.62 ? '#2B2620' : '#F6EDDC';
      g.style.setProperty('--c', col);
      g.style.setProperty('--numc', numColor);
      function tint(on) {
        [dot, stamp].forEach(function (el) {
          if (on) el.style.fill = col; else el.style.removeProperty('fill');
        });
        if (on) num.style.fill = numColor; else num.style.removeProperty('fill');
      }
      g.addEventListener('pointerenter', function () { tint(true); });
      g.addEventListener('pointerleave', function () { tint(false); });

      g.addEventListener('click', function (e) {
        if (suppressClick) return;
        e.stopPropagation();
        open(n.id);
      });

      if (window.LEDGER && window.LEDGER.hasSeen(n.id)) g.classList.add('read');

      MAP.locksGroup.appendChild(g);
      MAP.register(g, xy[0], xy[1], {
        labelG: labelG, leader: leader,
        labelN: chars.length, left: left
      });
      marks[n.id] = g;
    });
  }

  /* ---------------- 只在运河线上取点 ---------------- */
  var CNALL = '〇一二三四五六七八九';
  function cnNum(n) {
    if (n < 10) return CNALL[n];
    if (n < 20) return '十' + (n % 10 ? CNALL[n % 10] : '');
    if (n < 100) return CNALL[Math.floor(n / 10)] + '十' + (n % 10 ? CNALL[n % 10] : '');
    return String(n);
  }

  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'gp-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 2000);
  }

  /* 点到运河折线最近的一点；返回 {d, x, y, t}，t 是沿线归一化位置 */
  function nearestOnCanal(wx, wy) {
    var MAP = window.MAP;
    if (!MAP || !MAP.canal || MAP.canal.length < 2) return null;
    var pts = MAP.canal.map(function (p) { return MAP.proj(p[0], p[1]); });
    var best = null;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var vx = b[0] - a[0], vy = b[1] - a[1];
      var L2 = vx * vx + vy * vy;
      var t = L2 ? ((wx - a[0]) * vx + (wy - a[1]) * vy) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      var px = a[0] + vx * t, py = a[1] + vy * t;
      var d = Math.hypot(wx - px, wy - py);
      if (!best || d < best.d) best = { d: d, x: px, y: py, t: (i + t) / (pts.length - 1) };
    }
    return best;
  }

  /* ---------------- 统一编号：八闸 + 我的闸，按运河走向从北到南 ---------------- */
  function renumber() {
    var MAP = window.MAP, ST = window.STATIONS || [], GEO = window.GEO || {};
    if (!MAP || !MAP.canal) return;
    var items = [];
    var i, k;

    // 八闸：位置取 GEO.locks（与 STATIONS 同序）
    var locks = (GEO.locks || []);
    for (i = 0; i < ST.length; i++) {
      var lk = locks[i];
      if (!lk) continue;
      var w = MAP.proj(lk.lon, lk.lat);
      var nb = nearestOnCanal(w[0], w[1]);
      items.push({ kind: 'st', idx: i, t: nb ? nb.t : 0 });
    }
    // 我的闸
    var d = load();
    d.nodes.forEach(function (n) {
      var w2 = MAP.proj(n.lon, n.lat);
      var nb2 = nearestOnCanal(w2[0], w2[1]);
      items.push({ kind: 'cn', id: n.id, t: nb2 ? nb2.t : 0 });
    });

    items.sort(function (a, b) { return a.t - b.t; });
    window.__nodeOrder = items;              // 统一顺序：八闸 + 我的闸

    var total = items.length;
    items.forEach(function (it, order) {
      var no = cnNum(order + 1);
      if (it.kind === 'st') {
        ST[it.idx].i = no;
        if (locks[it.idx]) locks[it.idx].i = no;
        if (MAP.setLockNum) MAP.setLockNum(it.idx, no);
      } else {
        d.nodes.forEach(function (n) { if (n.id === it.id) n.no = no; });
      }
    });
    save(d);
    window.__nodeTotal = total;
    return total;
  }
  var addMode = false;
  var suppressClick = false;
  var blockClickUntil = 0;      // 落点后的一小段时间内，吞掉所有地图点击
  var downPt = null;

  var btnAdd = document.getElementById('mk-add');

  function setAddMode(on) {
    addMode = on;
    window.__placingNode = on;              // app.js 也会看这个旗标
    document.body.classList.toggle('mk-adding', on);
    if (btnAdd) btnAdd.textContent = on ? '點地圖放置…' : '＋ 私閘';
    if (btnAdd) btnAdd.classList.toggle('on', on);
    /* 进入放置模式时，若正好开着某闸，先关掉，免得页面叠在一起 */
    if (on && window.closeStation) {
      try { window.closeStation(); } catch (_) {}
    }
  }

  if (btnAdd) {
    btnAdd.addEventListener('click', function (e) {
      e.stopPropagation();
      setAddMode(!addMode);
    });
  }

  if (stage) {
    /* 加节点模式下（以及刚落点那一下），别让这一下点也触发“打开闸页” */
    stage.addEventListener('click', function (e) {
      if (!addMode && Date.now() > blockClickUntil) return;
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);

    stage.addEventListener('pointerdown', function (e) {
      if (!addMode) return;
      downPt = [e.clientX, e.clientY];
    }, true);

    stage.addEventListener('pointerup', function (e) {
      if (!addMode || !downPt) return;
      var moved = Math.abs(e.clientX - downPt[0]) + Math.abs(e.clientY - downPt[1]);
      downPt = null;
      if (moved > 8) return;                       // 是在拖动地图，不是点位置
      if (!window.MAP || !window.MAP.toWorld) return;
      var w = window.MAP.toWorld(e.clientX, e.clientY);
      if (!w) return;

      /* 只允许落在大运河线上：换算成“屏幕 40px”的容差 */
      var near = nearestOnCanal(w[0], w[1]);
      var tol = 40 / ((window.MAP.zoom && window.MAP.zoom()) || 1);
      if (!near || near.d > tol) {
        toast('請點在大運河的河道上');
        return;
      }
      var ll = window.MAP.unproj(near.x, near.y);

      var d = load();
      var n = {
        id: uid('c'), name: '私閘 ' + (d.nodes.length + 1),
        lon: Math.round(ll[0] * 1000) / 1000,
        lat: Math.round(ll[1] * 1000) / 1000,
        color: '#8C7B62', bg: '', els: makeDefaults()
      };
      d.nodes.push(n);
      save(d);
      setAddMode(false);
      suppressClick = true;
      blockClickUntil = Date.now() + 600;      // 这一下的 click 一律吞掉
      setTimeout(function () { suppressClick = false; }, 600);
      renumber();
      paintMarkers();
      open(n.id);
    }, true);
  }

  /* ---------------- 默认版式：照着一座闸的样子铺好 ---------------- */
  function nearestStationIdx(lon, lat) {
    var locks = (window.GEO && window.GEO.locks) || [];
    var best = -1, bd = Infinity;
    locks.forEach(function (lk, i) {
      var d = (lk.lon - lon) * (lk.lon - lon) + (lk.lat - lat) * (lk.lat - lat);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  /* 新建的闸：版式与八闸相同，但没有内容 —— 四个位置都是空占位 */
  function makeDefaults() {
    return [
      { id: uid('e'), type: 'image', slot: 'scene', src: '', x: 2, y: 4, h: 66,
        hint: '此處可以添加景色圖\n點一下選圖' },
      { id: uid('e'), type: 'text', slot: 'verse', vertical: true, text: '',
        x: 40, y: 6, w: 14, size: 1.8, color: '#2B2620', align: 'right',
        hint: '點此添加文字' },
      { id: uid('e'), type: 'text', slot: 'facts', text: '',
        x: 56, y: 8, w: 18, size: 1.05, color: '#4A3F30', align: 'left',
        hint: '點此添加文字' },
      { id: uid('e'), type: 'image', slot: 'figure', src: '', x: 74, y: 18, h: 52,
        hint: '此處可以添加人物\n點一下選圖' },
      /* 打卡日历：和别的东西一样，能拖能改大小 */
      { id: uid('e'), type: 'calendar', x: 38, y: 58, w: 20 }
    ];
  }
  var cur = null;        // 当前节点（对象副本）
  var selId = null;      // 选中的元素
  var pending = null;    // 'image' | 'bg' | 'slot'
  var pendingEl = null;  // slot 模式下要填的那个元素
  var mode = 'view';     // 'view' 看（与八闸同样显示）| 'edit' 编

  function setMode(m) {
    mode = m;
    root.setAttribute('data-mode', m);
    if (elName) elName.readOnly = (m !== 'edit');
    if (m === 'view') {
      selId = null;
      render();
    }
  }

  function open(id) {
    var n = byId(id);
    if (!n) return;
    cur = JSON.parse(JSON.stringify(n));
    selId = null;
    root.classList.add('show');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cu-open');
    root.style.setProperty('--accent', cur.color || '#A6392A');
    elName.value = cur.name || '';
    var seqn = root.querySelector('.cu-seqn');
    if (seqn) {
      var total = window.__nodeTotal || (8 + load().nodes.length);
      seqn.textContent = '第 ' + (cur.no || '·') + ' 閘 · 共 ' + cnNum(total) + ' 閘';
    }
    /* 进过一次就算“读过”，地图上这颗印就填实 */
    if (window.LEDGER) window.LEDGER.touch(id);
    if (marks[id]) marks[id].classList.add('read');
    if (elAside && window.buildCalendar) elAside.innerHTML = window.buildCalendar(false);
    if (elPoem) elPoem.value = cur.poem || '';
    setMode('view');
    render();
  }

  function close() {
    root.classList.remove('show');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cu-open');
    cur = null;
    selId = null;
    paintMarkers();
  }

  function persist() {
    if (!cur) return;
    cur.name = elName.value.trim() || '私閘';
    upsert(cur);
  }

  function canvasW() { return elCanvas.clientWidth || 600; }

  function elNode(e) {
    var d = document.createElement('div');
    d.className = 'cu-el cu-' + e.type;
    d.dataset.eid = e.id;
    d.style.left = e.x + '%';
    d.style.top = e.y + '%';
    if (e.type === 'text') d.style.width = e.w + '%';
    if (e.type === 'text') {
      d.style.color = e.color || '#2B2620';
      d.style.textAlign = e.align || 'left';
      d.style.fontSize = (e.size || 4.2) / 100 * canvasW() + 'px';
      d.textContent = e.text || '';
      d.style.lineHeight = '1.55';
      if (!e.text) {
        d.classList.add('is-empty');
        d.dataset.hint = e.hint || '點此添加文字';
      }
      if (e.vertical) {
        d.style.writingMode = 'vertical-rl';
        d.style.textOrientation = 'upright';
        d.style.letterSpacing = '.12em';
        d.style.whiteSpace = 'pre';
        d.classList.add('cu-vertical');
      } else {
        d.style.whiteSpace = 'pre-wrap';
      }
    } else if (e.type === 'calendar') {
      /* 日历：按自然尺寸渲染，再用 transform 缩放到 w% 宽 */
      d.classList.add('cu-cal-wrap');
      d.style.width = (e.w || 22) + '%';
      var cal = document.createElement('div');
      cal.className = 'cu-cal st-checkin';
      cal.innerHTML = window.buildCalendar
        ? window.buildCalendar(false)
        : '<div class="ck-title">閘簿</div>';
      d.appendChild(cal);
    } else {
      d.style.height = (e.h || 40) + '%';
      d.style.width = 'auto';
      if (!e.src) {
        /* 空位：虚线框 + 提示，点一下选图 */
        d.classList.add('cu-placeholder');
        var ph = document.createElement('div');
        ph.className = 'cu-ph';
        ph.dataset.slot = e.slot || 'scene';
        ph.textContent = (e.hint || '此處可以添加圖片').replace(/\n/g, ' ');
        d.appendChild(ph);
      } else {
        var img = document.createElement('img');
        img.src = e.src;
        img.alt = '';
        img.draggable = false;
        img.style.height = '100%';
        img.style.width = 'auto';
        img.style.display = 'block';
        d.appendChild(img);
      }
    }
    if (e.id === selId) d.classList.add('sel');
    return d;
  }

  function render() {
    if (!cur) return;
    elCanvas.innerHTML = '';
    elCanvas.appendChild(handle);
    handle.hidden = true;
    elCanvas.style.background = cur.bg
      ? 'center/cover no-repeat url(' + JSON.stringify(cur.bg) + ')'
      : '';
    (cur.els || []).forEach(function (e) {
      elCanvas.appendChild(elNode(e));
    });
    fitCalendars();
    if (!(cur.els || []).length && !cur.bg) {
      var tip = document.createElement('div');
      tip.className = 'cu-tip';
      tip.textContent = '这一页还是空的 · 点上面「＋ 文字」「＋ 圖片」开始';
      elCanvas.appendChild(tip);
    }
    placeHandle();
  }

  /* 日历按自然尺寸排版后，等比缩到元素宽度，并同步元素高度 */
  function fitCalendars() {
    var cw = elCanvas.clientWidth || 1;
    Array.prototype.forEach.call(elCanvas.querySelectorAll('.cu-cal-wrap'), function (wrap) {
      var inner = wrap.querySelector('.cu-cal');
      if (!inner) return;
      var target = wrap.offsetWidth || (parseFloat(wrap.style.width) / 100 * cw);
      var natural = inner.offsetWidth || 268;
      var k = target / natural;
      inner.style.transform = 'scale(' + k + ')';
      wrap.style.height = (inner.offsetHeight || 300) * k + 'px';
    });
  }

  /* 选中框右下角的拉手（单独一个元素，不随内容重建） */
  var handle = document.createElement('i');
  handle.className = 'cu-handle';
  handle.hidden = true;

  function placeHandle() {
    var node = selId && elCanvas.querySelector('[data-eid="' + selId + '"]');
    if (!node) { handle.hidden = true; return; }
    handle.hidden = false;
    /* 略往内收，贴着右下角但不被画布裁掉 */
    handle.style.left = (node.offsetLeft + node.offsetWidth - 2) + 'px';
    handle.style.top = (node.offsetTop + node.offsetHeight - 2) + 'px';
  }

  function select(id) {
    selId = id;
    Array.prototype.forEach.call(elCanvas.children, function (c) {
      if (!c.dataset || !c.dataset.eid) return;
      c.classList.toggle('sel', c.dataset.eid === id);
    });
    placeHandle();
  }

  function findEl(id) {
    return (cur.els || []).filter(function (e) { return e.id === id; })[0] || null;
  }

  /* --- 拖动 / 改宽 --- */
  var drag = null;

  elCanvas.addEventListener('pointerdown', function (e) {
    if (!cur || mode !== 'edit') return;
    var handle = e.target.closest('.cu-handle');
    var box = e.target.closest('.cu-el');
    var rect = elCanvas.getBoundingClientRect();

    /* 手柄不在元素内部，必须用“当前选中”的那个 */
    if (handle) {
      var el = selId ? findEl(selId) : null;
      if (!el) return;
      drag = {
        mode: 'resize', id: el.id, x0: e.clientX, y0: e.clientY,
        w0: el.w, h0: el.h, size0: el.size,
        cw: rect.width, ch: rect.height, type: el.type
      };
      e.preventDefault();
      return;
    }
    if (!box) { select(null); return; }
    var el2 = findEl(box.dataset.eid);
    if (!el2) return;
    select(el2.id);

    /* 空占位：点一下直接放图 / 直接写字，不必先选中 */
    if (box.classList.contains('cu-placeholder') || e.target.closest('.cu-ph')) {
      pending = 'slot';
      pendingEl = el2.id;
      elFile.value = '';
      elFile.click();
      e.preventDefault();
      return;
    }
    if (el2.type === 'text' && !el2.text) {
      startEditText(box);
      e.preventDefault();
      return;
    }

    if (box.classList.contains('editing')) return;      // 正在改字
    drag = {
      mode: 'move', id: el2.id, x0: e.clientX, y0: e.clientY,
      ex: el2.x, ey: el2.y, cw: rect.width, ch: rect.height,
      /* 记下渲染后的实际宽度，作为右侧边界的依据（图片没有 w 字段） */
      wPct: box.offsetWidth / rect.width * 100
    };
    e.preventDefault();
  });

  /* 把一块文字切到可输入状态 */
  function startEditText(box) {
    box.classList.remove('is-empty');
    box.removeAttribute('data-hint');
    box.contentEditable = 'true';
    box.classList.add('editing');
    box.focus();
    try {
      var r = document.createRange();
      r.selectNodeContents(box);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    } catch (_) {}
  }

  window.addEventListener('pointermove', function (e) {
    if (!drag || !cur) return;
    var el = findEl(drag.id);
    if (!el) return;
    if (drag.mode === 'move') {
      var dx = (e.clientX - drag.x0) / drag.cw * 100;
      var dy = (e.clientY - drag.y0) / drag.ch * 100;
      /* 用实际宽度算右边界：图片用 h 定尺寸，没有 w 字段 */
      var wPct = drag.wPct || 10;
      el.x = Math.max(0, Math.min(100 - wPct, drag.ex + dx));
      el.y = Math.min(96, Math.max(0, drag.ey + dy));
      var node = elCanvas.querySelector('[data-eid="' + el.id + '"]');
      if (node) { node.style.left = el.x + '%'; node.style.top = el.y + '%'; }
    } else {
      var node2 = elCanvas.querySelector('[data-eid="' + el.id + '"]');
      if (el.type === 'image') {
        /* 图片按高改：向下拖变高 */
        var dh = (e.clientY - drag.y0) / drag.ch * 100;
        var maxH = 100 - Math.max(0, Math.min(96, el.y));
        el.h = Math.min(maxH, Math.max(8, (drag.h0 || 40) + dh));
        if (node2) {
          node2.style.height = el.h + '%';
          /* 太宽的话再收一点，保证不出画布 */
          var cw2 = elCanvas.clientWidth || 1;
          var over = (node2.offsetLeft + node2.offsetWidth) - cw2;
          if (over > 0 && node2.offsetWidth > 0) {
            el.h = Math.max(8, el.h * (1 - over / node2.offsetWidth));
            node2.style.height = el.h + '%';
          }
        }
      } else {
        /* 文字 / 日历：拖手柄改宽度（文字同时缩放字号） */
        var dw = (e.clientX - drag.x0) / drag.cw * 100;
        var w0 = drag.w0 || 20;
        var maxW = Math.max(4, 100 - Math.max(0, Math.min(96, el.x)));
        var nw = Math.min(maxW, Math.max(4, w0 + dw));
        el.w = nw;
        if (el.type === 'text') {
          var k = w0 > 0 ? nw / w0 : 1;
          el.size = Math.max(0.5, Math.min(18, (drag.size0 || 1.8) * k));
        }
        if (node2) {
          node2.style.width = el.w + '%';
          if (el.type === 'text') node2.style.fontSize = el.size / 100 * drag.cw + 'px';
        }
        if (el.type === 'calendar') fitCalendars();
      }
    }
    placeHandle();
  });

  window.addEventListener('pointerup', function () {
    if (!drag) return;
    drag = null;
    persist();
  });

  /* Ctrl / ⌘ + 滚轮：单独缩放选中元素的字号（图片则是改高） */
  elCanvas.addEventListener('wheel', function (e) {
    if (!cur || mode !== 'edit' || !selId) return;
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    var el = findEl(selId);
    if (!el) return;
    var dir = e.deltaY < 0 ? 1 : -1;
    if (el.type === 'text') {
      el.size = Math.max(0.5, Math.min(18, (el.size || 1.8) * (1 + 0.07 * dir)));
      var node = elCanvas.querySelector('[data-eid="' + el.id + '"]');
      if (node) node.style.fontSize = el.size / 100 * canvasW() + 'px';
    } else {
      el.h = Math.max(5, Math.min(100 - el.y, (el.h || 40) * (1 + 0.06 * dir)));
      var node2 = elCanvas.querySelector('[data-eid="' + el.id + '"]');
      if (node2) node2.style.height = el.h + '%';
    }
    placeHandle();
    persist();
  }, { passive: false });

  /* --- 改字 --- */
  elCanvas.addEventListener('dblclick', function (e) {
    var box = e.target.closest('.cu-el');
    if (!box) return;
    var el = findEl(box.dataset.eid);
    if (!el || el.type !== 'text') return;
    box.contentEditable = 'true';
    box.classList.add('editing');
    box.focus();
    try {
      var r = document.createRange();
      r.selectNodeContents(box);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    } catch (_) {}
  });

  elCanvas.addEventListener('blur', function (e) {
    var box = e.target.closest && e.target.closest('.cu-el');
    if (!box || !box.classList.contains('editing')) return;
    box.contentEditable = 'false';
    box.classList.remove('editing');
    var el = findEl(box.dataset.eid);
    if (el) { el.text = box.innerText.replace(/\n+$/, ''); persist(); }
  }, true);

  /* --- 键盘删除 --- */
  document.addEventListener('keydown', function (e) {
    if (!cur || !root.classList.contains('show')) return;
    if (e.target && e.target.isContentEditable) return;
    if (e.key === 'Escape') { if (selId) select(null); else close(); return; }
    if (!selId) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      cur.els = (cur.els || []).filter(function (x) { return x.id !== selId; });
      selId = null;
      render();
      persist();
    }
  });

  /* --- 工具条 --- */
  function addText() {
    if (!cur) return;
    var e = {
      id: uid('e'), type: 'text',
      x: 30, y: 30, w: 24, size: 1.9,
      text: '在這裡寫字', color: '#2B2620', align: 'left'
    };
    cur.els.push(e);
    render();
    select(e.id);
    persist();
  }

  function addImage(src, ratio) {
    if (!cur) return;
    var e = {
      id: uid('e'), type: 'image',
      x: 24, y: 18, h: 48, src: src, ratio: ratio || 1
    };
    cur.els.push(e);
    render();
    select(e.id);
    persist();
  }

  /* 加一个日历块（可以拖、可以改大小） */
  function addCalendar() {
    if (!cur) return;
    var has = (cur.els || []).some(function (x) { return x.type === 'calendar'; });
    if (has) {
      if (window.RULES) window.RULES.toast('這一頁已經有日曆了');
      return;
    }
    var e = { id: uid('e'), type: 'calendar', x: 38, y: 62, w: 24 };
    cur.els.push(e);
    render();
    select(e.id);
    persist();
  }

  elTools.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]');
    if (!b || !cur) return;
    var act = b.dataset.act;

    if (act === 'edit') { setMode('edit'); return; }
    if (act === 'done') { persist(); setMode('view'); return; }
    if (act === 'text') { addText(); return; }
    if (act === 'calendar') { addCalendar(); return; }
    if (act === 'image') { pending = 'image'; elFile.value = ''; elFile.click(); return; }
    if (act === 'bg') { pending = 'bg'; elFile.value = ''; elFile.click(); return; }
    if (act === 'png') { toPNG(); return; }
    if (act === 'export') { exportJSON(); return; }
    if (act === 'import') { elJson.value = ''; elJson.click(); return; }
    if (act === 'del') {
      if (!confirm('删除这一闸？里面的内容一起删掉。')) return;
      var id = cur.id;
      drop(id);
      cur = null;
      close();
      renumber();
      paintMarkers();
      return;
    }
  });

  elBack.addEventListener('click', close);

  /* 上一闸 / 下一闸：按「八闸 + 我的闸」的统一顺序走 */
  function stepNode(kind, key, dir) {
    var order = window.__nodeOrder || [];
    if (!order.length) return false;
    var pos = -1;
    order.forEach(function (it, k) {
      if (kind === 'st' && it.kind === 'st' && it.idx === key) pos = k;
      if (kind === 'cn' && it.kind === 'cn' && it.id === key) pos = k;
    });
    if (pos < 0) return false;
    var n = (pos + dir + order.length) % order.length;
    var it = order[n];
    if (it.kind === 'st') {
      if (root.classList.contains('show')) close();
      if (window.openStation) window.openStation(it.idx);
    } else {
      if (window.closeStation) window.closeStation();
      open(it.id);
    }
    return true;
  }
  window.stepNode = stepNode;

  if (elPrev) elPrev.addEventListener('click', function () { if (cur) stepNode('cn', cur.id, -1); });
  if (elNext) elNext.addEventListener('click', function () { if (cur) stepNode('cn', cur.id, 1); });

  /* 人物对白：编辑框，随时保存 */
  var poemTimer = null;
  if (elPoem) {
    elPoem.addEventListener('input', function () {
      if (!cur) return;
      cur.poem = elPoem.value;
      clearTimeout(poemTimer);
      poemTimer = setTimeout(persist, 400);
    });
  }

  /* 看的时候点人物：冒出对白 */
  var bubbleEl = null, bubbleTimer = null;
  function showBubble(text) {
    if (!text) return;
    if (!bubbleEl) {
      bubbleEl = document.createElement('div');
      bubbleEl.className = 'cu-bubble';
      elCanvas.appendChild(bubbleEl);
    }
    bubbleEl.textContent = text;
    bubbleEl.classList.add('on');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubbleEl.classList.remove('on'); }, 6000);
  }

  elCanvas.addEventListener('click', function (e) {
    if (mode !== 'view' || !cur || !cur.poem) return;
    var box = e.target.closest('.cu-el');
    if (!box) return;
    var el = findEl(box.dataset.eid);
    if (!el || el.type !== 'image') return;
    showBubble(cur.poem);
  });

  elName.addEventListener('input', function () {
    if (!cur) return;
    cur.name = elName.value;
    clearTimeout(elName._t);
    elName._t = setTimeout(persist, 400);
  });

  /* --- 图片压缩 + 读入 --- */
  function shrink(file, maxSide, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        var r = Math.min(1, maxSide / Math.max(im.width, im.height));
        var c = document.createElement('canvas');
        c.width = Math.round(im.width * r);
        c.height = Math.round(im.height * r);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.82), im.width / im.height);
      };
      im.onerror = function () { alert('这张图读不出来，换一张试试。'); };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  elFile.addEventListener('change', function () {
    var f = elFile.files && elFile.files[0];
    if (!f || !cur) return;
    var isSlot = (pending === 'slot');
    shrink(f, pending === 'bg' ? 1400 : 1100, function (url, ratio) {
      if (pending === 'bg') {
        cur.bg = url;
        render();
        persist();
      } else if (isSlot && pendingEl) {
        var el = findEl(pendingEl);
        if (el) {
          el.src = url;
          el.ratio = ratio;
          render();
          select(el.id);
          persist();
        }
      } else {
        addImage(url, ratio);
      }
      pending = null;
      pendingEl = null;
    });
  });

  /* --- 导出 / 导入 --- */
  function download(name, data, mime) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 400);
  }

  function stamp() {
    var d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  }

  function exportJSON() {
    var d = load();
    download('过闸-我的闸-' + stamp() + '.json', JSON.stringify(d, null, 1));
  }

  elJson.addEventListener('change', function () {
    var f = elJson.files && elJson.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var d = JSON.parse(fr.result);
        if (!d || !Array.isArray(d.nodes)) throw new Error('格式不对');
        var mine = load();
        var added = 0, replaced = 0;
        d.nodes.forEach(function (n) {
          if (!n || !n.id) return;
          var i = -1;
          mine.nodes.forEach(function (x, k) { if (x.id === n.id) i = k; });
          if (i >= 0) { mine.nodes[i] = n; replaced++; } else { mine.nodes.push(n); added++; }
        });
        mine.v = V;
        save(mine);
        renumber();
        paintMarkers();
        alert('已匯入：新增 ' + added + ' 闸，覆盖 ' + replaced + ' 闸。');
      } catch (err) {
        alert('匯入失败：' + err.message);
      }
    };
    fr.readAsText(f);
  });

  /* --- 存为图片 --- */
  function toPNG() {
    if (!cur) return;
    /* 导出尺寸跟随画布当前长宽比 */
    var cw0 = elCanvas.clientWidth || 1200;
    var ch0 = elCanvas.clientHeight || 900;
    var W = 1600;
    var H = Math.max(600, Math.round(W * ch0 / cw0));
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    var list = cur.els || [];

    /* 先把所有图片加载完，再一次性绘制 */
    var pics = list.filter(function (e) { return e.type === 'image'; });
    var loaded = {};
    var imgOk = {};
    var skipped = 0;
    var left = pics.length;

    function begin() {
      ctx.fillStyle = '#EFE6D2';
      ctx.fillRect(0, 0, W, H);
      if (cur.bg) {
        var bg = new Image();
        bg.onload = function () { drawBg(bg); drawAll(); emit(); };
        bg.onerror = function () { drawAll(); emit(); };
        bg.src = cur.bg;
      } else {
        drawAll();
        emit();
      }
    }

    function drawBg(bg) {
      var r = Math.max(W / bg.width, H / bg.height);
      var w = bg.width * r, h = bg.height * r;
      ctx.drawImage(bg, (W - w) / 2, (H - h) / 2, w, h);
    }

    function drawAll() {
      list.forEach(function (e) {
        if (e.type !== 'text') return;
        var fs = (e.size || 4.2) / 100 * W;
        ctx.fillStyle = e.color || '#2B2620';
        ctx.font = fs + 'px "KaiTi","STKaiti",serif';
        ctx.textBaseline = 'top';
        var maxW = e.w / 100 * W;
        if (e.vertical) {
          ctx.textAlign = 'center';
          drawVertical(ctx, e.text || '', e.x / 100 * W + maxW - fs * 0.55,
                       e.y / 100 * H, fs, fs * 1.45, maxW);
          return;
        }
        ctx.textAlign = e.align === 'center' ? 'center' : e.align === 'right' ? 'right' : 'left';
        var ax = e.align === 'center' ? e.x / 100 * W + maxW / 2
               : e.align === 'right' ? e.x / 100 * W + maxW
               : e.x / 100 * W;
        wrapText(ctx, e.text || '', ax, e.y / 100 * H, maxW, fs * 1.55);
      });
      list.forEach(function (e) {
        if (e.type !== 'image') return;
        var im = loaded[e.id];
        if (!im) return;
        /* 走 http 打开时同源图片不污染画布，可以直接画；
           file:// 下会抛安全错误，由 emit 里的 try/catch 兜住 */
        var h = (e.h || 40) / 100 * H;
        var w = h * ((im.width / im.height) || 0.667);
        ctx.drawImage(im, e.x / 100 * W, e.y / 100 * H, w, h);
      });
    }

    function emit() {
      try {
        c.toBlob(function (blob) {
          if (!blob) { alert('导出失败：请用 http:// 打开本页后再试。'); return; }
          download((cur.name || '私閘') + '.png', blob, 'image/png');
        }, 'image/png');
      } catch (err) {
        alert('导出失败：' + err.message +
              '\n（用 file:// 打开时浏览器会禁止画布导出，请改用 http:// 地址访问）');
      }
    }

    if (!left) { begin(); return; }
    pics.forEach(function (e) {
      var isData = String(e.src || '').indexOf('data:') === 0;
      imgOk[e.id] = isData;
      if (!isData) skipped++;
      var im = new Image();
      im.onload = function () { loaded[e.id] = im; if (--left === 0) begin(); };
      im.onerror = function () { if (--left === 0) begin(); };
      im.src = e.src;
    });
  }

  /* 竖排：逐字向下，一列满了换左一列 */
  function drawVertical(ctx, text, xRight, yTop, fs, lh, maxW) {
    var cols = String(text).split('\n');
    var cx = xRight;
    var floorX = xRight - maxW + fs;
    cols.forEach(function (col) {
      var yy = yTop;
      for (var i = 0; i < col.length; i++) {
        if (cx < floorX) { cx = xRight; break; }
        ctx.fillText(col[i], cx, yy);
        yy += lh;
      }
      cx -= lh;
    });
  }

  function wrapText(ctx, text, x, y, maxW, lh) {
    var lines = String(text).split('\n');
    var yy = y;
    lines.forEach(function (ln) {
      var line = '';
      for (var i = 0; i < ln.length; i++) {
        var t = line + ln[i];
        if (ctx.measureText(t).width > maxW && line) {
          ctx.fillText(line, x, yy);
          yy += lh;
          line = ln[i];
        } else {
          line = t;
        }
      }
      ctx.fillText(line, x, yy);
      yy += lh;
    });
  }

  /* --- 尺寸变化：重算字号 --- */
  if (window.ResizeObserver) {
    new ResizeObserver(function () { if (cur) render(); }).observe(elCanvas);
  }

  /* --- 启动 --- */
  renumber();
  paintMarkers();
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && addMode) setAddMode(false);
  });

  window.CUSTOM = {
    open: open,
    close: close,
    add: function (lon, lat, name) {
      var d = load();
      var n = { id: uid('c'), name: name || '私閘', lon: lon, lat: lat,
                color: '#8C7B62', bg: '', els: makeDefaults() };
      d.nodes.push(n);
      save(d);
      paintMarkers();
      return n.id;
    },
    list: function () { return load().nodes; },
    exportJSON: exportJSON
  };
})();
