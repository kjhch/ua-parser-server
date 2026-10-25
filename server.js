import http from 'node:http';
import { UAParser } from 'ua-parser-js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY_SIZE = 16 * 1024; // UA 字符串远小于此,超限视为异常请求

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        // 停止读取并上报,由调用方先返回 413 再关闭连接
        req.removeAllListeners('data');
        req.removeAllListeners('end');
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseUa(ua) {
  const result = new UAParser(ua).getResult();
  // 未识别出设备类型时(桌面浏览器 UA 通常如此),默认置为 desktop
  if (!result.device.type) {
    result.device.type = 'desktop';
  }
  return result;
}

async function handleParse(req, res, url) {
  let ua;

  if (req.method === 'GET') {
    // 不带 ua 参数时,解析请求自身的 User-Agent
    ua = url.searchParams.get('ua') ?? req.headers['user-agent'] ?? '';
  } else if (req.method === 'POST') {
    let body;
    try {
      body = await readBody(req);
    } catch (err) {
      if (err.status === 413) {
        // 请求体未读完,响应后需强制断开连接
        res.setHeader('Connection', 'close');
        sendJson(res, 413, { error: err.message });
        res.on('finish', () => req.destroy());
        return;
      }
      return sendJson(res, 400, { error: err.message });
    }

    if ((req.headers['content-type'] || '').includes('application/json')) {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return sendJson(res, 400, { error: 'invalid JSON body' });
      }
      if (typeof parsed?.ua !== 'string') {
        return sendJson(res, 400, { error: 'JSON body must contain a string "ua" field' });
      }
      ua = parsed.ua;
    } else {
      // 纯文本 body 直接作为 UA
      ua = body.trim();
    }
  } else {
    return sendJson(res, 405, { error: 'method not allowed' });
  }

  sendJson(res, 200, parseUa(ua));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/parse') {
    handleParse(req, res, url).catch((err) => {
      console.error(err);
      if (!res.headersSent) sendJson(res, 500, { error: 'internal server error' });
    });
    return;
  }

  if (url.pathname === '/health') {
    return sendJson(res, 200, { status: 'ok' });
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`ua-parser-server listening on http://${HOST}:${PORT}`);
});
