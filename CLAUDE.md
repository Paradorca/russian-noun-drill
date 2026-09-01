# 俄语名词变格练习 PWA

纯 HTML/CSS/JS 的俄语名词变格朗读练习应用，无框架、无构建步骤，托管在 GitHub Pages。

- 线上地址：https://paradorca.github.io/russian-noun-drill/
- 仓库：https://github.com/Paradorca/russian-noun-drill
- 本地目录：`C:\Users\pc\russian-noun-drill`

## 文件结构

- `index.html` — 全部页面结构（欢迎/诊断/思维导图/练习/课文回顾/设置）
- `style.css` — 全部样式，主题色变量在 `:root`（accent `#4ECDC4`）
- `app.js` — 核心：App 对象、init、状态读写（localStorage）、导航、页面切换、工具函数、DOMContentLoaded 全局事件绑定
- `diagnostic.js` — 入门诊断流程
- `map.js` — 思维导图（变格法视图 + 六格视图）
- `practice.js` — 例句练习：抽题、打字验证（灰→黑渐进显示）、高亮、规则面板、完成后课文逐段回顾
- `chat.js` — AI 语法助手（服务商配置 + 对话）
- `settings.js` — 设置页：练习模式、权重、AI Key、自定义例句、重置
- `texts.js` — 课文回顾：导入/编辑/删除课文
- 各模块通过 `Object.assign(App, { ... })` 挂到 App 上；`index.html` 中 app.js 必须最先加载
- `grammar-data.json` — 语法框架（17 个语法点、变格表、六格用法）
- `sentences-data.json` — 85 条例句

## 关键约定（改代码时必须遵守）

1. **每次发布必须 bump `sw.js` 里的 `CACHE_NAME` 版本号**（如 v17 → v18），否则用户手机上是旧缓存。新增文件时同步加入 `FILES_TO_CACHE`。
2. 用户数据全部在 localStorage 的 `russianNounDrillState` 键下（unlockedNodes、unlockedCases、nodeWeights、practiceMode、userSentences、userTexts、aiProvider、aiApiKey 等）。新增字段时在 `loadState()` 里做向后兼容的 backfill。
3. 每日练习 10 句，由 `practice.js` 的 `generateQueue()` 控制。
4. 打字校验规则：只比对字母（忽略大小写、重音符号、标点，ё=е），见 `normalizeLetters/lettersOnly`。
5. AI 助手：用户的 API Key 存在 localStorage，浏览器直连服务商 API（OpenAI 兼容格式），无后端。

## 发布流程

1. Claude 直接改代码 + bump sw.js 版本号
2. Claude 可以直接 `git add / commit / push`（网络已通）。提交信息用英文简述
3. GitHub Actions 自动部署，约 30 秒后生效
4. 用户刷新网址验证

## 已知坑

- `file://` 直接双击 index.html 无法运行（fetch JSON 被浏览器拦截），必须通过网址访问
- `.idea/` 是 IDE 产物，不要提交
- 鸿蒙系统无法安装 TWA 打包的 APK（缺 Chrome/Play 服务），手机端用 PWA「添加到主屏幕」
