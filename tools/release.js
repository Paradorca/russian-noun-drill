#!/usr/bin/env node
// 发布脚本：校验 → bump sw.js 版本号 → git 提交推送
// 用法：node tools/release.js "提交信息"
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SW_PATH = path.join(ROOT, 'sw.js');
const NODE = process.execPath;

function sh(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'inherit' });
}

const msg = process.argv[2];
if (!msg) {
  console.error('用法：node tools/release.js "提交信息"');
  process.exit(1);
}

// 1. 校验内容
console.log('▶ 校验内容…');
try {
  execSync(`"${NODE}" tools/curate.js validate`, { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
  console.error('校验未通过，中止发布');
  process.exit(1);
}

// 2. bump sw.js
const sw = fs.readFileSync(SW_PATH, 'utf8');
const m = sw.match(/const CACHE_NAME = 'russian-noun-drill-v(\d+)';/);
if (!m) {
  console.error('未在 sw.js 找到 CACHE_NAME，中止');
  process.exit(1);
}
const next = parseInt(m[1], 10) + 1;
fs.writeFileSync(SW_PATH, sw.replace(m[0], `const CACHE_NAME = 'russian-noun-drill-v${next}';`), 'utf8');
console.log(`✅ sw.js 版本 v${m[1]} → v${next}`);

// 3. git add / commit / push
console.log('▶ 提交并推送…');
sh('git add -A');
try {
  sh(`git commit -m "${msg.replace(/"/g, '\\"')}"`);
} catch (e) {
  console.error('提交失败（可能没有改动）');
  process.exit(1);
}
sh('git push');
console.log('✅ 已推送到 GitHub，等待 Pages 部署（约 30 秒）');
