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

    const card = document.getElementById('sentence-card');
    const empty = document.getElementById('practice-empty');

    if (this.practice.queue.length === 0) {
      card.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }

    card.classList.remove('hidden');
    empty.classList.add('hidden');

    this.renderSentence(0);
  },

  generateQueue() {
    const mode = this.state.practiceMode || 'random';
    const builtIn = this.sentences.filter(s =>
      this.state.unlockedNodes.includes(s.grammarPointId) &&
      (this.state.unlockedCases || []).includes(s.case)
    );
    const custom = (this.state.userSentences || []).filter(s =>
      this.state.unlockedNodes.includes(s.grammarPointId) &&
      (this.state.unlockedCases || []).includes(s.case)
    );
    let pool = [...builtIn, ...custom];

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
    const max = Math.min(10, pool.length);
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

    document.getElementById('sentence-zh').textContent = s.sentenceZH;
    document.getElementById('sentence-meta').innerHTML = `
      <span class="meta-pill">${s.grammarPointName}</span>
      <span class="meta-pill">${this.caseName(s.case)} · ${s.number === 'singular' ? '单数' : '复数'}</span>
    `;

    // Hide any open popup
    document.getElementById('other-decl-popup').classList.add('hidden');

    document.getElementById('rule-panel').classList.remove('open');
    document.getElementById('rule-panel').innerHTML = this.buildRuleHTML(s.grammarPointId, s.case);
    this.renderRelatedTexts(s);
    document.getElementById('progress-text').textContent = `${idx + 1} / ${this.practice.queue.length}`;

    const ruleBtn = document.getElementById('toggle-rule-btn');
    ruleBtn.disabled = true;

    const ruEl = document.getElementById('sentence-ru');
    const inputEl = document.getElementById('typing-input');
    this.attachTyping(ruEl, inputEl, s.sentenceRU, () => {
      ruEl.innerHTML = this.renderHighlightedRU(s.sentenceRU, s.targetWordForm, s.otherDeclensions || []);
      ruleBtn.disabled = false;
    });
  },

  normalizeLetters(str) {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ё/g, 'е');
  },

  lettersOnly(str) {
    return this.normalizeLetters(str).replace(/[^a-zа-я]/g, '');
  },

  renderTypingProgress(textEl, targetText, matchedLetters) {
    let count = 0, cut = 0;
    for (let i = 0; i < targetText.length; i++) {
      if (/[a-zа-яё]/i.test(targetText[i])) {
        count++;
        if (count === matchedLetters) { cut = i + 1; break; }
      }
    }
    const done = this.escapeHtml(targetText.slice(0, cut));
    const todo = this.escapeHtml(targetText.slice(cut));
    textEl.innerHTML = `<span class="typing-done">${done}</span><span class="typing-pending">${todo}</span>`;
  },

  attachTyping(textEl, inputEl, targetText, onComplete) {
    const targetLetters = this.lettersOnly(targetText);
    inputEl.value = '';
    inputEl.placeholder = '在这里把上面的句子打一遍（标点可省略）';
    if (targetLetters.length === 0) {
      this.renderTypingProgress(textEl, targetText, 0);
      inputEl.disabled = true;
      if (onComplete) onComplete();
      return;
    }
    inputEl.disabled = false;
    this.renderTypingProgress(textEl, targetText, 0);
    inputEl.oninput = () => {
      const typedLetters = this.lettersOnly(inputEl.value);
      let m = 0;
      while (m < typedLetters.length && m < targetLetters.length && typedLetters[m] === targetLetters[m]) m++;
      this.renderTypingProgress(textEl, targetText, m);
      if (m >= targetLetters.length) {
        inputEl.disabled = true;
        inputEl.placeholder = '✓ 拼写正确';
        if (onComplete) onComplete();
      }
    };
  },

  renderRelatedTexts(s) {
    const container = document.getElementById('related-text-content');
    if (!container) return;
    const lessons = (this.state.userTexts || []).filter(t =>
      (s.source && t.source === s.source) ||
      (t.grammarPoints || []).includes(s.grammarPointId)
    );
    if (lessons.length === 0) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = lessons.map(t => `
      <div class="lesson-card">
        <div class="lesson-meta">
          <span class="meta-pill">📖 ${this.escapeHtml(t.source)}</span>
          ${t.chapter ? `<span class="meta-pill">${this.escapeHtml(t.chapter)}</span>` : ''}
          ${t.title ? `<span class="meta-pill">${this.escapeHtml(t.title)}</span>` : ''}
        </div>
        <div class="lesson-ru">${this.escapeHtml(t.contentRU)}</div>
        ${t.contentZH ? `<div class="lesson-zh">${this.escapeHtml(t.contentZH)}</div>` : ''}
      </div>
    `).join('');
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
    document.getElementById('practice-complete').classList.remove('hidden');
    document.getElementById('complete-count').textContent = this.practice.queue.length;

    const lessonBox = document.getElementById('complete-lesson');
    const texts = this.state.userTexts || [];
    if (texts.length > 0) {
      const t = texts[texts.length - 1];
      lessonBox.innerHTML = `
        <div style="margin:20px 0;font-size:0.9rem;color:var(--muted);text-align:center;">📖 回顾最近导入的课文（打一遍加深记忆）</div>
        <div class="lesson-card" style="margin-bottom:20px;">
          <div class="lesson-meta">
            <span class="meta-pill">📖 ${this.escapeHtml(t.source)}</span>
            ${t.chapter ? `<span class="meta-pill">${this.escapeHtml(t.chapter)}</span>` : ''}
            ${t.title ? `<span class="meta-pill">${this.escapeHtml(t.title)}</span>` : ''}
          </div>
          <div class="lesson-ru" id="complete-lesson-ru"></div>
          <textarea id="complete-lesson-input" class="typing-input" rows="3" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>
          ${t.contentZH ? `<div class="lesson-zh" style="margin-top:10px;">${this.escapeHtml(t.contentZH)}</div>` : ''}
        </div>
      `;
      this.attachTyping(
        document.getElementById('complete-lesson-ru'),
        document.getElementById('complete-lesson-input'),
        t.contentRU,
        null
      );
    } else {
      lessonBox.innerHTML = '';
    }
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

    // Custom sentence form
    const grammarSelect = document.getElementById('custom-grammar');
    if (grammarSelect && grammarSelect.options.length === 0) {
      grammarNodes.forEach(node => {
        const opt = document.createElement('option');
        opt.value = node.id;
        opt.textContent = node.name;
        grammarSelect.appendChild(opt);
      });
    }

    const updatePreview = () => {
      const preview = document.getElementById('custom-rule-preview');
      const gpId = document.getElementById('custom-grammar').value;
      const caseKey = document.getElementById('custom-case').value;
      const number = document.getElementById('custom-number').value;
      const node = this.data.framework.nodes.find(n => n.id === gpId);
      if (!node || !caseKey || !this.data.caseUsages[caseKey]) {
        preview.style.display = 'none';
        return;
      }
      const caseIdx = ['nominative','genitive','dative','accusative','instrumental','prepositional'].indexOf(caseKey);
      const form = number === 'singular' ? node.declensionTable.singular[caseIdx] : node.declensionTable.plural[caseIdx];
      preview.innerHTML = `<strong style="color:var(--accent);">${node.name} — ${this.data.caseUsages[caseKey].name}（${number === 'singular' ? '单数' : '复数'}）</strong><br>
        变化形式：<span style="color:var(--text);font-weight:600;">${form}</span>`;
      preview.style.display = 'block';
    };

    document.getElementById('custom-grammar').onchange = updatePreview;
    document.getElementById('custom-case').onchange = updatePreview;
    document.getElementById('custom-number').onchange = updatePreview;
    updatePreview();

    document.getElementById('add-custom-btn').onclick = () => {
      const sentenceRU = document.getElementById('custom-ru').value.trim();
      const sentenceZH = document.getElementById('custom-zh').value.trim();
      const source = document.getElementById('custom-source').value.trim();
      const grammarPointId = document.getElementById('custom-grammar').value;
      const caseKey = document.getElementById('custom-case').value;
      const number = document.getElementById('custom-number').value;
      const targetWordForm = document.getElementById('custom-target').value.trim();

      if (!sentenceRU || !sentenceZH || !targetWordForm) {
        alert('请填写俄语句子、中文翻译和变格后的词形');
        return;
      }

      const node = this.data.framework.nodes.find(n => n.id === grammarPointId);
      const newSentence = {
        grammarPointId,
        grammarPointName: node ? node.name : '',
        word: node ? node.exampleWord : '',
        case: caseKey,
        number,
        sentenceRU,
        sentenceZH,
        targetWordForm,
        otherDeclensions: [],
        source: source || undefined
      };

      this.state.userSentences.push(newSentence);
      this.saveState();
      this.renderCustomSentences();

      // Clear form
      document.getElementById('custom-ru').value = '';
      document.getElementById('custom-zh').value = '';
      document.getElementById('custom-source').value = '';
      document.getElementById('custom-target').value = '';
      updatePreview();
      alert('例句已添加，进入练习即可看到');
    };

    this.renderCustomSentences();
  },

  renderCustomSentences() {
    const list = document.getElementById('custom-list');
    const card = document.getElementById('custom-list-card');
    const sentences = this.state.userSentences || [];
    if (sentences.length === 0) {
      card.style.display = 'none';
      return;
    }
    card.style.display = 'block';
    list.innerHTML = sentences.map((s, i) => `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="font-size:0.95rem;color:var(--text);margin-bottom:4px;">${s.sentenceRU}</div>
        <div style="font-size:0.85rem;color:var(--muted);margin-bottom:4px;">${s.sentenceZH}</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="meta-pill" style="font-size:0.75rem;">${s.grammarPointName}</span>
          <span class="meta-pill" style="font-size:0.75rem;">${this.data.caseUsages[s.case]?.name || s.case} · ${s.number === 'singular' ? '单数' : '复数'}</span>
          ${s.source ? `<span style="font-size:0.75rem;color:var(--muted);margin-left:auto;">来源：${s.source}</span>` : ''}
          <button onclick="App.deleteCustomSentence(${i})" style="margin-left:auto;background:none;border:none;color:var(--accent);cursor:pointer;font-size:0.8rem;">删除</button>
        </div>
      </div>
    `).join('');
  },

  deleteCustomSentence(idx) {
    if (!confirm('确定删除这条例句吗？')) return;
    this.state.userSentences.splice(idx, 1);
    this.saveState();
    this.renderCustomSentences();
  },

  // -------- Texts (课文回顾) --------
  showTexts() {
    this.switchPage('texts-page');
    this.setActiveNav('texts');
    this.renderTexts();
  },

  renderTexts() {
    const list = document.getElementById('texts-list');
    const empty = document.getElementById('texts-empty');
    const texts = this.state.userTexts || [];

    const sources = [...new Set(texts.map(t => t.source))];
    document.getElementById('text-source-list').innerHTML =
      sources.map(s => `<option value="${this.escapeHtml(s)}">`).join('');

    const editingGp = this.editingTextIndex != null
      ? (texts[this.editingTextIndex].grammarPoints || [])
      : [];
    this.renderGpPicker(editingGp);

    if (texts.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      list.innerHTML = texts.map((t, i) => `
        <div class="card mb-4">
          <div class="lesson-meta" style="margin-bottom:8px;">
            <span class="meta-pill">📖 ${this.escapeHtml(t.source)}</span>
            ${t.chapter ? `<span class="meta-pill">${this.escapeHtml(t.chapter)}</span>` : ''}
            <button onclick="App.editText(${i})" style="margin-left:auto;background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.8rem;">编辑</button>
            <button onclick="App.deleteText(${i})" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:0.8rem;">删除</button>
          </div>
          ${t.title ? `<div class="card-title" style="margin-bottom:6px;">${this.escapeHtml(t.title)}</div>` : ''}
          ${(t.grammarPoints || []).length > 0 ? `<div class="lesson-meta" style="margin-bottom:8px;">${t.grammarPoints.map(id => `<span class="gp-chip active" style="cursor:default;">${this.escapeHtml(this.gpName(id))}</span>`).join('')}</div>` : ''}
          <div class="lesson-ru">${this.escapeHtml(t.contentRU)}</div>
          ${t.contentZH ? `<div class="lesson-zh">${this.escapeHtml(t.contentZH)}</div>` : ''}
        </div>
      `).join('');
    }

    const btn = document.getElementById('add-text-btn');
    btn.textContent = this.editingTextIndex == null ? '导入课文' : '保存修改';
    btn.onclick = () => this.addText();
  },

  gpName(id) {
    const node = this.data.framework.nodes.find(n => n.id === id);
    return node ? node.name : id;
  },

  renderGpPicker(selectedIds) {
    const picker = document.getElementById('text-grammar-picker');
    const grammarNodes = this.data.framework.nodes.filter(n => n.type === 'grammarPoint');
    picker.innerHTML = grammarNodes.map(n =>
      `<span class="gp-chip${selectedIds.includes(n.id) ? ' active' : ''}" data-id="${n.id}" onclick="this.classList.toggle('active')">${n.name}</span>`
    ).join('');
  },

  getSelectedGpIds() {
    return Array.from(document.querySelectorAll('#text-grammar-picker .gp-chip.active'))
      .map(el => el.dataset.id);
  },

  editText(idx) {
    const t = (this.state.userTexts || [])[idx];
    if (!t) return;
    this.editingTextIndex = idx;
    document.getElementById('text-source').value = t.source;
    document.getElementById('text-chapter').value = t.chapter;
    document.getElementById('text-title').value = t.title || '';
    document.getElementById('text-content-ru').value = t.contentRU;
    document.getElementById('text-content-zh').value = t.contentZH || '';
    this.renderTexts();
    document.getElementById('add-text-card').scrollIntoView({ behavior: 'smooth' });
  },

  addText() {
    const source = document.getElementById('text-source').value.trim();
    const chapter = document.getElementById('text-chapter').value.trim();
    const title = document.getElementById('text-title').value.trim();
    const contentRU = document.getElementById('text-content-ru').value.trim();
    const contentZH = document.getElementById('text-content-zh').value.trim();

    if (!source || !chapter || !contentRU) {
      alert('请填写教材名称、章节和俄语课文');
      return;
    }

    const lesson = {
      source,
      chapter,
      title: title || '',
      contentRU,
      contentZH: contentZH || '',
      grammarPoints: this.getSelectedGpIds()
    };

    let msg = '课文已导入';
    if (this.editingTextIndex != null) {
      this.state.userTexts[this.editingTextIndex] = lesson;
      this.editingTextIndex = null;
      msg = '课文已更新';
    } else {
      this.state.userTexts.push(lesson);
    }
    this.saveState();
    this.renderTexts();

    document.getElementById('text-source').value = '';
    document.getElementById('text-chapter').value = '';
    document.getElementById('text-title').value = '';
    document.getElementById('text-content-ru').value = '';
    document.getElementById('text-content-zh').value = '';
    alert(msg);
  },

  deleteText(idx) {
    if (!confirm('确定删除这篇课文吗？')) return;
    this.state.userTexts.splice(idx, 1);
    if (this.editingTextIndex === idx) this.editingTextIndex = null;
    this.saveState();
    this.renderTexts();
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
