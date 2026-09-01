Object.assign(App, {
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
