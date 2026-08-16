// 手机访问中转服务
// 桌面端监听局域网(默认 0.0.0.0:3088),把手机请求转发到本机 harness
// (127.0.0.1:<harnessPort>)。访问需要口令(登录页输入一次,以 Cookie 记住),
// 支持 HTTP 与 WebSocket(/api/events.mux、/api/events.host)。
// 注意:开启后局域网内知道口令的人可以操作你电脑上的 agent,请仅在可信网络使用。
const http = require('node:http')
const net = require('node:net')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const os = require('node:os')

const COOKIE_NAME = 'dsh_mobile_token'

function generateToken() {
  return crypto.randomBytes(12).toString('base64url')
}

function lanAddresses() {
  const out = []
  const ifaces = os.networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) out.push(iface.address)
    }
  }
  return out
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''))
  const bufB = Buffer.from(String(b || ''))
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

function isAuthed(req, token) {
  const cookie = String(req.headers.cookie || '')
  for (const part of cookie.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === COOKIE_NAME) return safeEqual(v.join('='), token)
  }
  return false
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers })
  res.end(body)
}

function servePwa(res, pwaDir, pathname) {
  const map = {
    '/pwa/manifest.webmanifest': ['application/manifest+json', 'manifest.webmanifest'],
    '/pwa/icon-192.png': ['image/png', 'icon-192.png'],
    '/pwa/icon-512.png': ['image/png', 'icon-512.png'],
    '/pwa/icon-180.png': ['image/png', 'icon-180.png']
  }
  const entry = map[pathname]
  if (!entry) return false
  const file = path.join(pwaDir, entry[1])
  if (!fs.existsSync(file)) return false
  res.writeHead(200, {
    'Content-Type': entry[0],
    'Cache-Control': 'public, max-age=3600',
    'Content-Length': fs.statSync(file).size
  })
  fs.createReadStream(file).pipe(res)
  return true
}

function proxyHttp(req, res, upstream) {
  const headers = { ...req.headers }
  delete headers['connection']
  delete headers['keep-alive']
  delete headers['proxy-connection']
  headers['host'] = `${upstream.host}:${upstream.port}`

  const request = http.request({
    host: upstream.host,
    port: upstream.port,
    method: req.method,
    path: req.url,
    headers
  }, (upstreamRes) => {
    const outHeaders = { ...upstreamRes.headers }
    delete outHeaders['connection']
    delete outHeaders['keep-alive']
    res.writeHead(upstreamRes.statusCode || 502, outHeaders)
    upstreamRes.pipe(res)
  })
  request.on('error', () => {
    if (!res.headersSent) send(res, 502, '<h1>502 无法连接 harness 服务</h1>')
    else res.end()
  })
  req.pipe(request)
}

function proxyUpgrade(req, socket, head, upstream) {
  const target = net.connect(upstream.port, upstream.host, () => {
    const headers = { ...req.headers }
    headers['host'] = `${upstream.host}:${upstream.port}`
    let raw = `${req.method} ${req.url} HTTP/1.1\r\n`
    for (const [k, v] of Object.entries(headers)) {
      if (v === undefined) continue
      raw += `${k}: ${Array.isArray(v) ? v.join(', ') : v}\r\n`
    }
    raw += '\r\n'
    target.write(raw)
    if (head && head.length) target.write(head)
    target.pipe(socket)
    socket.pipe(target)
  })
  target.on('error', () => socket.destroy())
  socket.on('error', () => target.destroy())
  socket.on('close', () => target.destroy())
  target.on('close', () => socket.destroy())
}

function startMobileProxy(options) {
  const {
    harnessHost = '127.0.0.1',
    harnessPort,
    token,
    listenHost = '0.0.0.0',
    listenPort = 3088,
    pagesDir,
    pwaDir,
    onLog = () => {}
  } = options

  const upstream = { host: harnessHost, port: harnessPort }
  const loginPage = path.join(pagesDir, 'mobile-login.html')

  const server = http.createServer((req, res) => {
    const pathname = (req.url || '/').split('?')[0]

    if (pathname.startsWith('/pwa/')) {
      if (servePwa(res, pwaDir, pathname)) return
      return send(res, 404, 'not found')
    }

    if (pathname === '/login' && req.method === 'POST') {
      let body = ''
      req.on('data', (d) => (body += d))
      req.on('end', () => {
        const input = new URLSearchParams(body).get('token') || ''
        if (!safeEqual(input.trim(), token)) {
          return send(res, 403, fs.readFileSync(loginPage, 'utf8').replace('{{error}}', '口令不正确,请重试'))
        }
        res.writeHead(302, {
          Location: '/',
          'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/`
        })
        res.end()
      })
      return
    }

    if (!isAuthed(req, token)) {
      return send(res, 200, fs.readFileSync(loginPage, 'utf8').replace('{{error}}', ''))
    }

    proxyHttp(req, res, upstream)
  })

  server.on('upgrade', (req, socket, head) => {
    if (!isAuthed(req, token)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
    proxyUpgrade(req, socket, head, upstream)
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(listenPort, listenHost, () => {
      server.removeListener('error', reject)
      const port = server.address().port
      onLog(`手机访问服务已开启: http://${lanAddresses()[0] || '127.0.0.1'}:${port}`)
      resolve({
        port,
        server,
        close: () => new Promise((done) => {
          server.closeAllConnections?.()
          server.close(() => done())
        })
      })
    })
  })
}

module.exports = { startMobileProxy, generateToken, lanAddresses, COOKIE_NAME }
