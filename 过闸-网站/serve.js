/* 极简静态服务器：把 web/ 当站点跑起来
   用法：node serve.js [端口]
   监听 0.0.0.0，同 Wi-Fi 的手机可以直接打开 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 8088);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';

  const file = path.join(ROOT, path.normalize(url).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT)) return send(res, 403, '403');

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, '404 ' + url);
    const ext = path.extname(file).toLowerCase();
    const noCache = ['.html', '.js', '.css', '.webmanifest', '.json'].indexOf(ext) >= 0;
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      /* 开发期：代码一律不缓存，改完刷新即生效；图片才缓存 */
      'Cache-Control': noCache ? 'no-store, max-age=0' : 'public, max-age=86400',
      'Pragma': 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const lan = [];
  Object.keys(nets).forEach(k => {
    (nets[k] || []).forEach(n => {
      if (n.family === 'IPv4' && !n.internal) lan.push(n.address);
    });
  });
  console.log('serving  : ' + ROOT);
  console.log('local    : http://127.0.0.1:' + PORT + '/');
  lan.forEach(ip => console.log('LAN      : http://' + ip + ':' + PORT + '/'));
});
