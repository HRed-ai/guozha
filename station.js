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
  const elNext = $('.st-next');
  const elPass = $('.st-pass');
  const elQToggle = $('.st-q-toggle');
  const Q_KEY = 'guozha.figure.q';
  let qMode = false;
  try { qMode = localStorage.getItem(Q_KEY) === '1'; } catch (_) {}
  let cur = -1;
  let actTimer = null;
  let passing = false;
  let passTimer = null;

  /* ---------- 点角色说话：每人八首古诗，点一次换一首 ---------- */
  let poemIdx = 0;
  let bubbleTimer = null;
  function hideBubble() {
    clearTimeout(bubbleTimer);
    if (elBubble) elBubble.classList.remove('on');
  }
  function showPoem(s, pin) {
    if (!elBubble) return;

    /* 编辑模式下：显示可改的对话（自定的优先，其次当前这一首） */
    if (pin) {
      const body = s.poem || (((window.POEMS || {})[s.id] || [{}])[0].s || '');
      elBubble.innerHTML =
        '<div><span class="bp-t">對 話</span>' +
        '<span class="bp-a">可點擊修改</span></div>' +
        '<p class="bp-s" contenteditable="true" spellcheck="false">' + body + '</p>';
      elBubble.classList.add('on');
      clearTimeout(bubbleTimer);
      return;
    }

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

  /* ---------- 閘簿：记录过闸的日期 ---------- */
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
  function checkinHTML(withCode, st) {
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
        '<span class="ck-title">閘簿</span>' +
        '<span class="ck-sum">' + cnYear(y) + '年' + cnNum(m + 1) + '月 · 本月 ' + cnNum(inMonth) + ' 日</span>' +
      '</div>' +
      '<div class="ck-grid">' +
        ['日', '一', '二', '三', '四', '五', '六']
          .map(w => '<i class="ck-w">' + w + '</i>').join('') +
        cells +
      '</div>' +
      gateHTML(st) +
      (window.LEDGER && withCode !== false
        ? '<div class="ck-code">' +
            '<span class="ck-label">文牒</span>' +
            '<b class="ck-phrase">' + window.LEDGER.phraseSpaced() + '</b>' +
            '<button class="ck-btn" type="button">恢復</button>' +
          '</div>' +
          '<div class="ck-form" hidden>' +
            '<input class="ck-input" type="text" maxlength="40" autocomplete="off" ' +
              'placeholder="去過哪幾閘就寫哪幾個字，如：澄謝龍">' +
            '<div class="ck-row">' +
              '<button class="ck-ok" type="button">確認</button>' +
              '<button class="ck-cancel" type="button">取消</button>' +
            '</div>' +
            '<p class="ck-msg">可写简称：澄 宣 谢 荆 南 江 邵 龙；也可直接写闸名。</p>' +
          '</div>'
        : '');
  }
  window.buildCalendar = checkinHTML;

  /* 通行状态：这一闸过没过、下一闸开没开 */
  function gateHTML(st) {
    if (!st || !window.RULES) return '';
    var i = ST.findIndex(x => x.id === st.id);
    if (i < 0) return '';
    if (window.RULES.demo) {
      return '<div class="ck-gate demo">演示模式 · 全部闸已解锁</div>';
    }
    var passed = !!(window.LEDGER && window.LEDGER.hasSeen(st.id));
    var next = ST[i + 1];
    if (!next) {
      return '<div class="ck-gate' + (passed ? ' done' : '') + '">' +
        (passed ? '已過閘 · 八閘全程已通' : '未過閘 · 讀完後點頁底「過閘」蓋印，完成八閘') +
        '</div>';
    }
    return '<div class="ck-gate' + (passed ? ' done' : '') + '">' +
      (passed
        ? '已過閘 · 下一閘（' + next.name + '）已開'
        : '未過閘 · 讀完後點頁底「過閘」蓋印，即可開下一閘（' + next.name + '）') +
      '</div>';
  }

  function renderCheckin(st) {
    if (!elCheckin) return;
    elCheckin.innerHTML = checkinHTML(true, st);
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
      renderCheckin(ST[cur]);
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
        /* 桌面页体是滚动容器：把整张表单滚进来，别只露出输入框 */
        setTimeout(() => {
          if (box.scrollIntoView) box.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 30);
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

  /* ================= 编辑：八闸内容可改（读完八闸才解锁） ================= */
  let editing = false;
  const elEdit = root.querySelector('.st-edit');
  const elHead2 = root.querySelector('.st-name h2');

  function shrinkImg(file, maxSide, cb) {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const r = Math.min(1, maxSide / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * r);
        c.height = Math.round(im.height * r);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.82));
      };
      im.onerror = () => window.RULES && window.RULES.toast('这张图读不出来');
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  function pickImage(which) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      shrinkImg(f, which === 'scene' ? 1400 : 900, url => {
        window.EDITS.patch(ST[cur].id, which === 'scene' ? {scene: url} : {figure: url});
        render(cur);
        window.RULES && window.RULES.toast(which === 'scene' ? '場景圖已更換' : '人物圖已更換');
      });
    };
    inp.click();
  }

  /* 进入编辑状态：文言、考据、闸名可改；点图换图 */
  function enterEditDom() {
    [elVerse, elFacts, elHead2].forEach(el => {
      if (el) {
        el.setAttribute('contenteditable', 'true');
        el.spellcheck = false;
      }
    });
    const sceneImg = elScene.querySelector('img');
    if (sceneImg) sceneImg.style.cursor = 'pointer';
    elFigureBox.querySelectorAll('img').forEach(i => { i.style.cursor = 'pointer'; });
  }

  function leaveEditDom() {
    [elVerse, elFacts, elHead2].forEach(el => {
      if (el) el.removeAttribute('contenteditable');
    });
  }

  function collectEdit() {
    if (!cur && cur !== 0) return;
    const id = ST[cur].id;
    const o = {};
    const name = (elHead2.innerText || '').trim();
    if (name && name !== ST[cur].name) o.name = name;
    const lines = elVerse.innerText.split('\n').map(x => x.trim()).filter(Boolean);
    if (lines.length) o.text = lines;
    const facts = [...elFacts.querySelectorAll('li')]
      .map(li => (li.innerText || '').trim()).filter(Boolean);
    if (facts.length) o.facts = facts;
    const bp = root.querySelector('.st-bubble .bp-s');
    if (bp && bp.isContentEditable) {
      const t = (bp.innerText || '').trim();
      if (t) o.poem = t;
    }
    if (Object.keys(o).length) {
      window.EDITS.patch(id, o);
      window.RULES && window.RULES.toast('已保存這一閘的修改');
    }
  }

  function toggleEdit() {
    if (!editing) {
      if (!(window.RULES && window.RULES.editUnlocked())) {
        const n = window.RULES ? window.RULES.visitedCount() : 0;
        window.RULES && window.RULES.toast('過完八閘後才能編輯（已過 ' + n + ' / ' + ST.length + '）');
        return;
      }
      editing = true;
      render(cur);
      return;
    }
    editing = false;
    collectEdit();
    render(cur);
  }

  if (elEdit) elEdit.addEventListener('click', toggleEdit);

  /* 编辑状态下点图换图、点人物弹可改的对话 */
  if (elScene) {
    elScene.addEventListener('click', e => {
      if (!editing) return;
      if (e.target.closest('img')) pickImage('scene');
    });
  }
  if (elFigureBox) {
    elFigureBox.addEventListener('click', e => {
      if (!editing) return;
      if (e.target.closest('img')) pickImage('figure');
    }, true);
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

  /* Q 版 / 原立繪 切换按钮 */
  function updateQToggle() {
    if (!elQToggle) return;
    elQToggle.textContent = qMode ? '原 畫' : 'Q 版';
    elQToggle.classList.toggle('on', qMode);
    elQToggle.setAttribute('aria-pressed', qMode ? 'true' : 'false');
    elQToggle.title = qMode ? '切回原立繪' : '切換成 Q 版形象';
  }

  function toggleQ() {
    qMode = !qMode;
    try { localStorage.setItem(Q_KEY, qMode ? '1' : '0'); } catch (_) {}
    hideBubble();
    updateQToggle();
    if (cur >= 0) setFigure(eff(cur));
  }

  if (elQToggle) {
    elQToggle.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      toggleQ();
    });
  }

  /* 右侧立绘：有 acts 的站用静态图轮播动作；Q 模式显示单张 Q 版 */
  function setFigure(s) {
    if (actTimer) { clearInterval(actTimer); actTimer = null; }
    // 只清图片，保留气泡/切换按钮
    elFigureBox.querySelectorAll('img').forEach(el => el.remove());
    updateQToggle();

    if (qMode) {
      const img = document.createElement('img');
      img.className = 'q-figure on';
      img.src = 'assets/q/' + s.id + '_q.webp';
      img.alt = s.name + ' Q 版';
      img.onerror = () => { img.style.visibility = 'hidden'; };
      elFigureBox.appendChild(img);
      return;
    }

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

  /* 叠加本地编辑：改过的名字、文言、考据、图、对话 */
  function eff(i) {
    const base = ST[i];
    const o = (window.EDITS && window.EDITS.get(base.id)) || {};
    return Object.assign({}, base, {
      name: o.name || base.name,
      text: (o.text && o.text.length) ? o.text : base.text,
      facts: (o.facts && o.facts.length) ? o.facts : base.facts,
      scene: o.scene || null,
      figure: o.figure || null,
      poem: o.poem || null
    });
  }

  /* 页脚主按钮：未过闸时是「蓋印過閘」，过了才变成下一闸 */
  function updateNext(s, i, passed) {
    if (!elNext) return;
    const last = i >= ST.length - 1;
    elNext.textContent = passed ? (last ? '回 總 圖' : '下一閘 →') : '蓋印過閘';
    elNext.classList.toggle('pass-ready', !passed);
    elNext.disabled = false;
    elNext.title = passed
      ? (last ? '回到八閘總圖' : '前往下一閘')
      : '讀完這一閘，按此蓋印過閘';
  }

  function render(i) {
    const s = eff(i);
    elCh.textContent = s.i;
    elName.textContent = s.name;
    elMeta.innerHTML = s.city + ' · ' + s.era + ' · 過閘法「' + s.way + '」' +
      '<em style="background:' + s.color + '"></em>' + s.colorName;

    // 每站主题色
    root.style.setProperty('--accent', s.color);
    root.style.setProperty('--accent-ink', deepInk(s.color));

    const passed = !!(window.LEDGER && window.LEDGER.hasSeen(s.id));

    // 闸簿日历（过闸那天才记一笔）
    renderCheckin(s);

    // 场景图
    const sceneImg = elScene.querySelector('img');
    const sceneCap = elScene.querySelector('figcaption');
    sceneImg.onerror = () => {
      elScene.classList.add('missing');
      sceneImg.removeAttribute('src');
    };
    sceneImg.onload = () => elScene.classList.remove('missing');
    sceneImg.src = s.scene || ('assets/' + s.id + '/scene.jpg');
    sceneImg.alt = s.name + ' 实景';
    sceneCap.textContent = s.name + '　' + s.era;

    // 文言（竖排，逐句成列）
    elVerse.innerHTML = s.text.map(t => '<p>' + t + '</p>').join('');

    // 考据
    elFacts.innerHTML = s.facts.map(f => '<li>' + f + '</li>').join('');

    // 右侧立绘（有 acts 的站自动轮播动作；被换过就显示自定图）
    setFigure(s);

    // 编辑按钮可用性
    if (elEdit) {
      const ok = window.RULES ? window.RULES.editUnlocked() : false;
      elEdit.classList.toggle('locked', !ok);
      elEdit.textContent = editing ? '完 成' : '編 輯';
      elEdit.title = ok ? '編輯這一閘的內容' : '過完八閘後可編輯';
    }
    root.classList.toggle('editing', editing);
    if (editing) enterEditDom();

    // 进度点（已过的填实）
    elTrack.innerHTML = ST.map((x, k) => {
      const seen = window.LEDGER && window.LEDGER.hasSeen(x.id);
      const open = !window.RULES || window.RULES.canOpen(k).ok;
      return '<button class="st-dot' + (k === i ? ' on' : '') + (seen ? ' seen' : '') +
        (open ? '' : ' locked') +
        '" data-i="' + k + '" title="' + x.name + (seen ? ' · 已過閘' : open ? ' · 可入' : ' · 未開') +
        '" aria-label="' + x.name + (seen ? '，已過閘' : open ? '，可入' : '，未開') + '"></button>';
    }).join('');

    // 第几闸 / 共几闸（含自己加的闸）
    if (elSeqn) {
      const extra = window.CUSTOM && window.CUSTOM.list ? window.CUSTOM.list().length : 0;
      elSeqn.textContent = '第 ' + s.i + ' 閘 · 共 ' + cnNum(ST.length + extra) + ' 閘';
      elSeqn.classList.toggle('read', passed);
    }

    updateNext(s, i, passed);

    // 每次进闸都通知地图刷新（已过、下一闸是否解锁）
    document.dispatchEvent(new CustomEvent('seenchange'));

    // 开页动作（每闸一种）
    playOpen(s);

    // 环境声：切到这一闸的声景，并让水声涌一下
    if (window.AMBIENT) {
      window.AMBIENT.setStation(i);
      window.AMBIENT.pulse();
    }

    // 换闸：重置诗句序号；编辑时气泡常开可改，否则收起
    poemIdx = 0;
    if (editing) showPoem(eff(i), true);
    else hideBubble();
  }

  /* 点角色：弹出古诗气泡（编辑时是可改的对话） */
  if (elFigureBox) {
    elFigureBox.addEventListener('click', e => {
      if (!e.target.closest('img')) return;
      const s = eff(cur);
      if (!s) return;
      showPoem(s, editing);
    });
  }

  /* 过闸：盖章、记入闸簿、开下一闸；不再按天签到 */
  function passCurrent() {
    if (passing || cur < 0) return;
    const s = eff(cur);
    if (!s) return;
    if (window.LEDGER && window.LEDGER.hasSeen(s.id)) {
      updateNext(s, cur, true);
      return;
    }

    passing = true;
    if (elNext) elNext.disabled = true;
    if (elPass) {
      elPass.classList.remove('play');
      void elPass.offsetHeight;
      elPass.classList.add('play');
    }

    const rec = window.LEDGER ? window.LEDGER.pass(s.id) : null;
    renderCheckin(s);
    if (elSeqn) elSeqn.classList.add('read');

    const ok = window.RULES ? window.RULES.editUnlocked() : false;
    if (elEdit) {
      elEdit.classList.toggle('locked', !ok);
      elEdit.title = ok ? '編輯這一閘的內容' : '過完八閘後可編輯';
    }

    // 圆点也即时更新：本闸填实、下一闸解锁
    elTrack.querySelectorAll('.st-dot').forEach((dot, k) => {
      const x = ST[k];
      const seen = !!(window.LEDGER && x && window.LEDGER.hasSeen(x.id));
      const open = !window.RULES || window.RULES.canOpen(k).ok;
      dot.classList.toggle('seen', seen);
      dot.classList.toggle('locked', !open);
      dot.title = x.name + (seen ? ' · 已過閘' : open ? ' · 可入' : ' · 未開');
      dot.setAttribute('aria-label', x.name + (seen ? '，已過閘' : open ? '，可入' : '，未開'));
    });

    document.dispatchEvent(new CustomEvent('seenchange'));

    const next = ST[cur + 1];
    if (window.RULES) {
      window.RULES.toast(rec && rec.isNew
        ? '已過閘' + (next ? ' · ' + next.name + ' 已開' : ' · 八閘已通')
        : '這一閘已過');
    }

    clearTimeout(passTimer);
    passTimer = setTimeout(() => {
      if (elNext) updateNext(s, cur, true);
      if (elPass) elPass.classList.remove('play');
      passing = false;
    }, 1900);
  }

  function open(i, push, force) {
    if (i < 0 || i >= ST.length) return;
    /* 正常从总图进入：上一闸没过就拦住。
       深链 / NFC 书签 / 分享链接用 force=true，等同“标签即钥匙”。 */
    if (!force && window.RULES) {
      var r = window.RULES.canOpen(i);
      if (!r.ok) {
        window.RULES.toast('第 ' + ST[i].i + ' 閘尚未開：請先讀完並過「' + r.prevName + '」');
        return;
      }
    }
    cur = i;
    clearTimeout(passTimer);
    passing = false;
    if (elPass) elPass.classList.remove('play');
    render(i);
    const bodyBox = root.querySelector('.st-body');
    if (bodyBox) bodyBox.scrollTop = 0;
    root.classList.add('show');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('st-open');
    if (push !== false) {
      try { history.replaceState(null, '', '#' + ST[i].id); } catch (_) { location.hash = ST[i].id; }
    }
  }

  function close() {
    /* 先把焦点移出要隐藏的 aria-hidden 区域，否则读屏器会报
       “Blocked aria-hidden on a focused element”。 */
    const active = document.activeElement;
    if (active && root.contains(active)) {
      const mapBtn = document.getElementById('roster-btn');
      if (mapBtn && mapBtn.focus) mapBtn.focus({preventScroll: true});
      else if (active.blur) active.blur();
    }
    root.classList.remove('show');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('st-open');
    hideBubble();
    clearTimeout(passTimer);
    passing = false;
    if (elPass) elPass.classList.remove('play');
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
    if (e.target.closest('.st-next')) {
      const s = eff(cur);
      if (!s) return;
      if (!(window.LEDGER && window.LEDGER.hasSeen(s.id))) { passCurrent(); return; }
      if (cur >= ST.length - 1) { close(); return; }
      goStep(1);
      return;
    }
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
    /* force：书签 / 分享链接直达，先让人进闸，过不过由他按「過閘」决定 */
    if (i >= 0) open(i, false, true); else if (root.classList.contains('show')) close();
  });
  const i0 = fromHash();
  if (i0 >= 0) setTimeout(() => open(i0, false, true), 700);
})();
