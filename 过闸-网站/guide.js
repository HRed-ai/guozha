/* 首次进入引导：介绍这套书签/地图在做什么，以及怎么过闸。
   只在总图首次打开时自动出现；书签深链、演示模式不拦。
   关闭后写 localStorage；图例「引導」可随时重看，?guide=1 强制打开。 */
(function () {
  var KEY = 'guozha.guide.v1';
  var stage = document.getElementById('stage');
  var root = document.getElementById('guide');
  var veil = document.getElementById('guide-veil');
  var openBtn = document.getElementById('guide-btn');
  var closeBtn = root && root.querySelector('.guide-close');
  var startBtn = root && root.querySelector('.guide-start');
  var guideBody = root && root.querySelector('.guide-body');
  if (!root || !veil || !openBtn) return;

  var showing = false;

  function hasSeen() {
    try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; }
  }
  function markSeen() {
    try { localStorage.setItem(KEY, '1'); } catch (_) {}
  }

  function shouldAutoOpen() {
    if (/[?&]guide=1/.test(location.search)) return true;
    if (hasSeen()) return false;
    // NFC / 分享深链直接进某一闸时不拦截
    if (/^#s\d{2}$/.test(location.hash)) return false;
    // 演示模式先把全部闸打开
    if (/[?&]unlock=1/.test(location.search)) return false;
    return true;
  }

  function openGuide() {
    if (showing) return;
    showing = true;
    if (stage) stage.inert = true;
    veil.hidden = false;
    root.classList.add('show');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('guide-open');
    if (guideBody) guideBody.scrollTop = 0;
    requestAnimationFrame(function () { veil.classList.add('show'); });
    setTimeout(function () {
      if (startBtn) startBtn.focus({preventScroll: true});
    }, 60);
  }

  function closeGuide() {
    if (!showing) return;
    showing = false;
    root.classList.remove('show');
    root.setAttribute('aria-hidden', 'true');
    veil.classList.remove('show');
    document.body.classList.remove('guide-open');
    if (stage) stage.inert = false;
    markSeen();
    setTimeout(function () {
      if (!showing) veil.hidden = true;
    }, 260);
    if (openBtn && openBtn.focus) openBtn.focus({preventScroll: true});
  }

  openBtn.addEventListener('click', function () {
    if (showing) closeGuide(); else openGuide();
  });
  if (closeBtn) closeBtn.addEventListener('click', closeGuide);
  if (startBtn) startBtn.addEventListener('click', closeGuide);
  veil.addEventListener('click', closeGuide);

  document.addEventListener('keydown', function (e) {
    if (!showing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeGuide();
      return;
    }
    if (e.key !== 'Tab') return;
    // 面板里只有「关闭」和「开始」两个可聚焦点
    var first = closeBtn, last = startBtn;
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  if (shouldAutoOpen()) {
    setTimeout(openGuide, 420);
  }
})();
