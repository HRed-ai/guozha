/* 八闸名录：总图的替代入口
   手机屏上地图标签容易挤在一起，这里给一个可点的清单；
   未开的闸仍会被 station.js 的通行规则拦住，并提示先过哪一闸。 */
(function () {
  var ST = window.STATIONS || [];
  var stage = document.getElementById('stage');
  var root = document.getElementById('roster');
  var veil = document.getElementById('roster-veil');
  var list = root && root.querySelector('.roster-list');
  var openBtn = document.getElementById('roster-btn');
  var closeBtn = root && root.querySelector('.roster-close');
  if (!root || !veil || !list || !openBtn) return;

  var lastFocus = null;
  var showing = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
    });
  }
  function nameOf(s) {
    var o = (window.EDITS && window.EDITS.get) ? window.EDITS.get(s.id) : null;
    return (o && o.name) || s.name;
  }
  function statusOf(i, s) {
    var passed = !!(window.LEDGER && window.LEDGER.hasSeen(s.id));
    if (passed) return {cls: 'passed', text: '已過閘'};
    var rule = window.RULES ? window.RULES.canOpen(i) : {ok: true};
    if (rule.ok) return {cls: 'open', text: '可入 · 待過閘'};
    return {cls: 'locked', text: '未開 · 先過「' + rule.prevName + '」'};
  }

  function render() {
    var official = ST.map(function (s, i) {
      var st = statusOf(i, s);
      var name = nameOf(s);
      return '<li class="roster-item ' + st.cls + '">' +
        '<button class="roster-row" type="button" data-i="' + i + '" ' +
          'style="--c:' + esc(s.color) + '" ' +
          'aria-label="' + esc(name) + '，' + esc(st.text) + '">' +
          '<span class="roster-seal">' + esc(s.i) + '</span>' +
          '<span class="roster-info">' +
            '<span class="roster-name">' + esc(name) + '</span>' +
            '<span class="roster-meta"><i class="roster-chip"></i>' +
              esc(s.city) + ' · ' + esc(s.era) + '</span>' +
          '</span>' +
          '<span class="roster-state">' + esc(st.text) + '</span>' +
        '</button></li>';
    }).join('');

    var nodes = (window.CUSTOM && window.CUSTOM.list) ? window.CUSTOM.list() : [];
    var mine = '';
    if (nodes.length) {
      mine = '<li class="roster-section"><span>我的閘</span><i>本機保存</i></li>' +
        nodes.map(function (n) {
          var name = n.name || '私閘';
          return '<li class="roster-item mine">' +
            '<button class="roster-row" type="button" data-cid="' + esc(n.id) + '" ' +
              'style="--c:' + esc(n.color || '#8C7B62') + '" ' +
              'aria-label="我的私閘 ' + esc(name) + '，可入">' +
              '<span class="roster-seal">' + esc(n.no || '私') + '</span>' +
              '<span class="roster-info">' +
                '<span class="roster-name">' + esc(name) + '</span>' +
                '<span class="roster-meta"><i class="roster-chip"></i>自建 · 本機保存</span>' +
              '</span>' +
              '<span class="roster-state">我的閘</span>' +
            '</button></li>';
        }).join('');
    }

    list.innerHTML = official + mine;
  }

  function openRoster() {
    if (showing) return;
    showing = true;
    render();
    lastFocus = document.activeElement;
    if (stage) stage.inert = true;
    veil.hidden = false;
    root.classList.add('show');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('roster-open');
    requestAnimationFrame(function () { veil.classList.add('show'); });
    setTimeout(function () {
      var first = list.querySelector('.roster-row');
      if (first) first.focus();
    }, 60);
  }

  function closeRoster() {
    if (!showing) return;
    showing = false;
    root.classList.remove('show');
    root.setAttribute('aria-hidden', 'true');
    veil.classList.remove('show');
    document.body.classList.remove('roster-open');
    if (stage) stage.inert = false;
    setTimeout(function () {
      if (!showing) veil.hidden = true;
    }, 260);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  function toggle() {
    if (showing) closeRoster(); else openRoster();
  }

  openBtn.addEventListener('click', toggle);
  if (closeBtn) closeBtn.addEventListener('click', closeRoster);
  veil.addEventListener('click', closeRoster);

  list.addEventListener('click', function (e) {
    var row = e.target.closest('.roster-row');
    if (!row) return;
    var cid = row.dataset.cid;
    var i = +row.dataset.i;
    closeRoster();
    if (cid) {
      if (window.CUSTOM && window.CUSTOM.open) window.CUSTOM.open(cid);
      return;
    }
    if (window.openStation) window.openStation(i);
  });

  document.addEventListener('keydown', function (e) {
    if (!showing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeRoster();
      return;
    }
    if (e.key !== 'Tab') return;
    var items = [closeBtn].concat(Array.from(list.querySelectorAll('.roster-row')))
      .filter(Boolean);
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  document.addEventListener('seenchange', function () {
    if (showing) render();
  });
})();
