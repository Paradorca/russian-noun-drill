Object.assign(App, {
  showSettings() {
    this.switchPage('settings-page');
    this.setActiveNav('settings');
    this.renderSettings();
  },

  renderSettings() {
    const modeSelect = document.getElementById('mode-select');
    const currentMode = this.state.practiceMode === 'byEnding' ? 'random' : (this.state.practiceMode || 'random');
    modeSelect.value = currentMode;

    const bycasePicker = document.getElementById('bycase-picker');
    const renderByCaseChips = () => {
      bycasePicker.style.display = modeSelect.value === 'byCase' ? 'block' : 'none';
      const allCases = ['nominative', 'genitive', 'dative', 'accusative', 'instrumental', 'prepositional'];
      const selected = new Set(
        (this.state.practiceCases && this.state.practiceCases.length > 0)
          ? this.state.practiceCases : allCases
      );
      document.getElementById('bycase-chips').innerHTML = allCases.map(c =>
        `<span class="chip${selected.has(c) ? ' active' : ''}" data-case="${c}">${this.caseName(c)}</span>`
      ).join('');
      document.querySelectorAll('#bycase-chips .chip').forEach(chip => {
        chip.onclick = () => {
          const cur = new Set(
            (this.state.practiceCases && this.state.practiceCases.length > 0)
              ? this.state.practiceCases : allCases
          );
          const c = chip.dataset.case;
          if (cur.has(c)) {
            if (cur.size === 1) return; // keep at least one case selected
            cur.delete(c);
          } else {
            cur.add(c);
          }
          this.state.practiceCases = Array.from(cur);
          this.saveState();
          renderByCaseChips();
        };
      });
    };
    renderByCaseChips();

    modeSelect.onchange = (e) => {
      this.state.practiceMode = e.target.value;
      this.saveState();
      renderByCaseChips();
    };

    const aiProvider = document.getElementById('ai-provider');
    const aiKeyInput = document.getElementById('ai-api-key');
    const aiHint = document.getElementById('ai-key-hint');
    const updateAiHint = () => {
      const p = this.aiProviders[aiProvider.value];
      aiHint.textContent = p ? p.hint : '';
    };
    aiProvider.value = this.state.aiProvider || 'deepseek';
    aiKeyInput.value = this.state.aiApiKey || '';
    updateAiHint();
    aiProvider.onchange = () => {
      this.state.aiProvider = aiProvider.value;
      this.saveState();
      updateAiHint();
    };
    aiKeyInput.onchange = () => {
      this.state.aiApiKey = aiKeyInput.value.trim();
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

  resetProgress() {
    if (confirm('确定要重置所有学习进度吗？这将清空已点亮的语法点和练习记录。')) {
      localStorage.removeItem('russianNounDrillState');
      location.reload();
    }
  }
});
