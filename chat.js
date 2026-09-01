Object.assign(App, {
  toggleChat() {
    document.getElementById('chat-panel').classList.toggle('hidden');
  },

  appendChatMsg(role, text) {
    const box = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    div.textContent = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  },

  sendChat() {
    const input = document.getElementById('chat-input');
    const q = input.value.trim();
    if (!q) return;
    const key = (this.state.aiApiKey || '').trim();
    if (!key) {
      this.appendChatMsg('ai', '请先到「设置 → AI 语法助手」选择服务商并填写 API Key。');
      return;
    }
    this.appendChatMsg('user', q);
    input.value = '';
    const thinkingEl = this.appendChatMsg('ai', '思考中…');

    const s = this.practice.queue[this.practice.index];
    const provider = this.aiProviders[this.state.aiProvider || 'deepseek'];
    let systemPrompt = '你是一位俄语语法老师，用简体中文回答。只回答与俄语语法、句法、名词变格相关的问题；如果问题无关，礼貌地拒绝。回答要简洁，控制在150字以内。';
    if (s) {
      systemPrompt += `\n\n当前例句：${s.sentenceRU}\n中文：${s.sentenceZH}\n变格词：「${s.targetWordForm}」（${this.caseName(s.case)}，${s.number === 'singular' ? '单数' : '复数'}，语法点：${s.grammarPointName}）`;
    }
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(this.chatHistory || []),
      { role: 'user', content: q }
    ];

    fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({ model: provider.model, messages, temperature: 0.3 })
    })
      .then(r => r.json())
      .then(d => {
        const text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content)
          || ('出错了：' + JSON.stringify(d).slice(0, 200));
        thinkingEl.textContent = text;
        this.chatHistory = this.chatHistory || [];
        this.chatHistory.push({ role: 'user', content: q }, { role: 'assistant', content: text });
      })
      .catch(e => {
        thinkingEl.textContent = '网络错误：' + e.message + '（请检查网络，或确认 API Key 是否正确）';
      });
  },

  aiProviders: {
    deepseek: {
      url: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-chat',
      hint: '到 platform.deepseek.com 注册 →「API Keys」创建。充值 5 元大约可问几千次。'
    },
    zhipu: {
      url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      model: 'glm-4-flash',
      hint: '到 bigmodel.cn 注册 →「API Keys」创建。GLM-4-Flash 目前免费。'
    },
    moonshot: {
      url: 'https://api.moonshot.cn/v1/chat/completions',
      model: 'moonshot-v1-8k',
      hint: '到 platform.moonshot.cn 注册 →「API Key 管理」创建。'
    },
    qwen: {
      url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      model: 'qwen-turbo',
      hint: '到阿里云百炼平台 bailian.console.aliyun.com 开通 →「API-KEY」创建。'
    }
  },
});
