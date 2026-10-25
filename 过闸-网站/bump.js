/* 更新版本戳：把 sw.js 里的 VERSION 改成当前时间
   用法（在本文件夹里）：node bump.js
   每次改完网站、上传之前跑一下即可。 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'sw.js');
if (!fs.existsSync(file)) {
  console.error('没找到 sw.js，请在网站根目录里运行');
  process.exit(1);
}

const d = new Date();
const p = n => String(n).padStart(2, '0');
const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
const next = `guozha-${stamp}`;

const src = fs.readFileSync(file, 'utf8');
const re = /const VERSION = '[^']*';/;
if (!re.test(src)) {
  console.error('sw.js 里没有找到 VERSION 那一行');
  process.exit(1);
}

const old = src.match(re)[0];
fs.writeFileSync(file, src.replace(re, `const VERSION = '${next}';`), 'utf8');
console.log('旧版本：', old);
console.log('新版本：', `const VERSION = '${next}';`);
console.log('完成。现在把整个文件夹重新上传即可。');
