const App = {
  data: null,
  sentences: null,
  state: {},
  diagnostic: { current: 0, answers: [] },
  practice: { queue: [], index: 0, todaySeen: new Set() },
  currentMapView: 'declension',

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

    if (!this.state.diagnosticCompleted) {
      this.showWelcome();
    } else {
      this.showMap();
      this.showBottomNav();
    }
  },

  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  },

  loadState() {
    const raw = localStorage.getItem('russianNounDrillState');
    const defaultWeights = {};
    const grammarIds = this.data?.framework?.nodes
      ?.filter(n => n.type === 'grammarPoint')
      ?.map(n => n.id) || [];
    grammarIds.forEach(id => defaultWeights[id] = 1);

    this.state = raw ? JSON.parse(raw) : {
      diagnosticCompleted: false,
      unlockedNodes: [],
      nodeWeights: defaultWeights,
      practiceMode: 'random',
      mapView: 'declension',
      dailyStats: { date: new Date().toISOString().slice(0,10), completed: 0 }
    };

    // Ensure unlockedCases exists (default all cases unlocked for backward compatibility)
    if (!this.state.unlockedCases) {
      this.state.unlockedCases = ['nominative','genitive','dative','accusative','instrumental','prepositional'];
      this.saveState();
    }

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
    this.currentMapView = this.state.mapView || 'declension';
  },

  saveState() {
    this.state.mapView = this.currentMapView;
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
};

// Global event bindings
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  document.getElementById('toggle-rule-btn').onclick = () => App.toggleRulePanel();
  document.getElementById('next-btn').onclick = () => App.nextSentence();
  document.getElementById('restart-btn').onclick = () => App.restartPractice();
  document.getElementById('reset-progress-btn').onclick = () => App.resetProgress();
  document.getElementById('ask-ai-btn').onclick = () => App.toggleChat();
  document.getElementById('chat-send-btn').onclick = () => App.sendChat();
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') App.sendChat();
  });

  // Delegate click for other-declension words
  document.getElementById('sentence-ru').addEventListener('click', (e) => App.handleWordClick(e));
});
