/**
 * FOOTBALL BROADCAST OVERLAY — script.js
 * ----------------------------------------
 * Accurate timer using performance.now() to prevent drift.
 * Full match control: score, timer, state, added time.
 * OBS-compatible, keyboard-shortcut driven.
 */

;(function () {
  'use strict';

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    homeScore: 0,
    awayScore: 0,
    homeName: 'ARS',
    awayName: 'MCI',
    homeColor: '#c0002e',
    awayColor: '#1b3f7e',

    // Timer — stored in whole milliseconds
    elapsedMs: 0,
    running: false,
    rafId: null,
    startTimestamp: null, // performance.now() when last started
    startElapsed: 0,       // elapsedMs snapshot at last start

    addedTime: 0,
    matchState: '1H',
  };

  /* ============================================================
     DOM REFERENCES
     ============================================================ */
  const $ = id => document.getElementById(id);

  const dom = {
    overlay:         $('overlay'),
    scorebug:        $('scorebug'),
    homeName:        $('home-name'),
    awayName:        $('away-name'),
    homeScore:       $('home-score'),
    awayScore:       $('away-score'),
    homeBlock:       $('home-block'),
    awayBlock:       $('away-block'),
    matchTime:       $('match-time'),
    addedTime:       $('added-time'),
    matchState:      $('match-state'),
    panel:           $('control-panel'),
    panelClose:      $('panel-close'),
    toggleHint:      $('toggle-hint'),

    // Controls
    inputHomeName:   $('input-home-name'),
    inputAwayName:   $('input-away-name'),
    homeColorPick:   $('home-color'),
    awayColorPick:   $('away-color'),
    ctrlHomeScore:   $('ctrl-home-score'),
    ctrlAwayScore:   $('ctrl-away-score'),
    btnStart:        $('btn-start'),
    btnPause:        $('btn-pause'),
    btnReset:        $('btn-reset'),
    btnMinus10:      $('btn-minus10'),
    btnPlus10:       $('btn-plus10'),
    inputCustomTime: $('input-custom-time'),
    btnSetTime:      $('btn-set-time'),
    addedSlider:     $('added-time-slider'),
    addedTimeValue:  $('added-time-value'),
    stateBtns:       document.querySelectorAll('.state-btn'),
    scoreBtns:       document.querySelectorAll('.score-btn'),
  };

  /* ============================================================
     TIMER ENGINE  (performance.now based, no drift)
     ============================================================ */

  function timerTick(timestamp) {
    if (!state.running) return;
    state.elapsedMs = state.startElapsed + (timestamp - state.startTimestamp);
    renderTime();
    state.rafId = requestAnimationFrame(timerTick);
  }

  function startTimer() {
    if (state.running) return;
    state.running = true;
    state.startTimestamp = performance.now();
    state.startElapsed = state.elapsedMs;
    state.rafId = requestAnimationFrame(timerTick);
    updateTimerButtons();
  }

  function pauseTimer() {
    if (!state.running) return;
    state.running = false;
    cancelAnimationFrame(state.rafId);
    // Commit elapsed so resuming is accurate
    state.elapsedMs = state.startElapsed + (performance.now() - state.startTimestamp);
    updateTimerButtons();
  }

  function resetTimer() {
    pauseTimer();
    state.elapsedMs = 0;
    state.startElapsed = 0;
    renderTime();
    updateTimerButtons();
  }

  function adjustTimer(deltaMs) {
    const wasRunning = state.running;
    if (wasRunning) pauseTimer();
    state.elapsedMs = Math.max(0, state.elapsedMs + deltaMs);
    renderTime();
    if (wasRunning) startTimer();
  }

  function setTimerFromInput() {
    const raw = dom.inputCustomTime.value.trim();
    // Accept MM:SS or plain seconds
    let totalMs = 0;
    if (/^\d{1,2}:\d{2}$/.test(raw)) {
      const [mm, ss] = raw.split(':').map(Number);
      totalMs = (mm * 60 + ss) * 1000;
    } else if (/^\d+$/.test(raw)) {
      totalMs = parseInt(raw, 10) * 1000;
    } else {
      dom.inputCustomTime.style.borderColor = '#e03';
      setTimeout(() => { dom.inputCustomTime.style.borderColor = ''; }, 900);
      return;
    }
    const wasRunning = state.running;
    if (wasRunning) pauseTimer();
    state.elapsedMs = totalMs;
    renderTime();
    if (wasRunning) startTimer();
    dom.inputCustomTime.value = '';
  }

  /* ============================================================
     RENDER
     ============================================================ */

  /**
   * Format milliseconds → "MM:SS"
   */
  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  }

  function renderTime() {
    dom.matchTime.textContent = formatTime(state.elapsedMs);
  }

  function renderScore(team) {
    const isHome = team === 'home';
    const el = isHome ? dom.homeScore : dom.awayScore;
    const ctrlEl = isHome ? dom.ctrlHomeScore : dom.ctrlAwayScore;
    const val = isHome ? state.homeScore : state.awayScore;

    el.textContent = val;
    ctrlEl.textContent = val;

    // Score bump animation
    el.classList.remove('bump');
    void el.offsetWidth; // reflow to restart
    el.classList.add('bump');
    el.addEventListener('animationend', () => el.classList.remove('bump'), { once: true });
  }

  function renderTeamNames() {
    dom.homeName.textContent = state.homeName.toUpperCase();
    dom.awayName.textContent = state.awayName.toUpperCase();
    document.title = `${state.homeName} vs ${state.awayName} — Overlay`;
  }

  function renderColors() {
    dom.homeBlock.style.setProperty('background-color', state.homeColor, 'important');
    dom.homeBlock.style.background = `linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%), ${state.homeColor}`;
    dom.awayBlock.style.background = `linear-gradient(225deg, rgba(255,255,255,0.08) 0%, transparent 60%), ${state.awayColor}`;
    document.documentElement.style.setProperty('--home-color', state.homeColor);
    document.documentElement.style.setProperty('--away-color', state.awayColor);
  }

  function renderAddedTime() {
    const at = state.addedTime;
    if (at > 0) {
      dom.addedTime.textContent = '+' + at;
      dom.addedTime.style.display = 'inline-flex';
      // Re-trigger animation
      dom.addedTime.style.animation = 'none';
      void dom.addedTime.offsetWidth;
      dom.addedTime.style.animation = '';
    } else {
      dom.addedTime.style.display = 'none';
    }
    dom.addedTimeValue.textContent = at > 0 ? '+' + at + ' min' : 'None';
  }

  function renderMatchState(s) {
    dom.matchState.textContent = s;
    dom.matchState.className = 'match-state' + (s === 'FT' ? ' ft' : '');
  }

  function updateTimerButtons() {
    if (state.running) {
      dom.btnStart.style.opacity = '0.4';
      dom.btnPause.style.opacity = '1';
    } else {
      dom.btnStart.style.opacity = '1';
      dom.btnPause.style.opacity = '0.4';
    }
  }

  /* ============================================================
     CONTROL PANEL TOGGLE
     ============================================================ */

  let hintTimeout;

  function showPanel() {
    dom.panel.classList.remove('hidden');
    // Hide the hint while panel is open
    dom.toggleHint.style.display = 'none';
  }

  function hidePanel() {
    dom.panel.classList.add('hidden');
    dom.toggleHint.style.display = '';
    dom.toggleHint.classList.remove('fade-out');
    clearTimeout(hintTimeout);
    hintTimeout = setTimeout(() => {
      dom.toggleHint.classList.add('fade-out');
    }, 3000);
  }

  function togglePanel() {
    if (dom.panel.classList.contains('hidden')) {
      showPanel();
    } else {
      hidePanel();
    }
  }

  /* ============================================================
     EVENT BINDINGS — Scoreboard Controls
     ============================================================ */

  // Team name inputs
  dom.inputHomeName.addEventListener('input', () => {
    state.homeName = dom.inputHomeName.value || 'HOME';
    renderTeamNames();
  });

  dom.inputAwayName.addEventListener('input', () => {
    state.awayName = dom.inputAwayName.value || 'AWAY';
    renderTeamNames();
  });

  // Color pickers
  dom.homeColorPick.addEventListener('input', () => {
    state.homeColor = dom.homeColorPick.value;
    renderColors();
  });

  dom.awayColorPick.addEventListener('input', () => {
    state.awayColor = dom.awayColorPick.value;
    renderColors();
  });

  // Score buttons (+1 / -1)
  dom.scoreBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const team = btn.dataset.team;
      const delta = parseInt(btn.dataset.delta, 10);
      if (team === 'home') {
        state.homeScore = Math.max(0, state.homeScore + delta);
        renderScore('home');
      } else {
        state.awayScore = Math.max(0, state.awayScore + delta);
        renderScore('away');
      }
    });
  });

  // Timer buttons
  dom.btnStart.addEventListener('click', startTimer);
  dom.btnPause.addEventListener('click', pauseTimer);
  dom.btnReset.addEventListener('click', resetTimer);
  dom.btnMinus10.addEventListener('click', () => adjustTimer(-10000));
  dom.btnPlus10.addEventListener('click', () => adjustTimer(10000));
  dom.btnSetTime.addEventListener('click', setTimerFromInput);
  dom.inputCustomTime.addEventListener('keydown', e => {
    if (e.key === 'Enter') setTimerFromInput();
  });

  // Added time slider
  dom.addedSlider.addEventListener('input', () => {
    state.addedTime = parseInt(dom.addedSlider.value, 10);
    renderAddedTime();
  });

  // Match state buttons
  dom.stateBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.stateBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.matchState = btn.dataset.state;
      renderMatchState(state.matchState);
    });
  });

  // Panel close
  dom.panelClose.addEventListener('click', hidePanel);

  /* ============================================================
     KEYBOARD SHORTCUTS
     ============================================================ */

  document.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName.toLowerCase();
    // Don't intercept when typing in inputs
    if (tag === 'input' || tag === 'textarea') {
      // Only allow Escape to blur
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }

    switch (e.key) {
      case ' ':
      case 'Space':
        e.preventDefault();
        state.running ? pauseTimer() : startTimer();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        adjustTimer(-10000);
        break;
      case 'ArrowRight':
        e.preventDefault();
        adjustTimer(10000);
        break;
      case 'r':
      case 'R':
        resetTimer();
        break;
      case 'h':
      case 'H':
        togglePanel();
        break;
    }
  });

  /* ============================================================
     INITIAL RENDER
     ============================================================ */

  function init() {
    renderTeamNames();
    renderScore('home');
    renderScore('away');
    renderColors();
    renderTime();
    renderAddedTime();
    renderMatchState(state.matchState);
    updateTimerButtons();

    // Auto-fade hint after 4s on load
    hintTimeout = setTimeout(() => {
      dom.toggleHint.classList.add('fade-out');
    }, 4000);
  }

  init();

})();
