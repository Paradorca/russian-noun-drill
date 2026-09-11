#!/usr/bin/env node
// 内容维护脚本：管理 grammar-data.json 与 sentences-data.json
// 用法见 DATA-GUIDE.md 第七节。纯 Node，无第三方依赖。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GRAMMAR_PATH = path.join(ROOT, 'grammar-data.json');
const SENTENCES_PATH = path.join(ROOT, 'sentences-data.json');

const CASES = ['nominative', 'genitive', 'dative', 'accusative', 'instrumental', 'prepositional'];
const FORM_KEYS = ['masculine', 'neuter', 'feminine', 'plural', 'comparative', 'compound'];
const NUMBER_KEYS = ['singular', 'plural'];

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}
function fail(msg) {
  console.error('❌ ' + msg);
  process.exit(1);
}

function loadData() {
  const grammar = readJSON(GRAMMAR_PATH);
  const sentences = readJSON(SENTENCES_PATH);
  return { grammar, sentences };
}

function nodeById(grammar, id) {
  return grammar.framework.nodes.find(n => n.id === id);
}

// 例句里显示的 grammarPointName 约定：名词变格带父类前缀（如「第一变格法 — 硬变化 -а 结尾」），其余等于节点名
function displayName(grammar, node) {
  const parent = node.parentId ? nodeById(grammar, node.parentId) : null;
  if (parent && parent.type === 'category' && parent.parentId && parent.parentId !== 'root') {
    return parent.name + ' — ' + node.name;
  }
  return node.name;
}

// ---- list ----
function cmdList() {
  const { grammar, sentences } = loadData();
  const nodes = grammar.framework.nodes;
  const branches = nodes.filter(n => n.type === 'category' && n.parentId === 'root');
  const count = (gpId) => sentences.filter(s => s.grammarPointId === gpId).length;

  console.log('知识点清单\n');
  for (const b of branches) {
    const points = nodes.filter(n => n.type === 'grammarPoint' && belongsTo(nodes, n, b.id));
    const total = points.reduce((sum, p) => sum + count(p.id), 0);
    console.log(`【${b.name}】${b.id} — ${points.length} 个知识点 / ${total} 条例句`);
    for (const p of points) {
      const status = p.pending ? '⏳ 待补充' : '✅';
      console.log(`  ${status} ${p.id}  ${p.name}  ${p.exampleWord || ''}  (${count(p.id)} 句)`);
    }
    console.log('');
  }
  const pending = nodes.filter(n => n.type === 'grammarPoint' && n.pending);
  console.log(`待补充知识点：${pending.length} 个`);
  console.log(`例句总数：${sentences.length} 条`);
}

function belongsTo(nodes, node, branchId) {
  let n = node;
  while (n && n.parentId && n.parentId !== 'root') n = nodes.find(x => x.id === n.parentId);
  return n ? n.id === branchId : false;
}

// ---- validate ----
function cmdValidate() {
  const { grammar, sentences } = loadData();
  const nodes = grammar.framework.nodes;
  const errors = [];
  const warn = [];

  // 1. framework 结构
  const ids = new Set(nodes.map(n => n.id));
  for (const n of nodes) {
    if (!n.id || !n.name || !n.type) errors.push(`节点缺 id/name/type：${JSON.stringify(n)}`);
    if (n.parentId !== null && n.parentId !== undefined && !ids.has(n.parentId)) {
      errors.push(`节点 ${n.id} 的 parentId「${n.parentId}」不存在`);
    }
  }
  const grammarPoints = nodes.filter(n => n.type === 'grammarPoint');
  for (const p of grammarPoints) {
    if (!p.pending) {
      if (!p.exampleWord) errors.push(`知识点 ${p.id} 缺 exampleWord`);
      if (!p.description) warn.push(`知识点 ${p.id} 缺 description`);
      if (p.tableType !== 'personal' && !p.declensionTable && p.tableType !== 'comparative' && p.tableType !== 'superlative') {
        // comparative/superlative 用 pairs；其余应有 declensionTable（personal 例外）
        if (p.tableType !== 'comparative' && p.tableType !== 'superlative' && p.tableType !== 'short' && p.tableType !== 'adjective' && p.tableType) {
          // 名词等必须有 declensionTable
          if (!p.declensionTable) errors.push(`知识点 ${p.id} 缺 declensionTable`);
        }
      }
      if (!p.highlight) warn.push(`知识点 ${p.id} 缺 highlight`);
      if (!p.tips) warn.push(`知识点 ${p.id} 缺 tips`);
    }
  }

  // 2. 例句字段 + 引用
  const gpIds = new Set(grammarPoints.map(p => p.id));
  const seen = new Set();
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const tag = `例句 #${i}「${s.sentenceRU || ''}」`;
    if (!s.grammarPointId) { errors.push(`${tag} 缺 grammarPointId`); continue; }
    if (!gpIds.has(s.grammarPointId)) { errors.push(`${tag} 引用了不存在的 grammarPointId「${s.grammarPointId}」`); continue; }
    const node = nodeById(grammar, s.grammarPointId);
    if (node.pending) errors.push(`${tag} 引用了待补充知识点「${s.grammarPointId}」`);
    if (s.grammarPointName !== displayName(grammar, node)) warn.push(`${tag} grammarPointName「${s.grammarPointName}」≠ 应为「${displayName(grammar, node)}」`);
    if (s.word !== node.exampleWord && !s.word) errors.push(`${tag} 缺 word`);
    if (s.case && !CASES.includes(s.case)) errors.push(`${tag} case「${s.case}」非法`);
    const hasForm = 'form' in s && s.form !== undefined && s.form !== '';
    const hasNumber = 'number' in s && s.number !== undefined && s.number !== '';
    if (hasForm && hasNumber) errors.push(`${tag} 同时有 form 和 number`);
    if (!hasForm && !hasNumber) errors.push(`${tag} form/number 二者缺一`);
    if (hasForm && !FORM_KEYS.includes(s.form)) errors.push(`${tag} form「${s.form}」非法`);
    if (hasNumber && !NUMBER_KEYS.includes(s.number)) errors.push(`${tag} number「${s.number}」非法`);
    if (!s.sentenceRU || !s.sentenceZH || !s.targetWordForm) errors.push(`${tag} 缺 sentenceRU/sentenceZH/targetWordForm`);

    // target 精确匹配
    if (s.sentenceRU && s.targetWordForm) {
      const tokens = s.sentenceRU.split(/([ ,.!?;:"«»—]+)/);
      if (!tokens.includes(s.targetWordForm)) {
        errors.push(`${tag} targetWordForm「${s.targetWordForm}」未在 sentenceRU 中精确匹配`);
      }
    }
    // otherDeclensions 校验
    for (const od of (s.otherDeclensions || [])) {
      if (!od.word || !od.case || !od.brief) { errors.push(`${tag} otherDeclensions 项缺 word/case/brief`); continue; }
      if (!CASES.includes(od.case)) errors.push(`${tag} otherDeclensions.case「${od.case}」非法`);
      if (s.sentenceRU) {
        const tokens = s.sentenceRU.split(/([ ,.!?;:"«»—]+)/);
        if (!tokens.includes(od.word)) errors.push(`${tag} otherDeclensions.word「${od.word}」未在 sentenceRU 中匹配`);
      }
    }
    // 重复检测（同 gp + ru + target）
    const dupKey = `${s.grammarPointId}|${s.sentenceRU}|${s.targetWordForm}`;
    if (seen.has(dupKey)) warn.push(`${tag} 疑似重复例句`);
    seen.add(dupKey);
  }

  // 3. pending 点不应有例句
  for (const p of grammarPoints.filter(p => p.pending)) {
    const c = sentences.filter(s => s.grammarPointId === p.id).length;
    if (c > 0) errors.push(`待补充知识点「${p.id}」仍有 ${c} 条例句`);
  }

  // 4. 拉丁带重音字母（应统一为西里尔字母 + 组合重音 U+0301）
  const latinAccent = /[áéíóúýÁÉÍÓÚÝ]/;
  const latinSet = new Set();
  sentences.forEach((s, i) => {
    const ods = (s.otherDeclensions || []).map(o => o.word).join('');
    if (latinAccent.test(s.sentenceRU + s.targetWordForm + ods)) latinSet.add(i);
  });
  if (latinSet.size > 0) {
    warn.push(`${latinSet.size} 条例句含拉丁带重音字母（á/é/í/ó/ú），建议统一为西里尔字母 + 组合重音`);
  }

  if (errors.length) {
    console.error('校验失败：\n' + errors.map(e => '  ✗ ' + e).join('\n'));
    if (warn.length) console.log('\n提示：\n' + warn.map(w => '  ⚠ ' + w).join('\n'));
    process.exit(1);
  }
  console.log(`✅ 校验通过：${grammarPoints.length} 个知识点，${sentences.length} 条例句`);
  if (warn.length) console.log('提示：\n' + warn.map(w => '  ⚠ ' + w).join('\n'));
}

// ---- add-sentences ----
function cmdAddSentences(file) {
  if (!file) fail('用法：node tools/curate.js add-sentences <输入文件.json>');
  const { grammar, sentences } = loadData();
  const input = readJSON(path.resolve(ROOT, file));
  const list = Array.isArray(input) ? input : [input];

  const out = [];
  for (const it of list) {
    const node = nodeById(grammar, it.gp);
    if (!node) fail(`gp「${it.gp}」不存在`);
    if (node.pending) fail(`gp「${it.gp}」是待补充点，不能生成例句`);
    if (!it.case || !CASES.includes(it.case)) fail(`case「${it.case}」非法`);
    if (!it.ru || !it.zh || !it.target) fail(`缺 ru/zh/target：${JSON.stringify(it)}`);
    const hasForm = it.form !== undefined && it.form !== '';
    const hasNumber = it.number !== undefined && it.number !== '';
    if (hasForm === hasNumber) fail(`form/number 必须且只能填一个：${JSON.stringify(it)}`);

    const s = {
      grammarPointId: it.gp,
      grammarPointName: displayName(grammar, node),
      word: it.word || node.exampleWord,
      case: it.case,
      sentenceRU: it.ru,
      sentenceZH: it.zh,
      targetWordForm: it.target,
      otherDeclensions: it.od || []
    };
    if (hasForm) s.form = it.form;
    else s.number = it.number;
    out.push(s);
  }

  const merged = sentences.concat(out);
  writeJSON(SENTENCES_PATH, merged);
  console.log(`✅ 已追加 ${out.length} 条例句（总数 ${merged.length}）`);
}

// ---- add-point ----
function cmdAddPoint(file) {
  if (!file) fail('用法：node tools/curate.js add-point <输入文件.json>');
  const { grammar, sentences } = loadData();
  const input = readJSON(path.resolve(ROOT, file));
  const list = Array.isArray(input) ? input : [input];
  const nodes = grammar.framework.nodes;

  for (const p of list) {
    if (!p.id || !p.name) fail(`知识点缺 id/name：${JSON.stringify(p)}`);
    if (nodeById(grammar, p.id)) fail(`知识点 id「${p.id}」已存在`);
    if (p.parentId && !nodeById(grammar, p.parentId)) fail(`parentId「${p.parentId}」不存在`);
    const point = Object.assign({
      type: 'grammarPoint',
      pending: true,
      parentId: p.parentId
    }, p);
    nodes.push(point);
  }

  writeJSON(GRAMMAR_PATH, grammar);
  console.log(`✅ 已新增 ${list.length} 个知识点`);
}

// ---- edit-point ----
function cmdEditPoint(file) {
  if (!file) fail('用法：node tools/curate.js edit-point <输入文件.json>');
  const { grammar } = loadData();
  const input = readJSON(path.resolve(ROOT, file));
  const list = Array.isArray(input) ? input : [input];

  for (const patch of list) {
    if (!patch.id) fail(`缺 id：${JSON.stringify(patch)}`);
    const node = nodeById(grammar, patch.id);
    if (!node) fail(`知识点 id「${patch.id}」不存在`);
    Object.assign(node, patch);
  }

  writeJSON(GRAMMAR_PATH, grammar);
  console.log(`✅ 已更新 ${list.length} 个知识点`);
}

// ---- delete-sentence ----
function cmdDeleteSentence(arg) {
  if (arg === undefined) fail('用法：node tools/curate.js delete-sentence <序号|匹配子串>');
  const { sentences } = loadData();

  if (/^\d+$/.test(arg)) {
    const i = parseInt(arg, 10);
    if (i < 0 || i >= sentences.length) fail(`序号 ${i} 越界（共 ${sentences.length} 条）`);
    const removed = sentences.splice(i, 1);
    writeJSON(SENTENCES_PATH, sentences);
    console.log(`✅ 已删除第 ${i} 条：${removed[0].sentenceRU}`);
    return;
  }

  const matches = sentences
    .map((s, i) => ({ s, i }))
    .filter(x => x.s.sentenceRU.includes(arg) || x.s.targetWordForm.includes(arg));
  if (matches.length === 0) fail(`未找到匹配「${arg}」的例句`);
  if (matches.length > 1) {
    console.log(`匹配到 ${matches.length} 条，请用序号指定：`);
    matches.forEach(m => console.log(`  [${m.i}] ${m.s.sentenceRU}  →  ${m.s.targetWordForm}`));
    process.exit(1);
  }
  const { s, i } = matches[0];
  sentences.splice(i, 1);
  writeJSON(SENTENCES_PATH, sentences);
  console.log(`✅ 已删除第 ${i} 条：${s.sentenceRU}`);
}

// ---- dispatch ----
const [, , cmd, ...args] = process.argv;
switch (cmd) {
  case 'list': cmdList(); break;
  case 'validate': cmdValidate(); break;
  case 'add-sentences': cmdAddSentences(args[0]); break;
  case 'add-point': cmdAddPoint(args[0]); break;
  case 'edit-point': cmdEditPoint(args[0]); break;
  case 'delete-sentence': cmdDeleteSentence(args[0]); break;
  default:
    console.log(`用法：node tools/curate.js <命令>\n
  list                     打印知识点清单 + 待补充点 + 例句数
  validate                 全量校验（JSON、target 匹配、孤立引用、pending 残留）
  add-sentences <f.json>   读紧凑输入并追加例句
  add-point <f.json>       新增知识点（骨架，默认 pending:true）
  edit-point <f.json>      按 id 合并更新知识点
  delete-sentence <序号|串> 按序号或匹配子串删除例句`);
}
