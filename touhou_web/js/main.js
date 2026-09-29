/* =========================================================
   三一 SANY Project · 网页版游戏界面
   - 视频导入 / 拉伸 / 裁剪
   - 灵梦自机拖动
   - HUD 数值动起来
   ========================================================= */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);

  const frame    = $('#frame');
  const playfield= $('#playfield');
  const video    = $('#video');
  const tools    = $('#tools');
  const fileInput= $('#fileInput');
  const reimu    = $('#reimu');
  const stageTitle = $('#stageTitle');
  const bgmLine  = $('#bgmLine');

  const DEFAULT_SRC = 'assets/spark.mp4';   // 想固定用某个视频，把它放这儿

  /* ================= 小提示 ================= */
  const toastEl = $('#toast');
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3400);
  }

  /* ================= 缩放：1em = 框高/67.5 ================= */
  const fitFrame = () => {
    const h = frame.getBoundingClientRect().height || 1080;
    frame.style.fontSize = (h / 67.5).toFixed(3) + 'px';
  };
  fitFrame();
  new ResizeObserver(fitFrame).observe(frame);
  window.addEventListener('resize', fitFrame);

  /* ================= HUD：填充心 / 星 ================= */
  const LIVES_MAX = 8, SPELL_MAX = 8;

  const fillIcons = (host, on, max, onSrc, offSrc) => {
    host.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const img = document.createElement('img');
      img.src = i < on ? onSrc : offSrc;
      if (i >= on) img.classList.add('empty');
      img.alt = '';
      host.appendChild(img);
    }
  };
  let lives = 2;
  const renderLives = () => fillIcons($('#lives'), lives, LIVES_MAX, 'assets/heart.png', 'assets/heart_empty.png');
  renderLives();
  fillIcons($('#spells'), 3, SPELL_MAX, 'assets/star.png', 'assets/star_empty.png');

  /* ================= HUD：数字 ================= */
  // 补零 + 千分位，做出「0,001,521,830」这种原作味
  const pad = (n, width) => {
    let s = String(Math.max(0, Math.floor(n))).padStart(width, '0');
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const el = {
    hiscore: $('#hiscore'), score: $('#score'), point: $('#point'),
    graze: $('#graze'), voltage: $('#voltage'), fps: $('#fps'),
    power: $('#power'), frag: $('#frag'),
  };

  el.hiscore.textContent = pad(114514, 10);
  el.point.textContent   = pad(10000, 6);
  el.power.textContent   = '1.00';
  el.frag.textContent    = '0';

  let score = 0, graze = 0;
  let acc = 0, volAcc = 0, fpsVal = 56.45, last = performance.now();

  const loop = (now) => {
    const dt = Math.min(200, now - last);
    last = now;

    // 分数 / 擦弹：小步慢涨，看起来像真的在打
    acc += dt;
    if (acc > 120) {
      acc = 0;
      score += 200 + Math.floor(Math.random() * 1000);
      el.score.textContent = pad(score, 10);
      graze += raining ? 40 : 1 + Math.floor(Math.random() * 4);
      el.graze.textContent = pad(graze, 6);
    }

    // 电压：30 秒一个缓慢充能循环
    volAcc += dt / 1000;
    const v = 25 - 25 * Math.cos(volAcc / 30 * Math.PI * 2);
    el.voltage.textContent = pad(v, 4) + 'V';

    // fps：飘一飘
    fpsVal += ((56.2 + Math.sin(now / 610) * 2.1 + (Math.random() - .5) * .9) - fpsVal) * .08;
    el.fps.textContent = fpsVal.toFixed(2);

    updateDrops(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  /* ================= 关卡标题 / BGM 条 ================= */
  let titleT = null, bgmT = null;
  const showTitle = () => {
    stageTitle.classList.remove('gone');
    clearTimeout(titleT);
    titleT = setTimeout(() => stageTitle.classList.add('gone'), 4200);
  };
  const showBgm = () => {
    bgmLine.classList.remove('gone');
    clearTimeout(bgmT);
    bgmT = setTimeout(() => bgmLine.classList.add('gone'), 9000);
  };
  showTitle();
  setTimeout(showBgm, 1500);

  /* ================= 视频：状态 ================= */
  const FIT_MODES = [
    { key: 'cover',   label: '铺满' },
    { key: 'contain', label: '适应' },
    { key: 'fill',    label: '拉伸' },
  ];
  const view = { fit: 0, sx: 1, sy: 1, ox: 0, oy: 0 };

  const rScaleX = $('#rScaleX'), rScaleY = $('#rScaleY'), rOffX = $('#rOffX'), rOffY = $('#rOffY');
  const vScaleX = $('#vScaleX'), vScaleY = $('#vScaleY'), vOffX = $('#vOffX'), vOffY = $('#vOffY');

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function applyView() {
    video.style.objectFit = FIT_MODES[view.fit].key;
    video.style.setProperty('--sx', view.sx);
    video.style.setProperty('--sy', view.sy);
    video.style.setProperty('--ox', view.ox + '%');
    video.style.setProperty('--oy', view.oy + '%');

    rScaleX.value = Math.round(view.sx * 100); vScaleX.textContent = Math.round(view.sx * 100) + '%';
    rScaleY.value = Math.round(view.sy * 100); vScaleY.textContent = Math.round(view.sy * 100) + '%';
    rOffX.value   = Math.round(view.ox);       vOffX.textContent   = Math.round(view.ox) + '%';
    rOffY.value   = Math.round(view.oy);       vOffY.textContent   = Math.round(view.oy) + '%';
    $('#btnFit').textContent = FIT_MODES[view.fit].label;
  }

  const resetView = () => {
    view.fit = 0; view.sx = 1; view.sy = 1; view.ox = 0; view.oy = 0;
    applyView();
  };

  /* ================= 视频：导入 ================= */
  let objURL = null;

  // 页面内任何图片/视频都不许被原生拖走
  document.addEventListener('dragstart', (e) => {
    if (e.target && /^(IMG|VIDEO)$/.test(e.target.tagName)) e.preventDefault();
  });

  function loadFile(file) {
    if (!file) return;
    if (!/^video\//.test(file.type)) {
      toast('这个不是视频文件：' + file.name);
      return;
    }
    if (objURL) URL.revokeObjectURL(objURL);
    objURL = URL.createObjectURL(file);
    playSrc(objURL);
  }

  function playSrc(src) {
    video.src = src;
    video.loop = true;
    video.muted = muteBtn.dataset.muted !== 'false';
    video.play().catch(() => {});
    playfield.classList.add('has-video');
    resetView();
  }

  $('#btnImport').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    loadFile(fileInput.files && fileInput.files[0]);
    fileInput.value = '';
  });

  // 拖进来（只认真正的文件，页面内拖元素不算）
  const isFileDrag = (e) => !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files'));

  ['dragenter', 'dragover'].forEach((t) =>
    playfield.addEventListener(t, (e) => {
      e.preventDefault();
      if (isFileDrag(e)) playfield.classList.add('dropping');
    })
  );
  ['dragleave', 'drop'].forEach((t) =>
    playfield.addEventListener(t, (e) => {
      e.preventDefault();
      if (t === 'dragleave' && playfield.contains(e.relatedTarget)) return;
      playfield.classList.remove('dropping');
    })
  );
  playfield.addEventListener('drop', (e) => {
    if (!isFileDrag(e)) return;
    loadFile(e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  /* ================= 视频：播放 / 声音 ================= */
  const playBtn = $('#btnPlay'), muteBtn = $('#btnMute');
  muteBtn.dataset.muted = 'true';

  playBtn.addEventListener('click', () => {
    if (video.paused) video.play().catch(() => {}); else video.pause();
  });
  video.addEventListener('play',  () => { playBtn.textContent = '❚❚'; });
  video.addEventListener('pause', () => { playBtn.textContent = '▶'; });

  muteBtn.addEventListener('click', () => {
    const m = muteBtn.dataset.muted !== 'false';
    muteBtn.dataset.muted = String(!m);
    video.muted = !m;
    muteBtn.textContent = !m ? '🔇' : '🔊';
  });

  /* ================= 视频：填充 / 缩放 / 平移 ================= */
  $('#btnFit').addEventListener('click', () => {
    view.fit = (view.fit + 1) % FIT_MODES.length;
    applyView();
  });
  $('#btnReset').addEventListener('click', resetView);

  rScaleX.addEventListener('input', () => { view.sx = rScaleX.value / 100; applyView(); });
  rScaleY.addEventListener('input', () => { view.sy = rScaleY.value / 100; applyView(); });
  rOffX.addEventListener('input',  () => { view.ox = +rOffX.value; applyView(); });
  rOffY.addEventListener('input',  () => { view.oy = +rOffY.value; applyView(); });

  // 滚轮缩放
  playfield.addEventListener('wheel', (e) => {
    if (!playfield.classList.contains('has-video')) return;
    e.preventDefault();
    const k = e.deltaY < 0 ? 1.06 : 1 / 1.06;
    view.sx = clamp(view.sx * k, 0.2, 4);
    view.sy = clamp(view.sy * k, 0.2, 4);
    applyView();
  }, { passive: false });

  // 拖动平移（裁掉不要的部分）—— 拖灵梦不算
  let panning = null;
  playfield.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#reimu') || e.target.closest('#tools')) return;
    if (!playfield.classList.contains('has-video')) return;
    panning = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy, gotX: false, gotY: false, dx: 0, dy: 0 };
    playfield.classList.add('dragging');
    try { playfield.setPointerCapture(e.pointerId); } catch (_) {}
  });
  playfield.addEventListener('pointermove', (e) => {
    if (!panning) return;
    const r = playfield.getBoundingClientRect();
    panning.dx = e.clientX - panning.x;
    panning.dy = e.clientY - panning.y;
    view.ox = clamp(panning.ox + panning.dx / r.width * 100, -100, 100);
    view.oy = clamp(panning.oy + panning.dy / r.height * 100, -100, 100);
    if (Math.abs(view.ox - panning.ox) > 0.02) panning.gotX = true;
    if (Math.abs(view.oy - panning.oy) > 0.02) panning.gotY = true;
    applyView();
  });
  const endPan = () => {
    if (panning) {
      // 画面已经顶到头了：告诉用户为什么拖不动
      const stuckY = !panning.gotY && Math.abs(panning.dy) > 18;
      const stuckX = !panning.gotX && Math.abs(panning.dx) > 18;
      if (stuckY || stuckX) {
        toast(`${stuckX ? '左右' : ''}${stuckX && stuckY ? '和' : ''}${stuckY ? '上下' : ''}` +
              '方向没有多余画面可裁 —— 先在游戏区滚一下滚轮放大（或把「宽 / 高」调大）');
      }
    }
    panning = null;
    playfield.classList.remove('dragging');
  };
  playfield.addEventListener('pointerup', endPan);
  playfield.addEventListener('pointercancel', endPan);

  /* ================= 灵梦：上下左右都能走 ================= */
  const REIMU_X = [5, 95];    // left 百分比范围
  const REIMU_Y = [4, 86];    // bottom 百分比范围（阴阳玉挂在脚下，别让她贴到边）
  let reimuDrag = false;

  const moveReimu = (clientX, clientY) => {
    const r = playfield.getBoundingClientRect();
    reimu.style.left   = clamp((clientX - r.left) / r.width * 100, REIMU_X[0], REIMU_X[1]) + '%';
    reimu.style.bottom = clamp((r.bottom - clientY) / r.height * 100, REIMU_Y[0], REIMU_Y[1]) + '%';
  };
  reimu.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    reimuDrag = true;
    try { reimu.setPointerCapture(e.pointerId); } catch (_) {}
  });
  reimu.addEventListener('pointermove', (e) => {
    if (reimuDrag) moveReimu(e.clientX, e.clientY);
  });
  ['pointerup', 'pointercancel'].forEach((t) =>
    reimu.addEventListener(t, () => { reimuDrag = false; })
  );

  /* ================= 特效工具 ================= */
  const fxLayer = $('#fx');
  const pfRect  = () => playfield.getBoundingClientRect();
  const pfShort = () => Math.min(pfRect().width, pfRect().height);
  const BULLETS = ['ball', 'bigball', 'rice', 'star', 'crystal', 'ofuda'].map((n) => `assets/bullet-${n}.png`);

  // 自机中心在游戏区里的百分比坐标
  const reimuCenter = () => {
    const r = pfRect(), b = reimu.getBoundingClientRect();
    return {
      x: (b.left + b.width / 2 - r.left) / r.width * 100,
      y: (b.top + b.height / 2 - r.top) / r.height * 100,
    };
  };

  function addFx(src, cx, cy, sizePx, dur, cls) {
    const el = document.createElement('img');
    el.src = src;
    el.className = 'fx-item ' + cls;
    el.style.left = cx + '%';
    el.style.top = cy + '%';
    el.style.width = sizePx + 'px';
    el.style.setProperty('--dur', dur + 'ms');
    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), dur + 90);
  }

  /* ================= 效果 1：自爆（照 Taisei 的 player_death 实现） =================
     原作时间轴：死 → 12 帧画面特效 → 自机被拉没 → 从画面下方飞回来（60 帧）→ 无敌 210 帧
     ================================================================================ */
  const DEATHBOMB_WINDOW = 200;    // 12 帧 @60fps
  const RESPAWN_TIME     = 1000;   // 60 帧
  const RECOVERY_TIME    = 3500;   // 210 帧
  let dying = false;

  // 自机被拉没之后，周围炸出一圈小爆
  function blastspam(cx, cy) {
    const r = pfRect(), s = pfShort();
    for (let i = 0; i < 12; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = s * (0.02 + Math.random() * 0.014);      // 2~3 个游戏单位
      const dur = 170 + Math.random() * 70;                // 10~14 帧
      const el = document.createElement('img');
      el.src = 'assets/fx-blast.png';
      el.className = 'fx-item fx-spam';
      el.style.left = (cx + Math.cos(ang) * rad / r.width * 100) + '%';
      el.style.top  = (cy + Math.sin(ang) * rad / r.height * 100) + '%';
      el.style.width = (s * 0.16) + 'px';
      el.style.setProperty('--dur', dur + 'ms');
      fxLayer.appendChild(el);
      setTimeout(() => el.remove(), dur + 90);
    }
  }

  function die() {
    if (dying) return;
    dying = true;

    const { x, y } = reimuCenter();
    const s    = pfShort();
    const r    = pfRect();
    const diag = Math.hypot(r.width, r.height);

    // 1) 60 颗 flare 往外飞，一边飞一边缩（40 帧）
    for (let i = 0; i < 60; i++) {
      const ang  = Math.random() * Math.PI * 2;
      const dist = diag * (0.16 + Math.random() * 0.40);
      const dur  = 620 + Math.random() * 120;
      const el = document.createElement('img');
      el.src = 'assets/fx-flare.png';
      el.className = 'fx-item fx-flare-die';
      el.style.left = x + '%';
      el.style.top  = y + '%';
      el.style.width = (s * 0.05) + 'px';
      el.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      el.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      el.style.setProperty('--dur', dur + 'ms');
      fxLayer.appendChild(el);
      setTimeout(() => el.remove(), dur + 90);
    }

    // 2) 深红冲击波，0 → 3.4 倍（35 帧）
    addFx('assets/fx-blast.png', x, y, s, 580, 'fx-blast-die');

    // 3) 橙色大光环，从 5 倍往里缩（deathbomb 窗口 12 帧）
    addFx('assets/fx-blast.png', x, y, s * 1.2, DEATHBOMB_WINDOW, 'fx-halo-die');

    // 4) 画面：整块游戏区反色 + 5 条圆弧从死亡点扩出去，1.5 秒（原作 90 帧）
    playfield.classList.add('inverting');
    setTimeout(() => playfield.classList.remove('inverting'), 1500);

    const df = $('#df');
    df.style.setProperty('--dx', x + '%');
    df.style.setProperty('--dy', y + '%');
    df.classList.remove('on');
    void df.offsetWidth;
    df.classList.add('on');
    setTimeout(() => df.classList.remove('on'), 1600);

    // 4.5) 掉 P 点（原作 player_realdeath 里的 spawn_items(ITEM_POWER)）
    for (let i = 0; i < 6; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = diag * (0.10 + Math.random() * 0.22);
      const dur = 900 + Math.random() * 400;
      const el = document.createElement('img');
      el.src = 'assets/power.png';
      el.className = 'fx-item fx-item-drop';
      el.style.left = x + '%';
      el.style.top  = y + '%';
      el.style.width = (s * 0.055) + 'px';
      el.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      el.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      el.style.setProperty('--dur', dur + 'ms');
      fxLayer.appendChild(el);
      setTimeout(() => el.remove(), dur + 90);
    }

    // 5) 自机被拉成竖条消失（38 帧）——原作里这是独立的粒子，跟复活互不干扰
    const box = reimu.getBoundingClientRect();
    const clone = document.createElement('div');
    clone.className = 'fx-item death-sprite';
    clone.style.left = ((box.left + box.width / 2 - r.left) / r.width * 100) + '%';
    clone.style.top  = ((box.top + box.height / 2 - r.top) / r.height * 100) + '%';
    clone.style.width  = box.width + 'px';
    clone.style.height = box.height + 'px';
    fxLayer.appendChild(clone);
    setTimeout(() => clone.remove(), 720);
    reimu.classList.add('gone');                       // 本体立刻藏起来
    setTimeout(() => blastspam(x, y), 630);            // 拉条拉完，周围炸一圈小爆

    // 6) 12 帧后才是「真死」：掉命，然后从画面下方飞回来
    setTimeout(() => {
      lives -= 1;
      if (lives < 0) { lives = 2; toast('续关！剩余人数补满'); }
      renderLives();

      reimu.classList.remove('gone');
      reimu.style.left = '50%';
      reimu.classList.add('rising');

      setTimeout(() => {
        reimu.classList.remove('rising');
        reimu.classList.add('invul');
        setTimeout(() => reimu.classList.remove('invul'), RECOVERY_TIME);
        dying = false;
      }, RESPAWN_TIME);
    }, DEATHBOMB_WINDOW);
  }

  /* ================= 效果 2：STAGE 提示 ================= */
  const showStage = () => { showTitle(); showBgm(); };

  /* ================= 效果 3：符卡宣言 ================= */
  const SPELL_NAMES = [
    '工符「MASTER FIRE SPARK」',
    '焊符「二氧化碳保护焊」',
    '切符「氧乙炔气体切割」',
    '熔符「氩弧焊·TIG」',
    '工符「全自动焊接机器人」',
    '安全符「护目镜与皮手套」',
    '起弧「焊条与地线夹」',
    '火花符「飞溅烧穿工装裤」',
  ];
  let spellCountdown = null;
  function castSpell() {
    const sp = $('#spell');
    $('#spellName').textContent = SPELL_NAMES[(Math.random() * SPELL_NAMES.length) | 0];

    sp.classList.remove('on');
    void sp.offsetWidth;            // 强制重排，让动画能重复播
    sp.classList.add('on');

    let t = 50;
    $('#spellTimer').textContent = t;
    clearInterval(spellCountdown);
    spellCountdown = setInterval(() => {
      t -= 1;
      $('#spellTimer').textContent = Math.max(0, t);
      if (t <= 0) clearInterval(spellCountdown);
    }, 50);

    setTimeout(() => sp.classList.remove('on'), 2700);
  }

  /* ================= 效果 4：Boss 弹幕雨 ================= */
  let raining = false;
  function spawnBullet() {
    const r = pfRect(), s = Math.min(r.width, r.height);
    const img = document.createElement('img');
    img.src = BULLETS[(Math.random() * BULLETS.length) | 0];
    img.className = 'fx-item fx-bullet';
    img.style.left = (3 + Math.random() * 94) + '%';
    img.style.top = '-8%';
    img.style.width = (s * (.028 + Math.random() * .018)) + 'px';
    img.style.setProperty('--dx', ((Math.random() - .5) * .18 * r.width).toFixed(0) + 'px');
    img.style.setProperty('--dy', (r.height * 1.25).toFixed(0) + 'px');
    img.style.setProperty('--rot', ((Math.random() * 480 - 240) | 0) + 'deg');
    const dur = 1500 + Math.random() * 1500;
    img.style.setProperty('--dur', dur + 'ms');
    fxLayer.appendChild(img);
    setTimeout(() => img.remove(), dur + 90);
  }

  function danmakuRain() {
    if (raining) return;
    raining = true;

    const warn = $('#warn');
    warn.classList.remove('on');
    void warn.offsetWidth;
    warn.classList.add('on');
    setTimeout(() => warn.classList.remove('on'), 1300);

    // 立刻先撒一把，手感别等
    for (let i = 0; i < 5; i++) spawnBullet();

    let waves = 0;
    const timer = setInterval(() => {
      const n = Math.random() < .65 ? 1 : 2;
      for (let i = 0; i < n; i++) spawnBullet();
      if (++waves > 38) clearInterval(timer);
    }, 70);

    setTimeout(() => { raining = false; }, 4400);
  }

  $('#btnDie').addEventListener('click', die);
  $('#btnStage').addEventListener('click', showStage);
  $('#btnSpell').addEventListener('click', castSpell);
  $('#btnRain').addEventListener('click', danmakuRain);
  // 点完按钮别让它抢键盘焦点，不然空格会重新点它
  tools.addEventListener('click', (e) => {
    const b = e.target.closest('.btn');
    if (b) b.blur();
  });

  /* ================= Z：自机连射（按着不放就一直打） ================= */
  let shotTimer = null;
  const SHOT_INTERVAL = 85;      // ms，约 5 帧一发

  // 打枪时会从上方随机掉 P 点 / 学分，掉到自机边上会被吸走
  const drops = [];
  let powerVal = 1.00, pointVal = 10000;

  function spawnDrop(kind) {
    const r = pfRect();
    const s = pfShort();
    const el = document.createElement('img');
    el.src = kind === 'power' ? 'assets/power.png' : 'assets/point.png';
    el.className = 'drop-item';
    el.style.width = (s * 0.046) + 'px';
    fxLayer.appendChild(el);
    drops.push({
      el, kind,
      x: (0.06 + Math.random() * 0.88) * r.width,
      y: -s * 0.08,
      vx: (Math.random() - .5) * s * 0.05,
      vy: s * (0.15 + Math.random() * 0.10),
      t: Math.random() * 6,
      homing: false,
    });
  }

  function collectDrop(d) {
    const r = pfRect(), s = pfShort();
    if (d.kind === 'power') {
      powerVal = Math.min(4.00, powerVal + 0.05);
      el.power.textContent = powerVal.toFixed(2);
    } else {
      pointVal += 100;
      el.point.textContent = pad(pointVal, 6);
    }
    addFx('assets/fx-flare.png', d.x / r.width * 100, d.y / r.height * 100, s * 0.10, 320, 'fx-pickup');
    d.el.remove();
  }

  const s_lerp = (a, b, t) => a + (b - a) * t;

  function updateDrops(dt) {
    if (!drops.length) return;
    const r = pfRect();
    const rb = reimu.getBoundingClientRect();
    const rx = rb.left + rb.width / 2 - r.left;
    const ry = rb.top + rb.height * 0.35 - r.top;      // 吸到自机上半身
    const dts = Math.min(dt, 60) / 1000;

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];

      if (!d.homing) {
        const dist = Math.hypot(rx - d.x, ry - d.y);
        if (dist < r.width * 0.15) d.homing = true;     // 进入收点范围
      }

      if (d.homing) {
        const dx = rx - d.x, dy = ry - d.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const sp = s_lerp(420, 1150, 1 - Math.min(1, dist / (r.width * 0.15)));
        d.x += dx / dist * sp * dts;
        d.y += dy / dist * sp * dts;
        if (dist < r.width * 0.035) { collectDrop(d); drops.splice(i, 1); continue; }
      } else {
        d.t += dts;
        d.x += (d.vx + Math.sin(d.t * 3.2) * Math.abs(d.vx) * 3) * dts;
        d.y += d.vy * dts;
        if (d.y > r.height * 1.06) {                    // 掉出画面
          d.el.remove();
          drops.splice(i, 1);
          continue;
        }
      }

      d.el.style.transform = `translate3d(${d.x}px, ${d.y}px, 0) translate(-50%, -50%)`;
    }
  }

  function fireVolley() {
    if (dying) return;
    const r = pfRect();
    const b = reimu.getBoundingClientRect();
    const cx = (b.left + b.width / 2 - r.left) / r.width * 100;
    const cy = (b.top - r.top) / r.height * 100;         // 从头顶冒出来
    const spread = b.width * 0.34;

    [-1, 1].forEach((side) => {
      const el = document.createElement('img');
      el.src = 'assets/bullet-ofuda.png';
      el.className = 'fx-item shot';
      el.style.left = (cx + side * spread / r.width * 100) + '%';
      el.style.top  = cy + '%';
      el.style.width = (r.width * 0.034) + 'px';
      el.style.setProperty('--dx', (side * r.width * 0.014) + 'px');
      el.style.setProperty('--dy', (-r.height * 1.06) + 'px');
      el.style.setProperty('--dur', '820ms');
      fxLayer.appendChild(el);
      setTimeout(() => el.remove(), 910);
    });

    // 一边打一边从上面掉点东西
    if (Math.random() < 0.15) spawnDrop(Math.random() < 0.6 ? 'power' : 'point');
  }

  function startShooting() {
    if (shotTimer) return;
    fireVolley();
    shotTimer = setInterval(fireVolley, SHOT_INTERVAL);
  }
  function stopShooting() {
    clearInterval(shotTimer);
    shotTimer = null;
  }

  /* ================= 控制条：自动隐藏 / 固定 ================= */
  let pinned = false, hideTimer = null, lastPoke = 0;
  const pokeTools = () => {
    tools.classList.remove('hidden');
    clearTimeout(hideTimer);
    if (!pinned) hideTimer = setTimeout(() => tools.classList.add('hidden'), 4000);
  };
  playfield.addEventListener('pointermove', () => {
    const now = performance.now();
    if (now - lastPoke > 400) { lastPoke = now; pokeTools(); }
  });
  $('#btnPin').addEventListener('click', () => {
    pinned = !pinned;
    $('#btnPin').classList.toggle('on', pinned);
    if (pinned) { clearTimeout(hideTimer); tools.classList.remove('hidden'); }
    else pokeTools();
  });
  pokeTools();

  /* ================= 键盘 ================= */
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const tag = t && t.tagName;
    const isRange = tag === 'INPUT' && t.type === 'range';
    // 输入框里打字时别抢键；滑块的方向键留给滑块自己
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && !isRange)) return;

    const key = e.key.toLowerCase();
    if (isRange && key.startsWith('arrow')) return;

    switch (key) {
      case 'h':
        pinned = !pinned;
        $('#btnPin').classList.toggle('on', pinned);
        if (pinned) { clearTimeout(hideTimer); tools.classList.remove('hidden'); }
        else pokeTools();
        break;
      case '1': case 'x': die(); break;
      case '2': case 't': showStage(); break;
      case '3': case 'c': castSpell(); break;
      case '4': case 'b': danmakuRain(); break;
      case 'z': startShooting(); break;
      case ' ':
        e.preventDefault();
        if (video.paused) video.play().catch(() => {}); else video.pause();
        break;
      case 'arrowleft':
      case 'arrowright':
      case 'arrowup':
      case 'arrowdown': {
        e.preventDefault();
        const r = playfield.getBoundingClientRect();
        const box = reimu.getBoundingClientRect();
        let x = (box.left + box.width / 2 - r.left) / r.width * 100;
        let y = (r.bottom - box.bottom) / r.height * 100;
        const step = 2.4;
        if (e.key === 'arrowleft')  x -= step;
        if (e.key === 'arrowright') x += step;
        if (e.key === 'arrowup')    y += step;
        if (e.key === 'arrowdown')  y -= step;
        reimu.style.left   = clamp(x, REIMU_X[0], REIMU_X[1]) + '%';
        reimu.style.bottom = clamp(y, REIMU_Y[0], REIMU_Y[1]) + '%';
        break;
      }
    }
  });

  // 松开 Z 就停火；切走窗口也别一直打
  document.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() === 'z') stopShooting();
  });
  window.addEventListener('blur', stopShooting);

  /* ================= 想固定某个视频 ================= */
  // 把视频放到 assets/spark.mp4，打开页面就会自动加载
  const probe = document.createElement('video');
  probe.preload = 'metadata';
  probe.onloadedmetadata = () => playSrc(DEFAULT_SRC);
  probe.src = DEFAULT_SRC;

  applyView();
})();
