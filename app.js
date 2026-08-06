const App = {
  data: null,
  sentences: null,
  state: {},
  diagnostic: { current: 0, answers: [] },
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
      dailyStats: { date: new Date().toISOString().slice(0,10), completed: 0, markedWeak: [] }
    };

    // reset daily stats if new day
    const today = new Date().toISOString().slice(0,10);
    if (this.state.dailyStats?.date !== today) {
      this.state.dailyStats = { date: today, completed: 0, markedWeak: [] };
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

  // -------- Welcome & Diagnostic --------
  showWelcome() {
    this.switchPage('welcome-page');
    document.getElementById('bottom-nav').classList.add('hidden');
    document.getElementById('start-diagnostic-btn').onclick = () => this.startDiagnostic();
  },

  startDiagnostic() {
    this.diagnostic.current = 0;
    this.diagnostic.answers = [];
    this.switchPage('diagnostic-page');
    this.renderDiagnosticQuestion();
  },

  renderDiagnosticQuestion() {
    const q = this.data.diagnosticTest.questions[this.diagnostic.current];
    const total = this.data.diagnosticTest.questions.length;

    document.getElementById('diagnostic-title').textContent = this.data.diagnosticTest.title;
    document.getElementById('question-counter').textContent = `问题 ${this.diagnostic.current + 1} / ${total}`;
    document.getElementById('progress-fill').style.width = `${((this.diagnostic.current) / total) * 100}%`;
    document.getElementById('question-text').textContent = q.text;

    const optsContainer = document.getElementById('options-container');
    optsContainer.innerHTML = '';
    q.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt.label;
      btn.onclick = () => this.submitDiagnosticAnswer(opt.value);
      optsContainer.appendChild(btn);
    });
  },

  submitDiagnosticAnswer(value) {
    this.diagnostic.answers.push(value);
    this.diagnostic.current++;
    if (this.diagnostic.current < this.data.diagnosticTest.questions.length) {
      this.renderDiagnosticQuestion();
    } else {
      this.finishDiagnostic();
    }
  },

  finishDiagnostic() {
    const unlocked = new Set();
    this.data.diagnosticTest.questions.forEach((q, idx) => {
      const val = this.diagnostic.answers[idx];
      const nodes = q.unlocks[val] || [];
      nodes.forEach(id => unlocked.add(id));
    });
    // Also add parent nodes if child is unlocked
    const allNodes = this.data.framework.nodes;
    const addParents = (id) => {
      const node = allNodes.find(n => n.id === id);
      if (node && node.parentId) {
        unlocked.add(node.parentId);
        addParents(node.parentId);
      }
    };
    Array.from(unlocked).forEach(id => addParents(id));

    this.state.unlockedNodes = Array.from(unlocked);
    this.state.diagnosticCompleted = true;
    this.saveState();

    document.getElementById('diagnostic-complete').classList.remove('hidden');
    document.getElementById('go-to-map-btn').onclick = () => {
      this.showMap();
      this.showBottomNav();
    };
  },

  // -------- Map --------
  showMap() {
    this.switchPage('map-page');
    this.setActiveNav('map');
    this.renderMap();
  },

  renderMap() {
    const container = document.getElementById('map-container');
    container.innerHTML = '';

    const nodes = this.data.framework.nodes;
    const root = nodes.find(n => n.type === 'root');
    const categories = nodes.filter(n => n.type === 'category' && n.parentId === root.id);

    categories.forEach(cat => {
      const catEl = document.createElement('div');
      catEl.className = 'map-category';

      const header = document.createElement('div');
      header.className = 'map-category-header';
      const isCollapsed = this.state.collapsedCategories?.includes(cat.id);
      if (isCollapsed) header.classList.add('collapsed');

      const catUnlocked = this.state.unlockedNodes.includes(cat.id);
      header.innerHTML = `
        <span style="color:${catUnlocked ? 'var(--success)' : 'var(--muted)'};">●</span>
        <span>${cat.name}</span>
        <span class="chevron">▼</span>
      `;
      header.onclick = () => this.toggleCategory(cat.id);
      catEl.appendChild(header);

      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'map-children';
      if (isCollapsed) childrenContainer.classList.add('hidden');

      const children = nodes.filter(n => n.parentId === cat.id && n.type === 'grammarPoint');
      children.forEach(child => {
        const nodeEl = document.createElement('div');
        const isActive = this.state.unlockedNodes.includes(child.id);
        nodeEl.className = `map-node ${isActive ? 'active' : ''}`;
        nodeEl.innerHTML = `
          <div class="node-dot"></div>
          <div class="node-info">
            <div class="node-name">${child.name}</div>
            <div class="node-example">例：${child.exampleWord}</div>
          </div>
        `;
        nodeEl.onclick = () => this.toggleNode(child.id);
        childrenContainer.appendChild(nodeEl);
      });

      catEl.appendChild(childrenContainer);
      container.appendChild(catEl);
    });
  },

  toggleCategory(catId) {
    const collapsed = new Set(this.state.collapsedCategories || []);
    if (collapsed.has(catId)) collapsed.delete(catId);
    else collapsed.add(catId);
    this.state.collapsedCategories = Array.from(collapsed);
    this.saveState();
    this.renderMap();
  },

  toggleNode(nodeId) {
    const idx = this.state.unlockedNodes.indexOf(nodeId);
    if (idx > -1) {
      this.state.unlockedNodes.splice(idx, 1);
    } else {
      this.state.unlockedNodes.push(nodeId);
      // Ensure parent is also unlocked
      const node = this.data.framework.nodes.find(n => n.id === nodeId);
      if (node && node.parentId && !this.state.unlockedNodes.includes(node.parentId)) {
        this.state.unlockedNodes.push(node.parentId);
      }
    }
    this.saveState();
    this.renderMap();
  },

  // -------- Practice --------
  showPractice() {
    this.switchPage('practice-page');
    this.setActiveNav('practice');
    this.startPractice();
  },

  startPractice() {
    this.practice.queue = this.generateQueue();
    this.practice.index = 0;

    const overview = document.getElementById('practice-overview');
    const card = document.getElementById('sentence-card');
    const empty = document.getElementById('practice-empty');

    if (this.practice.queue.length === 0) {
      overview.classList.add('hidden');
      card.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }

    overview.classList.remove('hidden');
    card.classList.remove('hidden');
    empty.classList.add('hidden');

    // Build overview tags
    const uniqueGrammar = [...new Set(this.practice.queue.map(s => s.grammarPointName))];
    document.getElementById('overview-tags').innerHTML = uniqueGrammar
      .map(g => `<span class="tag">${g}</span>`).join('');
    document.getElementById('overview-count').textContent = `今日 ${this.practice.queue.length} 句`;

    this.renderSentence(0);
  },

  generateQueue() {
    const mode = this.state.practiceMode || 'random';
    let pool = this.sentences.filter(s => this.state.unlockedNodes.includes(s.grammarPointId));

    if (mode === 'special') {
      const specialIds = this.data.framework.nodes
        .filter(n => n.parentId === 'special' && n.type === 'grammarPoint')
        .map(n => n.id);
      pool = pool.filter(s => specialIds.includes(s.grammarPointId));
    }

    if (pool.length === 0) return [];

    // Weighted random shuffle
    const weighted = pool.map(s => {
      const w = this.state.nodeWeights[s.grammarPointId] || 1;
      return { s, weight: w };
    });

    // Pick up to 20 sentences weighted randomly without immediate repeat
    const result = [];
    const used = new Set();
    const max = Math.min(20, pool.length);
    for (let i = 0; i < max; i++) {
      const available = weighted.filter(w => !used.has(w.s) && w.weight > 0);
      if (available.length === 0) break;
      const totalWeight = available.reduce((sum, w) => sum + w.weight, 0);
      let rnd = Math.random() * totalWeight;
      let selected = available[0];
      for (const item of available) {
        rnd -= item.weight;
        if (rnd <= 0) { selected = item; break; }
      }
      result.push(selected.s);
      used.add(selected.s);
    }
    return result;
  },

  renderSentence(idx) {
    if (idx >= this.practice.queue.length) {
      this.showPracticeComplete();
      return;
    }
    this.practice.index = idx;
    const s = this.practice.queue[idx];

    document.getElementById('sentence-ru').textContent = s.sentenceRU;
    document.getElementById('sentence-zh').textContent = s.sentenceZH;
    document.getElementById('sentence-meta').innerHTML = `
      <span class="meta-pill">${s.grammarPointName}</span>
      <span class="meta-pill">${this.caseName(s.case)} · ${s.number === 'singular' ? '单数' : '复数'}</span>
    `;

    document.getElementById('rule-panel').classList.remove('open');
    document.getElementById('rule-panel').innerHTML = this.buildRuleHTML(s.grammarPointId);
    document.getElementById('progress-text').textContent = `${idx + 1} / ${this.practice.queue.length}`;
  },

  caseName(c) {
    const map = { nominative: '主格', genitive: '属格', dative: '与格', accusative: '宾格', instrumental: '工具格', prepositional: '前置格' };
    return map[c] || c;
  },

  buildRuleHTML(gpId) {
    const node = this.data.framework.nodes.find(n => n.id === gpId);
    if (!node) return '';
    const tableRows = node.caseNames.map((cn, i) => {
      return `<tr><td>${cn}</td><td>${node.declensionTable.singular[i]}</td><td>${node.declensionTable.plural[i]}</td></tr>`;
    }).join('');

    return `
      <h4>${node.name}（${node.exampleWord}）</h4>
      <p style="color:var(--muted);font-size:0.9rem;margin-bottom:10px;">${node.description}</p>
      <p class="highlight">${node.highlight}</p>
      <table class="rule-table">
        <tr><th>格</th><th>单数</th><th>复数</th></tr>
        ${tableRows}
      </table>
      <p style="color:var(--muted);font-size:0.85rem;margin-top:10px;">💡 ${node.tips}</p>
    `;
  },

  toggleRulePanel() {
    document.getElementById('rule-panel').classList.toggle('open');
  },

  nextSentence() {
    this.renderSentence(this.practice.index + 1);
  },

  markWeak() {
    const s = this.practice.queue[this.practice.index];
    if (!this.state.dailyStats.markedWeak.includes(s.sentenceRU)) {
      this.state.dailyStats.markedWeak.push(s.sentenceRU);
      this.saveState();
    }
    this.nextSentence();
  },

  showPracticeComplete() {
    document.getElementById('sentence-card').classList.add('hidden');
    document.getElementById('practice-overview').classList.add('hidden');
    document.getElementById('practice-complete').classList.remove('hidden');
    document.getElementById('complete-count').textContent = this.practice.queue.length;
  },

  restartPractice() {
    document.getElementById('practice-complete').classList.add('hidden');
    this.startPractice();
  },

  // -------- Settings --------
  showSettings() {
    this.switchPage('settings-page');
    this.setActiveNav('settings');
    this.renderSettings();
  },

  renderSettings() {
    document.getElementById('mode-select').value = this.state.practiceMode || 'random';
    document.getElementById('mode-select').onchange = (e) => {
      this.state.practiceMode = e.target.value;
      this.saveState();
    };

    const weightList = document.getElementById('weight-list');
    weightList.innerHTML = '';
    const grammarNodes = this.data.framework.nodes.filter(n => n.type === 'grammarPoint');
    grammarNodes.forEach(node => {
      const w = this.state.nodeWeights[node.id] || 1;
      const isUnlocked = this.state.unlockedNodes.includes(node.id);
      const div = document.createElement('div');
      div.className = 'map-node' + (isUnlocked ? ' active' : '');
      div.innerHTML = `
        <div class="node-info" style="flex:1;">
          <div class="node-name">${node.name}</div>
        </div>
        <div class="weight-slider">
          <input type="range" min="0" max="3" step="1" value="${w}" data-id="${node.id}">
          <span class="weight-value">${w}x</span>
        </div>
      `;
      const input = div.querySelector('input');
      const valSpan = div.querySelector('.weight-value');
      input.oninput = (e) => {
        const v = parseInt(e.target.value);
        valSpan.textContent = v + 'x';
        this.state.nodeWeights[node.id] = v;
        this.saveState();
      };
      weightList.appendChild(div);
    });
  },

  resetProgress() {
    if (confirm('确定要重置所有学习进度吗？这将清空已点亮的语法点和练习记录。')) {
      localStorage.removeItem('russianNounDrillState');
      location.reload();
    }
  }
};

// Global event bindings for elements that exist in HTML
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  document.getElementById('toggle-rule-btn').onclick = () => App.toggleRulePanel();
  document.getElementById('next-btn').onclick = () => App.nextSentence();
  document.getElementById('weak-btn').onclick = () => App.markWeak();
  document.getElementById('restart-btn').onclick = () => App.restartPractice();
  document.getElementById('reset-progress-btn').onclick = () => App.resetProgress();
});
