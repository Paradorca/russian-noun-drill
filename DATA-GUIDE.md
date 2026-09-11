# 数据内容指南（DATA-GUIDE）

改内容（知识点 / 例句）前先读本文件。代码约定见 `CLAUDE.md`。

## 一、数据文件

- `grammar-data.json` — 语法框架 + 六格用法。结构 `{ framework: { nodes: [...] }, caseUsages: {...} }`
- `sentences-data.json` — 例句数组（当前 308 条）

## 二、知识点清单（44 个）

状态：✅ 已填 / ⏳ 待补充（`pending: true`）

### 名词变格（noun-decl，17 个，全部 ✅）

| id | 名称 | exampleWord | 例句 |
|---|---|---|---|
| 1st-decl-hard-a | 硬变化 -а 结尾 | комната | 5 |
| 1st-decl-soft-ya | 软变化 -я 结尾 | семья | 5 |
| 1st-decl-soft-iya | 软变化 -ия 结尾 | станция | 5 |
| 2nd-decl-masc-hard-cons | 阳性硬变化 辅音结尾 | стол | 5 |
| 2nd-decl-masc-soft-y | 阳性软变化 -й 结尾 | музей | 5 |
| 2nd-decl-masc-soft-b | 阳性软变化 -ь 结尾 | словарь | 5 |
| 2nd-decl-masc-hissing | 阳性唏音变化 ж/ч/ш/щ/ц | врач | 5 |
| 2nd-decl-neut-hard-o | 中性硬变化 -о 结尾 | окно | 5 |
| 2nd-decl-neut-soft-e | 中性软变化 -е / -ё 结尾 | море | 5 |
| 2nd-decl-neut-ie | 中性 -ие 结尾 | событие | 5 |
| 3rd-decl-soft-fem-b | 常规软变化 -ь 结尾阴性 | ночь | 5 |
| 3rd-decl-archaic-mat | 古老残留型 мать / дочь | мать | 5 |
| special-mya | -мя 型中性（время 型） | время | 5 |
| special-vowel-drop | 元音脱落型（-ец / -ок / -ёнок） | отец | 5 |
| special-anin | -анин / -янин 型 | гражданин | 5 |
| special-suppletive | 异干复数 | человек | 5 |
| special-indeclinable | 不变格名词（外来词） | метро | 5 |

> 子分类：1st-decl / 2nd-decl / 3rd-decl / special 四个子 category。

### 形容词变格（adj-decl，6 个，全部 ✅）

| id | 名称 | tableType | exampleWord | 例句 |
|---|---|---|---|---|
| adj-hard | 硬变化（-ый/-ой） | adjective | новый | 18 |
| adj-soft | 软变化（-ий） | adjective | синий | 18 |
| adj-mixed | 混合变化 | adjective | хороший | 21 |
| adj-short | 短尾形容词 | short | красивый | 12 |
| adj-comparative | 比较级 | comparative | красивый | 18 |
| adj-superlative | 最高级 | superlative | красивый | 12 |

### 数词（num，7 个，全部 ⏳）

| id | 名称 |
|---|---|
| num-odin | один 的变格 |
| num-dva-chetyre | два/три/четыре 的变格与搭配 |
| num-pyat-plus | пять 及以上的变格与搭配 |
| num-ordinal | 序数词 |
| num-collective | 集合数词 |
| num-time | 时间表示法 |
| num-age | 年龄表示法 |

### 代词（pron，7 个，全部 ✅）

| id | 名称 | tableType | exampleWord | 例句 |
|---|---|---|---|---|
| pron-personal | 人称代词 | personal | я | 35 |
| pron-possessive | 物主代词 | adjective | мой | 24 |
| pron-demonstrative | 指示代词（этот/тот） | adjective | этот | 14 |
| pron-interrogative | 疑问代词（кто/что/какой/чей） | adjective + caseTable | какой | 15 |
| pron-reflexive | 反身代词（себя/свой） | adjective + caseTable | свой | 12 |
| pron-definitive | 限定代词（весь/сам） | adjective | весь | 12 |
| pron-negative | 否定代词 | adjective + caseTable | никакой | 12 |

### 动词（verb，7 个，全部 ⏳）

| id | 名称 |
|---|---|
| verb-conj1 | 第一变位法 |
| verb-conj2 | 第二变位法 |
| verb-irregular | 不规则动词 |
| verb-past | 过去时 |
| verb-future | 将来时 |
| verb-aspect | 动词体（完成体/未完成体） |
| verb-motion | 定向/不定向运动动词 |

## 三、例句字段 schema

完整字段（`sentences-data.json` 每条）：

| 字段 | 说明 | 必填 |
|---|---|---|
| grammarPointId | 知识点 id | ✅ |
| grammarPointName | 知识点名称（= 节点 name，脚本可自动填） | ✅ |
| word | 词的原形（= 节点 exampleWord，脚本可自动填） | ✅ |
| case | 六格之一 | ✅ |
| form 或 number | 二者取一：形容词/短尾用 form，名词/名词性代词用 number | ✅ |
| sentenceRU | 俄语句子 | ✅ |
| sentenceZH | 中文翻译 | ✅ |
| targetWordForm | 变格后词形，须与 sentenceRU 中某 token **精确匹配（含重音）** | ✅ |
| otherDeclensions | 其他变格词数组（可选，通常 []） | 可省 |

## 四、字段取值约定

- **case**：`nominative / genitive / dative / accusative / instrumental / prepositional`
- **form**：`masculine / neuter / feminine / plural`（形容词、短尾）；`comparative / compound`（比较级）
- **number**：`singular / plural`（名词、人称代词、кто/что/себя/никто/ничто 等名词性代词）
- **6 格顺序**（caseNames 数组固定顺序）：主格、属格、与格、宾格、工具格、前置格
- 宾格在变格表中约定写 `同一或二`（同主格或同属格，随有生命性变化）

## 五、tableType 渲染方式

| tableType | declensionTable 结构 | 规则面板渲染 |
|---|---|---|
| （无，名词） | `{ singular: [6], plural: [6] }` | 格 × 单数/复数 |
| adjective | `{ masculine/neuter/feminine/plural: [6] }` | 格 × 阳性/中性/阴性/复数；`examples` 数组可挂多张表 |
| short | 四键为纯字符串 | 单行四形式 |
| comparative | `comparativePairs: [{base, comparative}]` | 原级→比较级 |
| superlative | `superlativePairs: [{base, superlative}]` | 原级→最高级 |
| personal | `personalTable.groups: [{title, headers, rows:[{case, forms}]}]` | 每 group 一张表 |

**附加字段 `caseTable`**（用于 adjective 型下挂名词性代词表）：`{ title, headers: [...], rows: [{case, forms:[...]}] }`，渲染在形容词表之前。当前用于 кто/что、себя、никто/ничто。

## 六、改动联动清单（改一处，必同步其余）

1. **新增 tableType** → `practice.js` buildRuleHTML（渲染）+ `texts.js` detectTarget（自定义例句自动识别目标词形）+ 本文件「五」。
2. **新增 state 字段** → `app.js` loadState 里做向后兼容 backfill。
3. **新增任何文件** → `sw.js` 的 `FILES_TO_CACHE` 加入。
4. **每次发布** → bump `sw.js` 的 `CACHE_NAME` 版本号（或直接跑 `node tools/release.js`）。
5. **pending 点**：思维导图显示「待补充」，自定义例句语法点下拉过滤掉，也不生成例句。填写时去掉 `pending` 并补齐 exampleWord / description / declensionTable / highlight / tips。
6. **例句 targetWordForm** 必须与 sentenceRU 中某 token 精确匹配（含重音符号、ё=е 不算等同）。

## 七、内容脚本（tools/curate.js）

- `node tools/curate.js list` — 打印知识点清单 + pending 点 + 例句数
- `node tools/curate.js validate` — 全量校验（JSON、target 精确匹配、孤立引用、pending 残留）
- `node tools/curate.js add-sentences <file.json>` — 读紧凑输入并追加例句
- `node tools/curate.js add-point <file.json>` — 新增知识点（默认 `pending: true` 骨架）
- `node tools/curate.js edit-point <file.json>` — 按 `id` 合并更新知识点
- `node tools/curate.js delete-sentence <序号|匹配子串>` — 按序号或子串删除例句
- 发布：`node tools/release.js "提交信息"`（自动 validate → bump sw.js → git 提交推送）

**紧凑例句输入格式**（add-sentences 用，脚本自动填 grammarPointName / word / otherDeclensions）：

```json
[
  { "gp": "pron-demonstrative", "case": "nominative", "form": "masculine", "ru": "Этот дом большой.", "zh": "这个房子很大。", "target": "Этот" },
  { "gp": "pron-interrogative", "case": "genitive", "number": "singular", "ru": "У кого есть время?", "zh": "谁有时间？", "target": "кого" }
]
```

- `form` 与 `number` 二选一；`word` 缺省用节点 exampleWord；`od`（可选）指定 otherDeclensions。
