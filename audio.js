/* 过闸 · 环境声（全部现场合成，零音频文件）
   三层：水流底噪 / 水滴 / 稀疏拨弦
   浏览器禁止自动播放，所以必须用户点一下才启动。 */
(function () {
  var KEY = 'guozha.sound';
  var ctx = null, master = null, noiseSrc = null, lp = null, airGain = null;
  var lfo = null, lfoGain = null;
  var on = false, vol = 0.45;
  var VOL_MAX = 0.95, VOL_MIN = 0.08, VOL_STEP = 0.06;
  var tDrop = null, tPluck = null;

  /* 每闸的声景参数：截止频率 / 空气感 / 水滴间隔(ms) / 拨弦间隔(ms) */
  var SCENE = [
    { cut: 520, air: 0.04, drop: [12000, 26000], pluck: [30000, 70000] },  // 一 澄清：安静
    { cut: 700, air: 0.07, drop: [9000, 20000], pluck: [26000, 60000] },   // 二 九宣：木闸
    { cut: 820, air: 0.10, drop: [5000, 12000], pluck: [30000, 80000] },   // 三 谢家坝：水漫，多水声
    { cut: 460, air: 0.03, drop: [14000, 30000], pluck: [24000, 52000] },  // 四 荆门：石闸，闷
    { cut: 640, air: 0.06, drop: [7000, 16000], pluck: [22000, 52000] },   // 五 南旺：分流
    { cut: 420, air: 0.05, drop: [16000, 34000], pluck: [26000, 60000] },  // 六 清江：闸槽，低
    { cut: 700, air: 0.09, drop: [10000, 22000], pluck: [20000, 48000] },  // 七 邵伯：堤柳
    { cut: 380, air: 0.12, drop: [18000, 38000], pluck: [32000, 76000] }   // 八 龙山：潮，低而重
  ];
  var scene = SCENE[0];

  function ctxNow() { return ctx ? ctx.currentTime : 0; }

  /* ---------- 棕噪：循环无缝 ---------- */
  function brownBuffer(sec) {
    var sr = ctx.sampleRate, n = Math.floor(sr * sec);
    var fade = Math.floor(sr * 0.35);
    var total = n + fade;
    var raw = new Float32Array(total);
    var last = 0;
    for (var i = 0; i < total; i++) {
      var w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      raw[i] = last * 3.1;
    }
    /* 尾部与头部交叉淡化，接缝听不出来 */
    for (var k = 0; k < fade; k++) {
      var t = k / fade;
      raw[n + k] = raw[n + k] * (1 - t) + raw[k] * t;
    }
    var buf = ctx.createBuffer(1, n, sr);
    buf.copyToChannel(raw.subarray(0, n), 0);
    return buf;
  }

  function build() {
    master = ctx.createGain();
    master.gain.value = 0;

    /* 限幅器：音量拉高也不会爆 */
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 14;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    master.connect(comp);
    comp.connect(ctx.destination);

    /* 底噪 → 低通 → 主输出 */
    lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = scene.cut;
    lp.Q.value = 0.6;

    var hp = ctx.createBiquadFilter();       /* 去掉过低的轰隆 */
    hp.type = 'highpass';
    hp.frequency.value = 60;

    airGain = ctx.createGain();
    airGain.gain.value = scene.air * 2.0;

    noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = brownBuffer(8);
    noiseSrc.loop = true;

    var noiseGain = ctx.createGain();
    noiseGain.gain.value = 1.45;

    noiseSrc.connect(hp);
    hp.connect(lp);
    lp.connect(noiseGain);
    noiseGain.connect(master);

    /* 一层极轻的高频“空气”，让水声不闷 */
    var air = ctx.createBufferSource();
    air.buffer = noiseSrc.buffer;
    air.loop = true;
    var aLp = ctx.createBiquadFilter();
    aLp.type = 'bandpass';
    aLp.frequency.value = 2400;
    aLp.Q.value = 0.5;
    air.connect(aLp);
    aLp.connect(airGain);
    airGain.connect(master);

    noiseSrc.start(0);
    air.start(0);

    /* 慢速扫动：0.05Hz，±180Hz，像水在动 */
    lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);
    lfo.start(0);
  }

  /* ---------- 水滴 ---------- */
  function drop() {
    if (!on) return;
    var t = ctxNow();
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    var f = 700 + Math.random() * 520;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.34, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.34, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.32);
  }

  /* ---------- 拨弦（Karplus-Strong） ---------- */
  var SCALE = [146.83, 164.81, 196.00, 220.00, 246.94, 293.66, 329.63, 392.00];

  function pluckBuffer(freq, sec) {
    var sr = ctx.sampleRate;
    var N = Math.max(2, Math.round(sr / freq));
    var n = Math.round(sr * sec);
    var out = new Float32Array(n);
    var ring = new Float32Array(N);
    for (var i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    var idx = 0, prev = 0;
    for (var j = 0; j < n; j++) {
      var cur = ring[idx];
      out[j] = cur;
      var nv = 0.5 * (cur + prev) * 0.9975;   /* 平均 + 轻微衰减 */
      ring[idx] = nv;
      prev = cur;
      idx = (idx + 1) % N;
    }
    var buf = ctx.createBuffer(1, n, sr);
    buf.copyToChannel(out, 0);
    return buf;
  }

  function pluck() {
    if (!on) return;
    var f = SCALE[Math.floor(Math.random() * SCALE.length)];
    var sec = 5.5;
    var src = ctx.createBufferSource();
    src.buffer = pluckBuffer(f, sec);
    var g = ctx.createGain();
    var t = ctxNow();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + sec * 0.85);
    src.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + sec);
  }

  /* ---------- 排程 ---------- */
  function rnd(a) { return a[0] + Math.random() * (a[1] - a[0]); }

  function schedule() {
    clearTimeout(tDrop); clearTimeout(tPluck);
    tDrop = setTimeout(function () {
      drop();
      if (on) scheduleDrop();
    }, rnd(scene.drop));
    tPluck = setTimeout(function () {
      pluck();
      if (on) schedulePluck();
    }, rnd(scene.pluck));
  }
  function scheduleDrop() {
    clearTimeout(tDrop);
    tDrop = setTimeout(function () { drop(); if (on) scheduleDrop(); }, rnd(scene.drop));
  }
  function schedulePluck() {
    clearTimeout(tPluck);
    tPluck = setTimeout(function () { pluck(); if (on) schedulePluck(); }, rnd(scene.pluck));
  }

  function fadeTo(v, sec) {
    if (!master) return;
    var t = ctxNow();
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
    master.gain.linearRampToValueAtTime(v, t + sec);
  }

  /* ---------- 开关 ---------- */
  function start() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { window.RULES && window.RULES.toast('這個瀏覽器不支援環境聲'); return false; }
      ctx = new AC();
      build();
    }
    if (ctx.state === 'suspended') ctx.resume();
    on = true;
    fadeTo(vol, 2.0);
    schedule();
    return true;
  }

  function stop() {
    on = false;
    clearTimeout(tDrop); clearTimeout(tPluck);
    fadeTo(0.0001, 0.8);
    setTimeout(function () { if (!on && ctx && ctx.state === 'running') ctx.suspend(); }, 900);
  }

  function toggle() {
    if (!on) {
      if (start()) { save(true); paint(); }
    } else {
      stop(); save(false); paint();
    }
  }

  /* ---------- 界面 ---------- */
  var btn = null;
  function paint() {
    if (!btn) return;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.title = on ? '關閉環境聲（滾輪調音量）' : '開啟環境聲';
    btn.textContent = on ? '聲' : '静';
  }

  function save(v) {
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (_) {}
  }

  function mount() {
    btn = document.getElementById('snd');
    if (!btn) return;
    btn.addEventListener('click', toggle);
    btn.addEventListener('wheel', function (e) {
      e.preventDefault();
      vol = Math.min(VOL_MAX, Math.max(VOL_MIN, vol + (e.deltaY < 0 ? VOL_STEP : -VOL_STEP)));
      if (on) fadeTo(vol, 0.2);
      window.RULES && window.RULES.toast('音量 ' + Math.round(vol / VOL_MAX * 100) + '%');
    }, { passive: false });
    paint();

    /* 上次开着：等用户第一次碰页面就接着放（浏览器不许自动播） */
    var want = false;
    try { want = localStorage.getItem(KEY) === '1'; } catch (_) {}
    if (want) {
      btn.classList.add('armed');
      btn.title = '點一下頁面繼續播放環境聲';
      var arm = function () {
        document.removeEventListener('pointerdown', arm, true);
        document.removeEventListener('keydown', arm, true);
        btn.classList.remove('armed');
        if (!on) { if (start()) { save(true); paint(); } }
      };
      document.addEventListener('pointerdown', arm, true);
      document.addEventListener('keydown', arm, true);
    }
  }

  /* 切页面时暂停，回来接着放 */
  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) { if (ctx.state === 'running') ctx.suspend(); }
    else if (on && ctx.state === 'suspended') ctx.resume();
  });

  window.AMBIENT = {
    toggle: toggle,
    isOn: function () { return on; },
    /* 切换闸口：换一套声景参数 */
    setStation: function (i) {
      scene = SCENE[((i % SCENE.length) + SCENE.length) % SCENE.length];
      if (!ctx) return;
      var t = ctxNow();
      lp.frequency.cancelScheduledValues(t);
      lp.frequency.setTargetAtTime(scene.cut, t, 0.8);
      lfoGain.gain.setTargetAtTime(scene.cut * 0.30, t, 0.8);
      airGain.gain.setTargetAtTime(scene.air * 2.0, t, 0.8);
      if (on) scheduleDrop(), schedulePluck();
    },
    /* 开闸那一下：水声涌起 */
    pulse: function () {
      if (!on || !ctx) return;
      var t = ctxNow();
      lp.frequency.cancelScheduledValues(t);
      lp.frequency.setTargetAtTime(scene.cut * 1.7, t, 0.25);
      setTimeout(function () {
        if (ctx) lp.frequency.setTargetAtTime(scene.cut, ctxNow(), 0.9);
      }, 1200);
      drop();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
