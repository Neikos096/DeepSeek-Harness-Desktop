// 手机访问中转端到端测试
// 1) 启动真实 harness(dev 源码) 2) 启动手机中转 3) 模拟手机:登录/访问/WebSocket
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { WebSocket } = require('D:/Desktop/ds/deepseek-harness/node_modules/.pnpm/ws@8.21.0/node_modules/ws')
const mobileProxy = require('../mobile-proxy.js')

const HARNESS_PORT = 3237
const PROXY_PORT = 3088
const TOKEN = 'test-token-123'
const HARNESS_DIR = 'D:/Desktop/ds/deepseek-harness'
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-mobile-test-'))

const results = []
function check(name, ok, extra = '') {
  results.push([name, ok])
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${extra}`)
}

function waitHttp(port, tries = 80) {
  return new Promise(async (resolve, reject) => {
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/`)
        if (r.ok) return resolve()
      } catch { /* not ready */ }
      await new Promise((r) => setTimeout(r, 500))
    }
    reject(new Error(`port ${port} not ready`))
  })
}

async function main() {
  // 启动 harness
  const harness = spawn('node', ['--import', 'tsx/esm', 'apps/cli/src/bin.ts', 'web', '--host', '127.0.0.1', '--port', String(HARNESS_PORT)], {
    cwd: HARNESS_DIR,
    windowsHide: true,
    stdio: 'ignore',
    env: { ...process.env, DSH_HOME: tmpHome }
  })
  await waitHttp(HARNESS_PORT)

  // 启动手机中转
  const proxy = await mobileProxy.startMobileProxy({
    harnessPort: HARNESS_PORT,
    token: TOKEN,
    listenPort: PROXY_PORT,
    pagesDir: 'D:/Desktop/ds/DeepSeek-Harness-Desktop/pages',
    pwaDir: 'D:/Desktop/ds/DeepSeek-Harness-Desktop/assets/pwa'
  })

  // 1) 未登录 -> 登录页
  const loginPage = await fetch(`http://127.0.0.1:${PROXY_PORT}/`)
  const loginHtml = await loginPage.text()
  check('未登录返回登录页', loginPage.status === 200 && loginHtml.includes('访问口令'))

  // 2) 错误口令
  const wrong = await fetch(`http://127.0.0.1:${PROXY_PORT}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'token=wrong-token',
    redirect: 'manual'
  })
  const wrongHtml = await wrong.text()
  check('错误口令被拒绝', wrong.status === 403 && wrongHtml.includes('口令不正确'))

  // 3) 正确口令 -> 302 + cookie
  const ok = await fetch(`http://127.0.0.1:${PROXY_PORT}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `token=${TOKEN}`,
    redirect: 'manual'
  })
  const setCookie = ok.headers.get('set-cookie') || ''
  check('正确口令返回跳转', ok.status === 302 && setCookie.includes('dsh_mobile_token'))

  // 4) 带 cookie 访问 -> harness 页面
  const cookie = setCookie.split(';')[0]
  const app = await fetch(`http://127.0.0.1:${PROXY_PORT}/`, { headers: { Cookie: cookie } })
  const appHtml = await app.text()
  check('带口令访问到 harness 界面', app.status === 200 && appHtml.length > 10000)

  // 5) 静态 PWA 资源
  const manifest = await fetch(`http://127.0.0.1:${PROXY_PORT}/pwa/manifest.webmanifest`)
  const icon = await fetch(`http://127.0.0.1:${PROXY_PORT}/pwa/icon-192.png`)
  check('PWA 清单可访问', manifest.status === 200 && (await manifest.text()).includes('DeepSeek Harness'))
  check('PWA 图标可访问', icon.status === 200 && (await icon.arrayBuffer()).byteLength > 1000)

  // 6) WebSocket 转发(带 cookie)
  const wsOk = await new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PROXY_PORT}/api/events.mux`, { headers: { Cookie: cookie } })
    const timer = setTimeout(() => { ws.close(); resolve(false) }, 6000)
    ws.on('open', () => { clearTimeout(timer); ws.close(); resolve(true) })
    ws.on('error', () => { clearTimeout(timer); resolve(false) })
    ws.on('unexpected-response', () => { clearTimeout(timer); resolve(false) })
  })
  check('WebSocket 事件通道可转发', wsOk)

  // 7) 未认证 WebSocket 被拒绝
  const wsDenied = await new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PROXY_PORT}/api/events.mux`)
    ws.on('unexpected-response', (_req, res) => { ws.close(); resolve(res.statusCode === 401) })
    ws.on('open', () => { ws.close(); resolve(false) })
    ws.on('error', () => { ws.close(); resolve(false) })
    setTimeout(() => { ws.close(); resolve(false) }, 5000)
  })
  check('未认证 WebSocket 被拒绝(401)', wsDenied)

  await proxy.close()
  harness.kill()
  try { process.kill(harness.pid, 'SIGTERM') } catch { /* ignore */ }

  const failed = results.filter(([, ok]) => !ok).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

main().catch((err) => { console.error('TEST ERROR:', err); process.exit(2) })
