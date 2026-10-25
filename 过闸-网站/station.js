/* 单闸详情页 */
(function () {
  const ST = window.STATIONS || [];
  const root = document.getElementById('station');
  if (!root || !ST.length) return;

  /* 预解码开页纹理：避免动画第一帧才开始 decode 造成顿挫 */
  ['wood_wide', 'water', 'stone', 'rope', 'plank'].forEach(n => {
    const im = new Image();
    im.src = 'assets/tex/' + n + '.jpg';
  });

  const $ = s => root.querySelector(s);
  const elCh = $('.st-ch');
  const elName = $('.st-name h2');
  const elMeta = $('.st-meta');
  const elScene = $('.st-scene');
  const elVerse = $('.st-verse');
  const elFacts = $('.st-facts');
  const elFigureBox = $('.st-figure');
  const elGate = $('.st-gate');
  const elCheckin = $('.st-checkin');
  const elBubble = $('.st-bubble');
  const elSeqn = $('.st-seqn');
  const elTrack = $('.st-track');
  let cur = -1;
  let actTimer = null;

  /* ---------- 点角色说话：每人八首古诗，点一次换一首 ---------- */
  let poemIdx = 0;
  let bubbleTimer = null;
  function hideBubble() {
    clearTimeout(bubbleTimer);
    if (elBubble) elBubble.classList.remove('on');
  }
  function showPoem(s) {
    if (!elBubble) return;
    const list = (window.POEMS || {})[s.id];
    if (!list || !list.length) return;
    const p = list[poemIdx % list.length];
    poemIdx += 1;
    elBubble.innerHTML =
      '<div><span class="bp-t">《' + p.t + '》</span>' +
      '<span class="bp-a">' + p.a + '</span></div>' +
      '<p class="bp-s">' + p.s + '</p>';
    elBubble.classList.add('on');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(hideBubble, 9000);
  }

  /* ---------- 打卡：记录打开过本站的日期 ---------- */
  const CN = '〇一二三四五六七八九';
  function cnNum(n) {
    if (n < 10) return CN[n];
    if (n < 20) return '十' + (n % 10 ? CN[n % 10] : '');
    if (n < 100) return CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
    const b = Math.floor(n / 100), r = n % 100;
    let s = CN[b] + '百';
    if (r === 0) return s;
    if (r < 10) return s + '〇' + CN[r];
    return s + cnNum(r);
  }
  const pad2 = n => String(n).padStart(2, '0');
  const dayKey = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  /* 年份逐位读：2026 → 二〇二六 */
  const cnYear = y => String(y).split('').map(c => CN[+c]).join('');

  /* 生成日历 HTML：withCode=false 时不含文牒输入（自建闸页也能用） */
  function checkinHTML(withCode) {
    const days = new Set(window.LEDGER ? window.LEDGER.dayKeys() : []);
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m, 1);
    const dim = new Date(y, m + 1, 0).getDate();      // 当月天数
    const lead = first.getDay();                       // 周日开头
    const tKey = dayKey(now);

    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<i class="ck-d blank"></i>';
    for (let d = 1; d <= dim; d++) {
      const key = y + '-' + pad2(m + 1) + '-' + pad2(d);
      const cls = 'ck-d' + (days.has(key) ? ' on' : '') + (key === tKey ? ' today' : '');
      cells += '<i class="' + cls + '">' + d + '</i>';
    }

    // 本月打卡天数
    let inMonth = 0;
    days.forEach(k => { if (k.startsWith(y + '-' + pad2(m + 1))) inMonth++; });

    return '<div class="ck-head">' +
        '<span class="ck-title">打卡</span>' +
        '<span class="ck-sum">' + cnYear(y) + '年' + cnNum(m + 1) + '月 · 本月 ' + cnNum(inMonth) + ' 日</span>' +
      '</div>' +
      '<div class="ck-grid">' +
        ['日', '一', '二', '三', '四', '五', '六']
          .map(w => '<i class="ck-w">' + w + '</i>').join('') +
        cells +
      '</div>' +
      (window.LEDGER && withCode !== false
        ? '<div class="ck-code">' +
            '<span class="ck-label">文牒</span>' +
            '<b class="ck-phrase">' + window.LEDGER.phraseSpaced() + '</b>' +
            '<button class="ck-btn" type="button">恢復</button>' +
          '</div>' +
          '<div class="ck-form" hidden>' +
            '<input class="ck-input" type="text" maxlength="40" autocomplete="off" ' +
              'placeholder="读过哪几闸就写哪几个字，如：澄谢龙">' +
            '<div class="ck-row">' +
              '<button class="ck-ok" type="button">確認</button>' +
              '<button class="ck-cancel" type="button">取消</button>' +
            '</div>' +
            '<p class="ck-msg">可写简称：澄 宣 谢 荆 南 江 邵 龙；也可直接写闸名。</p>' +
          '</div>'
        : '');
  }
  window.buildCalendar = checkinHTML;

  function renderCheckin() {
    if (!elCheckin) return;
    elCheckin.innerHTML = checkinHTML(true);
  }

  /* 文牒：點「恢復」展开输入，寫字即可 */
  if (elCheckin) {
    const ckForm = () => elCheckin.querySelector('.ck-form');
    const ckInput = () => elCheckin.querySelector('.ck-input');

    function ckSubmit() {
      const box = ckForm(), input = ckInput(), msg = elCheckin.querySelector('.ck-msg');
      if (!input || !box) return;
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      const r = window.LEDGER.apply(v);
      if (!r.ok) {
        msg.textContent = '没认出这些字——可写：澄 宣 谢 荆 南 江 邵 龙';
        msg.classList.add('err');
        input.focus();
        return;
      }
      renderCheckin();
      document.dispatchEvent(new CustomEvent('seenchange'));
    }

    elCheckin.addEventListener('click', e => {
      if (!window.LEDGER) return;
      const box = ckForm();
      if (e.target.closest('.ck-btn')) {
        box.hidden = false;
        const input = ckInput();
        input.value = '';
        input.focus();
        return;
      }
      if (e.target.closest('.ck-cancel')) { box.hidden = true; return; }
      if (e.target.closest('.ck-ok')) { ckSubmit(); return; }
    });

    elCheckin.addEventListener('keydown', e => {
      if (!e.target.closest('.ck-input')) return;
      if (e.key === 'Enter') { e.preventDefault(); ckSubmit(); }
      else if (e.key === 'Escape') { e.preventDefault(); ckForm().hidden = true; }
    });
  }

  /* 开页动作：每闸一种，对应其过闸法 */
  const ANIM = {
    lift:  {dur: 2900, html: '<div class="g-lift"><img src="assets/tex/wood_wide.jpg" alt=""></div>'},
    draw:  {dur: 2900, html: Array.from({length: 8}, (_, i) =>
             '<i class="g-strip" style="top:' + (i * 12.5) + '%;animation-delay:' +
             (i * 0.13).toFixed(2) + 's"></i>').join('')},
    flood: {dur: 3400, html: '<div class="g-sheet"></div>'},
    split: {dur: 3000, html: '<div class="g-half l"></div><div class="g-half r"></div>'},
    wedge: {dur: 3000, html: '<div class="g-wedge a"></div><div class="g-wedge b"></div>'},
    wind:  {dur: 3200, html: '<div class="g-wind"></div><div class="g-roll"></div>'},
    link:  {dur: 2500, html: '<div class="g-link">' + Array.from({length: 4}, (_, i) =>
             '<i class="g-panel" style="animation-delay:' + (i * 0.35).toFixed(2) + 's"></i>')
             .join('') + '</div>'},
    tide:  {dur: 4400, html: '<div class="g-sheet"></div><div class="g-ripple"></div>'}
  };
  let gateTimer = null;
  let actPaused = false;

  /* 开页期间暂停立绘轮播，避免大图淡入与闸板动画抢帧 */
  function pauseActs() {
    if (actTimer) { clearInterval(actTimer); actTimer = null; actPaused = true; }
  }
  function resumeActs(s) {
    if (!actPaused) return;
    actPaused = false;
    if (s) setFigureCycle(s);
  }

  function playOpen(s) {
    const kind = s.anim || '';
    if (!elGate) return;
    clearTimeout(gateTimer);
    elGate.classList.remove('play');
    elGate.removeAttribute('data-anim');
    elGate.innerHTML = '';
    if (!ANIM[kind]) return;

    pauseActs();
    root.classList.add('gate-on');              // 关掉纸纹/暗角，减轻合成负担
    elGate.setAttribute('data-anim', kind);
    elGate.innerHTML = ANIM[kind].html;
    void elGate.offsetHeight;                    // 强制回流，让动画从头开始
    requestAnimationFrame(() => elGate.classList.add('play'));

    gateTimer = setTimeout(() => {
      elGate.classList.remove('play');
      elGate.innerHTML = '';
      root.classList.remove('gate-on');
      resumeActs(s);
    }, ANIM[kind].dur);
  }

  /* 右侧立绘：有 acts 的站用静态图轮播动作，其余单张 */
  function setFigure(s) {
    if (actTimer) { clearInterval(actTimer); actTimer = null; }
    // 只清图片，保留气泡元素
    elFigureBox.querySelectorAll('img').forEach(el => el.remove());
    const names = (s.acts && s.acts.length) ? s.acts : ['figure'];
    names.forEach((n, k) => {
      const img = document.createElement('img');
      img.src = 'assets/' + s.id + '/' + n + '.png';
      img.alt = s.name + ' 人物';
      if (k === 0) img.className = 'on';
      img.onerror = () => { img.style.visibility = 'hidden'; };
      elFigureBox.appendChild(img);
    });
    if (names.length > 1) setFigureCycle(s);
  }

  /* 单独抽出轮播，便于开页动画期间暂停/恢复 */
  function setFigureCycle(s) {
    if (actTimer) { clearInterval(actTimer); actTimer = null; }
    const n = elFigureBox.querySelectorAll('img').length;
    if (n < 2) return;
    let i = [...elFigureBox.querySelectorAll('img')].findIndex(el => el.classList.contains('on'));
    if (i < 0) i = 0;
    actTimer = setInterval(() => {
      const imgs = elFigureBox.querySelectorAll('img');
      if (imgs.length < 2) return;
      imgs[i].classList.remove('on');
      i = (i + 1) % imgs.length;
      imgs[i].classList.add('on');
    }, 4200);
  }

  /* 主题色 → 同色系深色（保色相，压明度） */
  function deepInk(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return '#' + c.map(v => {
      const d = Math.round(v * 0.44 + 10);
      return Math.min(255, Math.max(0, d)).toString(16).padStart(2, '0');
    }).join('');
  }

  function render(i) {
    const s = ST[i];
    elCh.textContent = s.i;
    elName.textContent = s.name;
    elMeta.innerHTML = s.city + ' · ' + s.era + ' · 過閘法「' + s.way + '」' +
      '<em style="background:' + s.color + '"></em>' + s.colorName;

    // 每站主题色
    root.style.setProperty('--accent', s.color);
    root.style.setProperty('--accent-ink', deepInk(s.color));

    // 进闸登记（闸簿：日期 + 闸）
    const rec = window.LEDGER ? window.LEDGER.touch(s.id) : null;

    // 打卡日历
    renderCheckin();

    // 场景图
    const sceneImg = elScene.querySelector('img');
    const sceneCap = elScene.querySelector('figcaption');
    sceneImg.onerror = () => {
      elScene.classList.add('missing');
      sceneImg.removeAttribute('src');
    };
    sceneImg.onload = () => elScene.classList.remove('missing');
    sceneImg.src = 'assets/' + s.id + '/scene.jpg';
    sceneImg.alt = s.name + ' 实景';
    sceneCap.textContent = s.name + '　' + s.era;

    // 文言（竖排，逐句成列）
    elVerse.innerHTML = s.text.map(t => '<p>' + t + '</p>').join('');

    // 考据
    elFacts.innerHTML = s.facts.map(f => '<li>' + f + '</li>').join('');

    // 右侧立绘（有 acts 的站自动轮播动作）
    setFigure(s);

    // 进度点（已读的填实）
    elTrack.innerHTML = ST.map((x, k) => {
      const seen = window.LEDGER && window.LEDGER.hasSeen(x.id);
      return '<button class="st-dot' + (k === i ? ' on' : '') + (seen ? ' seen' : '') +
        '" data-i="' + k + '" aria-label="' + x.name + '"></button>';
    }).join('');

    // 第几闸 / 共几闸（含自己加的闸）
    if (elSeqn) {
      const extra = window.CUSTOM && window.CUSTOM.list ? window.CUSTOM.list().length : 0;
      elSeqn.textContent = '第 ' + s.i + ' 閘 · 共 ' + cnNum(ST.length + extra) + ' 閘';
      elSeqn.classList.toggle('read', !(rec && rec.isNew));
    }

    // 第一次进这一闸：通知地图更新已读状态
    if (rec && rec.isNew) {
      document.dispatchEvent(new CustomEvent('seenchange'));
    }

    // 开页动作（每闸一种）
    playOpen(s);

    // 换闸：重置诗句序号并收起气泡
    poemIdx = 0;
    hideBubble();
  }

  /* 点角色：弹出古诗气泡 */
  if (elFigureBox) {
    elFigureBox.addEventListener('click', e => {
      if (!e.target.closest('img')) return;
      const s = ST[cur];
      if (!s) return;
      if (elBubble && elBubble.classList.contains('on')) {
        // 已经开着，再点就换下一首
        showPoem(s);
      } else {
        showPoem(s);
      }
    });
  }

  function open(i, push) {
    if (i < 0 || i >= ST.length) return;
    cur = i;
    render(i);
    root.classList.add('show');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('st-open');
    if (push !== false) {
      try { history.replaceState(null, '', '#' + ST[i].id); } catch (_) { location.hash = ST[i].id; }
    }
  }

  function close() {
    root.classList.remove('show');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('st-open');
    hideBubble();
    // 复位闸板：只清动画状态，不销毁图层（保留合成层，下次打开才不卡）
    if (elGate) {
      clearTimeout(gateTimer);
      elGate.classList.remove('play');
      elGate.innerHTML = '';
      elGate.removeAttribute('data-anim');
    }
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch (_) {
      location.hash = '';
    }
  }

  root.addEventListener('click', e => {
    const dot = e.target.closest('.st-dot');
    if (dot) { open(+dot.dataset.i); return; }
    if (e.target.closest('.st-back')) { close(); return; }
    if (e.target.closest('.st-prev')) { goStep(-1); return; }
    if (e.target.closest('.st-next')) { goStep(1); return; }
  });

  /* 上一闸 / 下一闸：有自建闸时按「八闸 + 我的闸」的统一顺序走 */
  function goStep(dir) {
    if (window.stepNode && window.stepNode('st', cur, dir)) return;
    open((cur + dir + ST.length) % ST.length);
  }

  document.addEventListener('keydown', e => {
    if (!root.classList.contains('show')) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); open((cur + ST.length - 1) % ST.length); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); open((cur + 1) % ST.length); }
  });

  window.openStation = open;
  window.closeStation = close;

  // 深链：#s01 ~ #s08
  function fromHash() {
    const m = (location.hash || '').match(/^#(s\d{2})$/);
    if (!m) return -1;
    return ST.findIndex(s => s.id === m[1]);
  }
  window.addEventListener('hashchange', () => {
    const i = fromHash();
    if (i >= 0) open(i, false); else if (root.classList.contains('show')) close();
  });
  const i0 = fromHash();
  if (i0 >= 0) setTimeout(() => open(i0, false), 700);
})();
