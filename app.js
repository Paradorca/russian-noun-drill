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
      dailyStats: { date: new Date().toISOString().slice(0,10), completed: 0, markedWeak: [] }
    };

    // Ensure unlockedCases exists (default all cases unlocked for backward compatibility)
    if (!this.state.unlockedCases) {
      this.state.unlockedCases = ['nominative','genitive','dative','accusative','instrumental','prepositional'];
      this.saveState();
    }

    const today = new Date().toISOString().slice(0,10);
    if (this.state.dailyStats?.date !== today) {
      this.state.dailyStats = { date: today, completed: 0, markedWeak: [] };
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

  // -------- Map (Dual View) --------
  showMap() {
    this.switchPage('map-page');
    this.setActiveNav('map');
    this.renderMap();
  },

  renderMap() {
    const container = document.getElementById('map-container');
    container.innerHTML = '';

    // View toggle
    const toggle = document.createElement('div');
    toggle.className = 'view-toggle';
    toggle.innerHTML = `
      <button class="${this.currentMapView === 'declension' ? 'active' : ''}" data-view="declension">变格法视图</button>
      <button class="${this.currentMapView === 'case' ? 'active' : ''}" data-view="case">六格视图</button>
    `;
    toggle.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => {
        this.currentMapView = btn.dataset.view;
        this.saveState();
        this.renderMap();
      };
    });
    container.appendChild(toggle);

    if (this.currentMapView === 'declension') {
      this.renderDeclensionView(container);
    } else {
      this.renderCaseView(container);
    }
  },

  renderDeclensionView(container) {
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

  renderCaseView(container) {
    const caseOrder = ['nominative', 'genitive', 'dative', 'accusative', 'instrumental', 'prepositional'];
    const caseIndexMap = { nominative: 0, genitive: 1, dative: 2, accusative: 3, instrumental: 4, prepositional: 5 };
    const grammarNodes = this.data.framework.nodes.filter(n => n.type === 'grammarPoint');

    caseOrder.forEach(caseKey => {
      const usage = this.data.caseUsages[caseKey];
      const caseIdx = caseIndexMap[caseKey];

      const card = document.createElement('div');
      card.className = 'card case-card';
      card.style.marginBottom = '12px';

      const header = document.createElement('div');
      header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;cursor:pointer;';
      const isCaseActive = (this.state.unlockedCases || []).includes(caseKey);
      header.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="case-dot" style="width:14px;height:14px;border-radius:50%;background:${isCaseActive ? 'var(--success)' : '#ccc'};flex-shrink:0;cursor:pointer;transition:background 0.3s;box-shadow:${isCaseActive ? '0 0 8px rgba(123,160,152,0.4)' : 'none'};"></span>
          <strong style="font-size:1.1rem;color:var(--text);">${usage.name}</strong>
        </div>
        <span class="chevron" style="color:var(--muted);transition:transform 0.2s;">▼</span>`;

      const dot = header.querySelector('.case-dot');
      dot.onclick = (e) => {
        e.stopPropagation();
        this.toggleCase(caseKey);
      };

      const detail = document.createElement('div');
      detail.className = 'case-detail hidden';
      detail.style.marginTop = '12px';

      // Usage info
      let detailHTML = `<p style="color:var(--muted);font-size:0.9rem;margin-bottom:8px;">${usage.meaning}</p>`;
      detailHTML += `<p style="color:var(--muted);font-size:0.85rem;margin-bottom:8px;">${usage.usage}</p>`;
      if (usage.prepositions.length > 0) {
        detailHTML += `<div class="prep-list" style="margin-bottom:12px;">${usage.prepositions.map(p => `<span class="prep-tag">${p}</span>`).join('')}</div>`;
      }

      // Comparison table
      detailHTML += `<table class="rule-table"><tr><th>变格类型</th><th>单数</th><th>复数</th></tr>`;
      grammarNodes.forEach(node => {
        const isUnlocked = this.state.unlockedNodes.includes(node.id);
        const sForm = node.declensionTable.singular[caseIdx];
        const pForm = node.declensionTable.plural[caseIdx];
        detailHTML += `<tr style="${isUnlocked ? '' : 'opacity:0.5'}"><td>${node.name}</td><td>${sForm}</td><td>${pForm}</td></tr>`;
      });
      detailHTML += `</table>`;

      detail.innerHTML = detailHTML;

      header.onclick = () => {
        detail.classList.toggle('hidden');
        header.querySelector('.chevron').style.transform = detail.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
      };

      card.appendChild(header);
      card.appendChild(detail);
      container.appendChild(card);
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

  toggleCase(caseKey) {
    const cases = new Set(this.state.unlockedCases || []);
    if (cases.has(caseKey)) {
      cases.delete(caseKey);
    } else {
      cases.add(caseKey);
    }
    this.state.unlockedCases = Array.from(cases);
    this.saveState();
    this.renderMap();
  },

  toggleNode(nodeId) {
    const idx = this.state.unlockedNodes.indexOf(nodeId);
    if (idx > -1) {
      this.state.unlockedNodes.splice(idx, 1);
    } else {
      this.state.unlockedNodes.push(nodeId);
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

    const declensions = new Set();
    const cases = new Set();

    this.practice.queue.forEach(s => {
      const node = this.data.framework.nodes.find(n => n.id === s.grammarPointId);
      if (node && node.parentId) {
        const parent = this.data.framework.nodes.find(n => n.id === node.parentId);
        if (parent) declensions.add(parent.name);
      }
      if (s.case && this.data.caseUsages[s.case]) {
        cases.add(this.data.caseUsages[s.case].name);
      }
    });

    const tags = [
      ...Array.from(declensions).map(d => `<span class="tag">${d}</span>`),
      ...Array.from(cases).map(c => `<span class="tag">${c}</span>`)
    ];
    document.getElementById('overview-tags').innerHTML = tags.join('');
    document.getElementById('overview-count').textContent = `今日 ${this.practice.queue.length} 句`;

    this.renderSentence(0);
  },

  generateQueue() {
    const mode = this.state.practiceMode || 'random';
    let pool = this.sentences.filter(s =>
      this.state.unlockedNodes.includes(s.grammarPointId) &&
      (this.state.unlockedCases || []).includes(s.case)
    );

    if (mode === 'special') {
      const specialIds = this.data.framework.nodes
        .filter(n => n.parentId === 'special' && n.type === 'grammarPoint')
        .map(n => n.id);
      pool = pool.filter(s => specialIds.includes(s.grammarPointId));
    }

    if (pool.length === 0) return [];

    const weighted = pool.map(s => {
      const w = this.state.nodeWeights[s.grammarPointId] || 1;
      return { s, weight: w };
    });

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

    // Highlight sentence
    const ruHtml = this.renderHighlightedRU(s.sentenceRU, s.targetWordForm, s.otherDeclensions || []);
    document.getElementById('sentence-ru').innerHTML = ruHtml;
    document.getElementById('sentence-zh').textContent = s.sentenceZH;
    document.getElementById('sentence-meta').innerHTML = `
      <span class="meta-pill">${s.grammarPointName}</span>
      <span class="meta-pill">${this.caseName(s.case)} · ${s.number === 'singular' ? '单数' : '复数'}</span>
    `;

    // Hide any open popup
    document.getElementById('other-decl-popup').classList.add('hidden');

    document.getElementById('rule-panel').classList.remove('open');
    document.getElementById('rule-panel').innerHTML = this.buildRuleHTML(s.grammarPointId, s.case);
    document.getElementById('progress-text').textContent = `${idx + 1} / ${this.practice.queue.length}`;
  },

  renderHighlightedRU(sentenceRU, targetWordForm, otherDeclensions) {
    const highlightMap = {};
    highlightMap[targetWordForm] = `<span class="word-target">${targetWordForm}</span>`;

    otherDeclensions.forEach(od => {
      if (od.word !== targetWordForm && !highlightMap[od.word]) {
        highlightMap[od.word] = `<span class="word-other" data-case="${od.case}" data-brief="${this.escapeHtml(od.brief)}">${od.word}</span>`;
      }
    });

    // Split by delimiters but keep them
    const tokens = sentenceRU.split(/([ ,.!?;:"«»—]+)/);
    return tokens.map(token => highlightMap[token] || this.escapeHtml(token)).join('');
  },

  handleWordClick(e) {
    const popup = document.getElementById('other-decl-popup');
    if (e.target.classList.contains('word-other')) {
      const caseName = this.caseName(e.target.dataset.case);
      const brief = e.target.dataset.brief;
      popup.innerHTML = `<strong>${caseName}</strong>：${brief}`;
      popup.classList.remove('hidden');
    } else {
      popup.classList.add('hidden');
    }
  },

  caseName(c) {
    const map = { nominative: '主格', genitive: '属格', dative: '与格', accusative: '宾格', instrumental: '工具格', prepositional: '前置格' };
    return map[c] || c;
  },

  buildRuleHTML(gpId, currentCase) {
    const node = this.data.framework.nodes.find(n => n.id === gpId);
    if (!node) return '';
    const tableRows = node.caseNames.map((cn, i) => {
      return `<tr><td>${cn}</td><td>${node.declensionTable.singular[i]}</td><td>${node.declensionTable.plural[i]}</td></tr>`;
    }).join('');

    let html = `
      <h4>${node.name}（${node.exampleWord}）</h4>
      <p style="color:var(--muted);font-size:0.9rem;margin-bottom:10px;">${node.description}</p>
      <p class="highlight">${node.highlight}</p>
      <table class="rule-table">
        <tr><th>格</th><th>单数</th><th>复数</th></tr>
        ${tableRows}
      </table>
      <p style="color:var(--muted);font-size:0.85rem;margin-top:10px;">💡 ${node.tips}</p>
    `;

    // Add case usage for current sentence's case
    if (currentCase && this.data.caseUsages[currentCase]) {
      const usage = this.data.caseUsages[currentCase];
      html += `
        <div class="case-usage-block">
          <h5>📘 ${usage.name}的用法</h5>
          <p><strong>含义：</strong>${usage.meaning}</p>
          <p><strong>用法：</strong>${usage.usage}</p>
          <p><strong>例句：</strong>${usage.example}</p>
          ${usage.prepositions.length > 0 ? `
            <p style="margin-top:6px;"><strong>常用连接词：</strong></p>
            <div class="prep-list">${usage.prepositions.map(p => `<span class="prep-tag">${p}</span>`).join('')}</div>
          ` : ''}
        </div>
      `;
    }

    return html;
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

// Global event bindings
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  document.getElementById('toggle-rule-btn').onclick = () => App.toggleRulePanel();
  document.getElementById('next-btn').onclick = () => App.nextSentence();
  document.getElementById('weak-btn').onclick = () => App.markWeak();
  document.getElementById('restart-btn').onclick = () => App.restartPractice();
  document.getElementById('reset-progress-btn').onclick = () => App.resetProgress();

  // Delegate click for other-declension words
  document.getElementById('sentence-ru').addEventListener('click', (e) => App.handleWordClick(e));
});
