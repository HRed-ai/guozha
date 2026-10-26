/* 过闸 · 通行规则
   仪式：进闸阅读 → 按「過閘」盖印 → 下一闸开启。
   每闸只过一次，不再按天累计。
   实体书签 / 分享链接直达某一闸时由 station.js 强制开门（标签即钥匙）。
   演示时可在地址后加 ?unlock=1 跳过所有限制。 */
(function () {
  var demo = /[?&]unlock=1/.test(location.search) || /unlock=1/.test(location.hash);
  var ST = window.STATIONS || [];

  function seen(id) {
    return !!(window.LEDGER && window.LEDGER.hasSeen && window.LEDGER.hasSeen(id));
  }

  /* 第 i 闸能不能从总图/圆点进（0 基）
     规则：第一闸永远能进；进过的闸不再锁；
           否则要先过上一闸。 */
  function canOpen(i) {
    if (demo) return { ok: true, demo: true };
    if (i <= 0) return { ok: true };
    var cur = ST[i], prev = ST[i - 1];
    if (!cur || !prev) return { ok: true };
    if (seen(cur.id)) return { ok: true, seen: true };
    if (seen(prev.id)) return { ok: true };
    return { ok: false, prevName: prev.name, prevIndex: i - 1 };
  }

  /* 页面上的一句话提示 */
  var el = null, timer = null;
  function toast(msg) {
    if (!el) {
      el = document.createElement('div');
      el.className = 'gp-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(timer);
    timer = setTimeout(function () { el.classList.remove('on'); }, 2800);
  }

  /* 编辑权限：八闸全部过完一次之后才开放（演示模式直接开） */
  function visitedCount() {
    var n = 0;
    (window.STATIONS || []).forEach(function (s) { if (seen(s.id)) n++; });
    return n;
  }
  function editUnlocked() {
    if (demo) return true;
    var ST = window.STATIONS || [];
    if (!ST.length || !window.LEDGER) return false;
    return ST.every(function (s) { return seen(s.id); });
  }

  window.RULES = {
    demo: demo,
    canOpen: canOpen,
    visitedCount: visitedCount,
    editUnlocked: editUnlocked,
    toast: toast
  };
})();
