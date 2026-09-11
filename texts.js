Object.assign(App, {
  showTexts() {
    this.switchPage('texts-page');
    this.setActiveNav('texts');
    this.renderCorpus();
  },

  renderCorpus() {
    const tabs = {
      sentence: document.getElementById('corpus-tab-sentence'),
      text: document.getElementById('corpus-tab-text'),
      list: document.getElementById('corpus-tab-list')
    };
    tabs.sentence.onclick = () => this.showCorpusTab('sentence');
    tabs.text.onclick = () => this.showCorpusTab('text');
    tabs.list.onclick = () => this.showCorpusTab('list');

    this.renderSentenceForm();
    this.renderTexts();
    this.showCorpusTab(null);
  },

  showCorpusTab(name) {
    document.getElementById('add-sentence-panel').classList.toggle('hidden', name !== 'sentence');
    document.getElementById('add-text-panel').classList.toggle('hidden', name !== 'text');
    document.getElementById('texts-list-panel').classList.toggle('hidden', name !== 'list');
    if (name === 'list') this.renderTexts();

    const map = { sentence: 'corpus-tab-sentence', text: 'corpus-tab-text', list: 'corpus-tab-list' };
    ['corpus-tab-sentence', 'corpus-tab-text', 'corpus-tab-list'].forEach(id => {
      const btn = document.getElementById(id);
      btn.classList.toggle('btn-primary', id === map[name]);
      btn.classList.toggle('btn-secondary', id !== map[name]);
    });
  },

  renderSentenceForm() {
    const sel = document.getElementById('custom-grammar');
    if (sel && sel.options.length === 0) {
      const nodes = this.data.framework.nodes;
      const branches = nodes.filter(n => n.type === 'category' && n.parentId === 'root');
      const branchOf = (gpId) => {
        let n = nodes.find(x => x.id === gpId);
        while (n && n.parentId && n.parentId !== 'root') n = nodes.find(x => x.id === n.parentId);
        return n ? n.id : null;
      };
      branches.forEach(b => {
        const points = nodes.filter(n => n.type === 'grammarPoint' && !n.pending && branchOf(n.id) === b.id);
        if (points.length === 0) return;
        const group = document.createElement('optgroup');
        group.label = b.name;
        points.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name;
          group.appendChild(opt);
        });
        sel.appendChild(group);
      });
    }

    document.getElementById('add-custom-btn').onclick = () => this.addCustomSentence();
    this.renderCustomSentences();
  },

  addCustomSentence() {
    const sentenceRU = document.getElementById('custom-ru').value.trim();
    const sentenceZH = document.getElementById('custom-zh').value.trim();
    const source = document.getElementById('custom-source').value.trim();
    const grammarPointId = document.getElementById('custom-grammar').value;

    if (!sentenceRU || !sentenceZH) {
      alert('请填写俄语句子和中文翻译');
      return;
    }
    const node = this.data.framework.nodes.find(n => n.id === grammarPointId);
    const detected = node ? this.detectTarget(node, sentenceRU) : null;

    const newSentence = {
      grammarPointId,
      grammarPointName: node ? node.name : '',
      word: node ? node.exampleWord : '',
      sentenceRU,
      sentenceZH,
      targetWordForm: detected ? detected.target : '',
      otherDeclensions: [],
      source: source || undefined
    };
    if (detected) {
      if (detected.form) newSentence.form = detected.form;
      if (detected.number) newSentence.number = detected.number;
      if (detected.case) newSentence.case = detected.case;
    }

    this.state.userSentences.push(newSentence);
    this.saveState();
    this.renderCustomSentences();

    document.getElementById('custom-ru').value = '';
    document.getElementById('custom-zh').value = '';
    document.getElementById('custom-source').value = '';
    alert(detected ? '例句已添加，已自动识别目标词形' : '例句已添加（未能自动识别目标词形，练习时不显示高亮）');
  },

  detectTarget(node, sentenceRU) {
    const tokens = sentenceRU.split(/[ ,.!?;:"«»—]+/).filter(Boolean);
    if (tokens.length === 0) return null;
    const norm = (s) => this.normalizeLetters(s);
    const caseOrder = ['nominative', 'genitive', 'dative', 'accusative', 'instrumental', 'prepositional'];
    const candidates = [];

    const push = (text, caseKey, formKey, numberKey) => {
      if (!text || text === '同一或二' || text === '—') return;
      candidates.push({ text, case: caseKey, form: formKey, number: numberKey });
    };

    const isShort = node.tableType === 'short';
    const isAdj = node.tableType === 'adjective';
    const formKeys = (isShort || isAdj) ? ['masculine', 'neuter', 'feminine', 'plural'] : ['singular', 'plural'];
    const scanTable = (t) => {
      if (!t) return;
      for (const key of formKeys) {
        const cell = t[key];
        if (isShort) {
          push(cell, 'nominative', key, null);
        } else if (Array.isArray(cell)) {
          cell.forEach((text, i) => push(text, caseOrder[i], isAdj ? key : null, isAdj ? null : key));
        }
      }
    };

    scanTable(node.declensionTable);
    (node.examples || []).forEach(e => scanTable(e.table));
    if (node.caseTable) {
      node.caseTable.rows.forEach(r => (r.forms || []).forEach(text => push(text, r.case, null, 'singular')));
    }
    if (node.comparativePairs) {
      node.comparativePairs.forEach(p => push(p.comparative, null, 'comparative', null));
    }
    if (node.superlativePairs) {
      node.superlativePairs.forEach(p => push(p.superlative, null, null, null));
    }

    for (const c of candidates) {
      if (tokens.includes(c.text)) return this._detectedResult(c);
    }
    for (const c of candidates) {
      const n = norm(c.text);
      if (!n) continue;
      const hit = tokens.find(t => norm(t) === n);
      if (hit) return this._detectedResult({ ...c, text: hit });
    }
    return null;
  },

  _detectedResult(c) {
    const d = { target: c.text, case: c.case };
    if (c.form) d.form = c.form;
    if (c.number) d.number = c.number;
    return d;
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
    list.innerHTML = sentences.map((s, i) => {
      let pill = '';
      if (s.case) {
        pill = `<span class="meta-pill" style="font-size:0.75rem;">${this.data.caseUsages[s.case]?.name || s.case} · ${this.formName(s)}</span>`;
      } else if (s.form) {
        pill = `<span class="meta-pill" style="font-size:0.75rem;">${this.formName(s)}</span>`;
      }
      return `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="font-size:0.95rem;color:var(--text);margin-bottom:4px;">${s.sentenceRU}</div>
        <div style="font-size:0.85rem;color:var(--muted);margin-bottom:4px;">${s.sentenceZH}</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="meta-pill" style="font-size:0.75rem;">${s.grammarPointName}</span>
          ${pill}
          ${s.source ? `<span style="font-size:0.75rem;color:var(--muted);margin-left:auto;">来源：${s.source}</span>` : ''}
          <button onclick="App.deleteCustomSentence(${i})" style="margin-left:auto;background:none;border:none;color:var(--accent);cursor:pointer;font-size:0.8rem;">删除</button>
        </div>
      </div>`;
    }).join('');
  },

  deleteCustomSentence(idx) {
    if (!confirm('确定删除这条例句吗？')) return;
    this.state.userSentences.splice(idx, 1);
    this.saveState();
    this.renderCustomSentences();
  },

  renderTexts() {
    const list = document.getElementById('texts-list');
    const empty = document.getElementById('texts-empty');
    const texts = this.state.userTexts || [];

    const sources = [...new Set(texts.map(t => t.source))];
    document.getElementById('text-source-list').innerHTML =
      sources.map(s => `<option value="${this.escapeHtml(s)}">`).join('');

    if (texts.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      const items = texts.map((t, i) => ({ t, i })).reverse();
      list.innerHTML = items.map(({ t, i }) => {
        const note = t.grammarNote || (t.grammarPoints || []).map(id => this.gpName(id)).join('、');
        return `
        <div class="card mb-4">
          <div class="lesson-meta" style="margin-bottom:8px;">
            <span class="meta-pill">📖 ${this.escapeHtml(t.source)}</span>
            ${t.chapter ? `<span class="meta-pill">${this.escapeHtml(t.chapter)}</span>` : ''}
            <button onclick="App.editText(${i})" style="margin-left:auto;background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.8rem;">编辑</button>
            <button onclick="App.deleteText(${i})" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:0.8rem;">删除</button>
          </div>
          ${t.title ? `<div class="card-title" style="margin-bottom:6px;">${this.escapeHtml(t.title)}</div>` : ''}
          ${note ? `<div class="lesson-meta" style="margin-bottom:8px;"><span class="meta-pill">🏷️ ${this.escapeHtml(note)}</span></div>` : ''}
          <div class="lesson-ru">${this.escapeHtml(t.contentRU)}</div>
          ${t.contentZH ? `<div class="lesson-zh">${this.escapeHtml(t.contentZH)}</div>` : ''}
        </div>
      `;
      }).join('');
    }

    const btn = document.getElementById('add-text-btn');
    btn.textContent = this.editingTextIndex == null ? '导入课文' : '保存修改';
    btn.onclick = () => this.addText();
  },

  gpName(id) {
    const node = this.data.framework.nodes.find(n => n.id === id);
    return node ? node.name : id;
  },

  editText(idx) {
    const t = (this.state.userTexts || [])[idx];
    if (!t) return;
    this.editingTextIndex = idx;
    document.getElementById('text-source').value = t.source;
    document.getElementById('text-chapter').value = t.chapter;
    document.getElementById('text-title').value = t.title || '';
    document.getElementById('text-grammar').value = t.grammarNote || (t.grammarPoints || []).map(id => this.gpName(id)).join('、');
    document.getElementById('text-content-ru').value = t.contentRU;
    document.getElementById('text-content-zh').value = t.contentZH || '';
    this.showCorpusTab('text');
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
      grammarNote: document.getElementById('text-grammar').value.trim()
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
    document.getElementById('text-grammar').value = '';
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
});
