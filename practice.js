Object.assign(App, {
  showPractice() {
    this.switchPage('practice-page');
    this.setActiveNav('practice');

    // Resume an unfinished session instead of restarting
    if (this.practice.completed) {
      document.getElementById('practice-empty').classList.add('hidden');
      this.showPracticeComplete();
      return;
    }
    if (this.practice.queue && this.practice.queue.length > 0 && this.practice.index < this.practice.queue.length) {
      document.getElementById('practice-complete').classList.add('hidden');
      document.getElementById('practice-empty').classList.add('hidden');
      document.getElementById('sentence-card').classList.remove('hidden');
      this.renderSentence(this.practice.index, true);
      return;
    }
    this.startPractice();
  },

  startPractice() {
    this.practice.queue = this.generateQueue();
    this.practice.index = 0;
    this.practice.completed = false;

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
    let mode = this.state.practiceMode || 'random';
    if (mode === 'byEnding') mode = 'random';
    const allCases = ['nominative', 'genitive', 'dative', 'accusative', 'instrumental', 'prepositional'];
    const unlocked = this.state.unlockedCases || allCases;
    const allSentences = [...this.sentences, ...(this.state.userSentences || [])];

    let pool;
    if (mode === 'special') {
      // Special mode ignores map unlock state: choosing the mode IS the selection
      const specialIds = this.data.framework.nodes
        .filter(n => n.parentId === 'special' && n.type === 'grammarPoint')
        .map(n => n.id);
      pool = allSentences.filter(s =>
        specialIds.includes(s.grammarPointId) && unlocked.includes(s.case)
      );
    } else {
      pool = allSentences.filter(s =>
        this.state.unlockedNodes.includes(s.grammarPointId) && unlocked.includes(s.case)
      );
      if (mode === 'byCase') {
        const selected = (this.state.practiceCases && this.state.practiceCases.length > 0)
          ? this.state.practiceCases : allCases;
        pool = pool.filter(s => selected.includes(s.case));
      }
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

  renderSentence(idx, keepChat) {
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
    document.getElementById('progress-text').textContent = `${idx + 1} / ${this.practice.queue.length}`;

    const ruleBtn = document.getElementById('toggle-rule-btn');
    ruleBtn.disabled = true;

    if (!keepChat) {
      this.chatHistory = [];
      document.getElementById('chat-messages').innerHTML = '';
      document.getElementById('chat-panel').classList.add('hidden');
    }

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
    inputEl.placeholder = '在这里把上面的文字打一遍（标点可省略）';
    if (targetLetters.length === 0) {
      this.renderTypingProgress(textEl, targetText, 0);
      inputEl.disabled = true;
      if (onComplete) onComplete();
      return;
    }
    inputEl.disabled = false;
    inputEl.focus();
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

  showPracticeComplete() {
    this.practice.completed = true;
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
      const ruEl = document.getElementById('complete-lesson-ru');
      const inputEl = document.getElementById('complete-lesson-input');
      const paras = t.contentRU.split(/\n+/).map(p => p.trim()).filter(Boolean);
      if (paras.length === 0) {
        inputEl.disabled = true;
      } else {
        const showPara = (k) => {
          const div = document.createElement('div');
          div.style.marginBottom = '10px';
          ruEl.appendChild(div);
          this.attachTyping(div, inputEl, paras[k], () => {
            if (k + 1 < paras.length) {
              showPara(k + 1);
            } else {
              inputEl.placeholder = '✓ 课文完成';
            }
          });
        };
        showPara(0);
      }
    } else {
      lessonBox.innerHTML = '';
    }
  },
  restartPractice() {
    document.getElementById('practice-complete').classList.add('hidden');
    this.startPractice();
  },
});
