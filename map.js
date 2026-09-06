Object.assign(App, {
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
    const branches = nodes.filter(n => n.type === 'category' && n.parentId === root.id);
    branches.forEach(branch => container.appendChild(this.renderBranchCard(branch, nodes)));
  },

  renderBranchCard(branch, nodes) {
    const card = document.createElement('div');
    card.className = 'map-category';

    const header = document.createElement('div');
    header.className = 'map-category-header';
    const isCollapsed = this.state.collapsedCategories?.includes(branch.id);
    if (isCollapsed) header.classList.add('collapsed');

    const branchUnlocked = this.state.unlockedNodes.includes(branch.id);
    header.innerHTML = `
      <span style="color:${branchUnlocked ? 'var(--success)' : 'var(--muted)'};">●</span>
      <span>${branch.name}</span>
      <span class="chevron">▼</span>
    `;
    header.onclick = () => this.toggleCategory(branch.id);
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'map-children';
    if (isCollapsed) body.classList.add('hidden');

    if (branch.id === 'noun-decl') {
      body.appendChild(this.renderRefCard('📐 变格规则', this.buildDeclTableHTML()));
      body.appendChild(this.renderRefCard('📘 格的含义', this.buildCaseMeaningHTML()));
      card.appendChild(body);
      return card;
    }

    const renderPoint = (child) => {
      const nodeEl = document.createElement('div');
      const isActive = this.state.unlockedNodes.includes(child.id);
      nodeEl.className = `map-node ${isActive ? 'active' : ''}`;
      nodeEl.innerHTML = `
        <div class="node-dot"></div>
        <div class="node-info">
          <div class="node-name">${child.name}</div>
          <div class="node-example">${child.pending ? '待补充' : `例：${child.exampleWord}`}</div>
        </div>
      `;
      nodeEl.onclick = () => this.toggleNode(child.id);
      return nodeEl;
    };

    const children = nodes.filter(n => n.parentId === branch.id);
    children.forEach(child => {
      if (child.type === 'category') {
        const subHeader = document.createElement('div');
        subHeader.className = 'map-subcategory';
        subHeader.textContent = child.name;
        body.appendChild(subHeader);
        nodes.filter(n => n.parentId === child.id && n.type === 'grammarPoint')
          .forEach(gp => body.appendChild(renderPoint(gp)));
      } else if (child.type === 'grammarPoint') {
        body.appendChild(renderPoint(child));
      }
    });

    card.appendChild(body);
    return card;
  },

  renderRefCard(title, innerHTML) {
    const el = document.createElement('div');
    el.className = 'map-refcard';
    const head = document.createElement('div');
    head.className = 'map-refcard-header';
    head.innerHTML = `<span>${title}</span><span class="chevron">▼</span>`;
    const bodyEl = document.createElement('div');
    bodyEl.className = 'map-refcard-body hidden';
    bodyEl.innerHTML = innerHTML;
    head.onclick = () => {
      bodyEl.classList.toggle('hidden');
      head.querySelector('.chevron').style.transform =
        bodyEl.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    };
    el.appendChild(head);
    el.appendChild(bodyEl);
    return el;
  },

  buildDeclTableHTML() {
    const rows = [
      ['1（主格）', '—', 'студе́нт', '-й', 'музе́й', '-ь', 'писа́тель', '-ий', 'санато́рий'],
      ['2（属格）', '-а', 'студе́нта', '-я', 'музе́я', '-я', 'писа́теля', '-ия', 'санато́рия'],
      ['3（与格）', '-у', 'студе́нту', '-ю', 'музе́ю', '-ю', 'писа́телю', '-ию', 'санато́рию'],
      ['4（宾格）', '同一或二', 'студе́нта', '同一或二', 'музе́й', '同一或二', 'писа́теля', '同一或二', 'санато́рий'],
      ['5（工具格）', '-ом', 'студе́нтом', '-ем', 'музе́ем', '-ем', 'писа́телем', '-ием', 'санато́рием'],
      ['6（前置格）', '-е', 'о студе́нте', '-е', 'о музе́е', '-е', 'о писа́теле', '-ии', 'о санато́рии']
    ];
    const body = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    return `
      <div class="table-scroll">
        <table class="rule-table decl-table">
          <tr><th>格</th><th>辅音结尾</th><th>示例</th><th>-й 结尾</th><th>示例</th><th>-ь 结尾</th><th>示例</th><th>-ий 结尾</th><th>示例</th></tr>
          ${body}
        </table>
      </div>
    `;
  },

  buildCaseMeaningHTML() {
    const order = ['nominative', 'genitive', 'dative', 'accusative', 'instrumental', 'prepositional'];
    return order.map(k => {
      const u = this.data.caseUsages[k];
      return `
        <div class="case-meaning-item">
          <h5>${u.name}</h5>
          <p><strong>含义：</strong>${u.meaning}</p>
          <p><strong>用法：</strong>${u.usage}</p>
          <p><strong>例句：</strong>${u.example}</p>
          ${u.prepositions.length > 0 ? `<div class="prep-list">${u.prepositions.map(p => `<span class="prep-tag">${p}</span>`).join('')}</div>` : ''}
        </div>
      `;
    }).join('');
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
      let node = this.data.framework.nodes.find(n => n.id === nodeId);
      while (node && node.parentId) {
        if (!this.state.unlockedNodes.includes(node.parentId)) {
          this.state.unlockedNodes.push(node.parentId);
        }
        node = this.data.framework.nodes.find(n => n.id === node.parentId);
      }
    }
    this.saveState();
    this.renderMap();
  }
});
