Object.assign(App, {
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
});
