/* 闸簿：一份数据记「哪天读过哪几闸」
   结构 {
     v:1,
     seen: { s01: '2026-10-25', ... },        每闸首次进入的日期
     days: { '2026-10-25': ['s01','s03'], ... }, 每天读过哪些闸（去重，按进入顺序）
     visits: 27                                总进入次数
   }
*/
(function () {
  var KEY = 'guozha.ledger';
  var V = 1;

  function blank() { return { v: V, seen: {}, days: {}, visits: 0 }; }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function readJSON(k) {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; }
  }

  /* 把旧的 guozha.days / guozha.seen 并进来 */
  function migrate() {
    var oldDays = readJSON('guozha.days');
    var oldSeen = readJSON('guozha.seen');
    if (!oldDays && !oldSeen) return null;
    var d = blank();
    (oldDays || []).forEach(function (k) { if (!d.days[k]) d.days[k] = []; });
    (oldSeen || []).forEach(function (id) {
      var keys = Object.keys(d.days).sort();
      var k = keys.length ? keys[keys.length - 1] : dayKey();
      d.seen[id] = k;
      if (!d.days[k]) d.days[k] = [];
      if (d.days[k].indexOf(id) < 0) d.days[k].push(id);
    });
    return d;
  }

  function load() {
    var d = readJSON(KEY);
    if (!d || d.v !== V) {
      d = migrate() || blank();
      save(d);
    }
    if (!d.seen) d.seen = {};
    if (!d.days) d.days = {};
    if (!d.visits) d.visits = 0;
    return d;
  }

  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (_) {}
  }

  /* 进入一闸：登记当天 + 首次日期 */
  function touch(id) {
    var d = load();
    var k = dayKey();
    var isNew = !d.seen[id];
    d.visits += 1;
    if (isNew) d.seen[id] = k;
    if (!d.days[k]) d.days[k] = [];
    if (d.days[k].indexOf(id) < 0) d.days[k].push(id);
    save(d);
    return { isNew: isNew, day: k, visits: d.visits, seen: Object.keys(d.seen).length };
  }

  function hasSeen(id) { return !!load().seen[id]; }

  function dayKeys() { return Object.keys(load().days).sort(); }

  function seenIds() { return Object.keys(load().seen); }

  /* 文牒：用八闸的简称字写出来 —— 读过哪几闸，就写哪几个字
     澄 宣 謝 荊 南 清 邵 龍（可写简体：谢 荆 龙；也可直接写全名） */
  var GLYPH = [
    { id: 's01', ch: '澄', alt: ['澄', '澄清', '澄清上闸', '澄清上閘'] },
    { id: 's02', ch: '宣', alt: ['宣', '九宣', '九宣闸', '九宣閘'] },
    { id: 's03', ch: '謝', alt: ['謝', '谢', '謝家壩', '谢家坝', '家坝'] },
    { id: 's04', ch: '荊', alt: ['荊', '荆', '荊門上閘', '荆门上闸', '门上闸'] },
    { id: 's05', ch: '南', alt: ['南', '南旺', '南旺枢纽', '南旺樞紐', '旺'] },
    { id: 's06', ch: '江', alt: ['江', '清江', '清江大闸', '清江大閘', '清江闸'] },
    { id: 's07', ch: '邵', alt: ['邵', '邵伯', '邵伯古堤', '邵伯堤', '伯'] },
    { id: 's08', ch: '龍', alt: ['龍', '龙', '龍山閘', '龙山闸', '龙山'] }
  ];

  function phrase() {
    var d = load();
    var out = [];
    GLYPH.forEach(function (g) { if (d.seen[g.id]) out.push(g.ch); });
    return out.length ? out.join('') : '空';
  }

  function phraseSpaced() {
    var p = phrase();
    return p.length > 1 ? Array.from(p).join(' ') : p;
  }

  /* 解析：只认字，不认顺序、不认空格标点；繁体简体都收 */
  function parse(text) {
    if (!text) return null;
    var s = String(text).trim();
    if (!s) return null;
    if (s === '空' || s === '〇' || s === '0') return { ids: [], text: '空' };
    var ids = [];
    GLYPH.forEach(function (g) {
      var hit = g.alt.some(function (a) { return s.indexOf(a) >= 0; });
      if (hit) ids.push(g.id);
    });
    // 单字逐个匹配（写「澄谢龙」时不依赖 alt 顺序）
    Array.from(s).forEach(function (c) {
      GLYPH.forEach(function (g) {
        if (g.alt.indexOf(c) >= 0 && ids.indexOf(g.id) < 0) ids.push(g.id);
      });
    });
    if (!ids.length) return null;
    ids.sort(function (a, b) {
      return GLYPH.findIndex(function (g) { return g.id === a; }) -
             GLYPH.findIndex(function (g) { return g.id === b; });
    });
    return { ids: ids, text: ids.map(function (id) {
      return GLYPH.find(function (g) { return g.id === id; }).ch;
    }).join('') };
  }

  /* 用文牒补进度：只补「哪些闸读过」，日期以本机当天为准 */
  function apply(text) {
    var r = parse(text);
    if (!r) return { ok: false };
    var d = load();
    var k = dayKey();
    var added = [];
    r.ids.forEach(function (id) {
      if (!d.seen[id]) { d.seen[id] = k; added.push(id); }
      if (!d.days[k]) d.days[k] = [];
      if (d.days[k].indexOf(id) < 0) d.days[k].push(id);
    });
    save(d);
    return { ok: true, added: added, read: r.ids.length, phrase: phrase() };
  }

  function exportJSON() { return JSON.stringify(load(), null, 1); }

  function reset() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem('guozha.days');
      localStorage.removeItem('guozha.seen');
    } catch (_) {}
  }

  window.LEDGER = {
    load: load, touch: touch, hasSeen: hasSeen, dayKeys: dayKeys,
    seenIds: seenIds, phrase: phrase, phraseSpaced: phraseSpaced,
    parse: parse, apply: apply, glyphs: GLYPH,
    exportJSON: exportJSON, reset: reset, dayKey: dayKey
  };
})();
