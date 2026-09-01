Object.assign(App, {
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
});
