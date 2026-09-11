Object.assign(App, {
  showSettings() {
    this.switchPage('settings-page');
    this.setActiveNav('settings');
    this.renderSettings();
  },

  renderSettings() {
    const modeSelect = document.getElementById('mode-select');
    const branches = this.data.framework.nodes.filter(n => n.type === 'category' && n.parentId === 'root');
    modeSelect.innerHTML = branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    const validIds = branches.map(b => b.id);
    if (!validIds.includes(this.state.practiceMode)) {
      this.state.practiceMode = validIds[0];
      this.saveState();
    }
    modeSelect.value = this.state.practiceMode;
    modeSelect.onchange = (e) => {
      this.state.practiceMode = e.target.value;
      this.saveState();
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
  },

  resetProgress() {
    if (confirm('确定要重置所有学习进度吗？这将清空已点亮的语法点和练习记录。')) {
      localStorage.removeItem('russianNounDrillState');
      location.reload();
    }
  }
});
