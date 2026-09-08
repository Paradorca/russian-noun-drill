const App = {
  data: null,
  sentences: null,
  state: {},
  practice: { queue: [], index: 0, todaySeen: new Set() },

  async init() {
    try {
      const [dRes, sRes] = await Promise.all([
        fetch('./grammar-data.json'),
        fetch('./sentences-data.json')
      ]);
      this.data = await dRes.json();
      this.sentences = await sRes.json();
    } catch (e) {
      alert('数据加载失败，请检查文件是否完整');
      return;
    }

    this.loadState();
    this.registerSW();
    this.setupNav();
    this.showMap();
    this.showBottomNav();
  },

  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  },

  loadState() {
    const raw = localStorage.getItem('russianNounDrillState');

    this.state = raw ? JSON.parse(raw) : {
      unlockedNodes: [],
      practiceMode: 'noun-decl',
      dailyStats: { date: new Date().toISOString().slice(0,10), completed: 0 }
    };

    // Ensure userSentences exists
    if (!this.state.userSentences) {
      this.state.userSentences = [];
      this.saveState();
    }

    // Ensure userTexts exists
    if (!this.state.userTexts) {
      this.state.userTexts = [];
      this.saveState();
    }

    const today = new Date().toISOString().slice(0,10);
    if (this.state.dailyStats?.date !== today) {
      this.state.dailyStats = { date: today, completed: 0 };
      this.saveState();
    }
  },

  saveState() {
    localStorage.setItem('russianNounDrillState', JSON.stringify(this.state));
  },

  setupNav() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => {
        const target = el.dataset.target;
        if (target === 'map') this.showMap();
        if (target === 'practice') this.showPractice();
        if (target === 'texts') this.showTexts();
        if (target === 'settings') this.showSettings();
      });
    });
  },

  showBottomNav() {
    document.getElementById('bottom-nav').classList.remove('hidden');
  },

  setActiveNav(target) {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.target === target);
    });
  },

  switchPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
    if (id !== 'practice-page') {
      const win = document.getElementById('ai-window');
      if (win) win.classList.add('hidden');
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  caseName(c) {
    const map = { nominative: '主格', genitive: '属格', dative: '与格', accusative: '宾格', instrumental: '工具格', prepositional: '前置格' };
    return map[c] || c;
  },
  formName(s) {
    if (s.form) {
      const map = { masculine: '阳性', neuter: '中性', feminine: '阴性', plural: '复数', comparative: '比较级', compound: '复合比较级' };
      return map[s.form] || s.form;
    }
    return s.number === 'singular' ? '单数' : '复数';
  },
};

// Global event bindings
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  document.getElementById('toggle-rule-btn').onclick = () => App.toggleRulePanel();
  document.getElementById('next-btn').onclick = () => App.nextSentence();
  document.getElementById('restart-btn').onclick = () => App.restartPractice();
  document.getElementById('mode-sentence-btn').onclick = () => App.startSentencePractice();
  document.getElementById('mode-text-btn').onclick = () => App.startTextPractice();
  document.getElementById('text-back-btn').onclick = () => App.textPracticeBack();
  document.getElementById('complete-back-btn').onclick = () => App.showPracticeMode();
  document.getElementById('reset-progress-btn').onclick = () => App.resetProgress();
  document.getElementById('ai-close-btn').onclick = () => App.toggleChat();
  document.getElementById('chat-send-btn').onclick = () => App.sendChat();
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') App.sendChat();
  });

  // Horizontal swipe on the app toggles the AI window
  const appEl = document.getElementById('app');
  let swipeX = null, swipeY = null;
  appEl.addEventListener('touchstart', (e) => {
    swipeX = e.touches[0].clientX;
    swipeY = e.touches[0].clientY;
  }, { passive: true });
  appEl.addEventListener('touchend', (e) => {
    if (swipeX == null) return;
    const dx = e.changedTouches[0].clientX - swipeX;
    const dy = e.changedTouches[0].clientY - swipeY;
    swipeX = null; swipeY = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      App.toggleChat();
    }
  }, { passive: true });

  // Keep the AI chat input above the on-screen keyboard
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const adjust = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb-height', kb + 'px');
    };
    vv.addEventListener('resize', adjust);
    vv.addEventListener('scroll', adjust);
    adjust();
  }

  // Delegate click for other-declension words
  document.getElementById('sentence-ru').addEventListener('click', (e) => App.handleWordClick(e));
});
