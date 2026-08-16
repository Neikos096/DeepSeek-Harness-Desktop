// 桌面应用 + 手机访问 集成测试
// 预置 DSH_HOME(含 Key 与手机访问设置),启动应用,验证中转服务自动开启并可登录访问
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const APP_DIR = 'D:/Desktop/ds/DeepSeek-Harness-Desktop'
const PROXY_PORT = 3088
const HARNESS_PORT = 3238
const TOKEN = 'test-token-123'
const out = []
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-app-mobile-'))
const tmpUserData = path.join(tmpHome, 'userdata')

// 预置 Key 与手机访问设置
fs.writeFileSync(path.join(tmpHome, '.credentials.yaml'), `DEEPSEEK_API_KEY: sk-smoke-123456\n`)
fs.writeFileSync(path.join(tmpHome, 'desktop-mobile.json'), JSON.stringify({ enabled: true, token: TOKEN }))

function waitHttp(port, tries = 100) {
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
  const app = spawn('node', ['node_modules/electron/cli.js', '.', `--user-data-dir=${tmpUserData}`], {
    cwd: APP_DIR,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DSH_HOME: tmpHome,
      DSH_DESKTOP_PORT: String(HARNESS_PORT),
      DSH_DESKTOP_MOBILE_PORT: String(PROXY_PORT)
    }
  })
  app.stdout.on('data', (d) => out.push(String(d)))
  app.stderr.on('data', (d) => out.push(String(d)))

  await waitHttp(HARNESS_PORT, 240)
  console.log('PASS  harness 已启动')

  await waitHttp(PROXY_PORT, 120)
  console.log('PASS  手机访问服务已自动开启')

  const login = await fetch(`http://127.0.0.1:${PROXY_PORT}/`)
  const loginHtml = await login.text()
  console.log(loginHtml.includes('访问口令') ? 'PASS  手机登录页可访问' : 'FAIL  手机登录页异常')

  const ok = await fetch(`http://127.0.0.1:${PROXY_PORT}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `token=${TOKEN}`,
    redirect: 'manual'
  })
  const cookie = (ok.headers.get('set-cookie') || '').split(';')[0]
  const appPage = await fetch(`http://127.0.0.1:${PROXY_PORT}/`, { headers: { Cookie: cookie } })
  const appHtml = await appPage.text()
  console.log(appPage.status === 200 && appHtml.length > 10000 ? 'PASS  通过手机入口访问到 harness 界面' : 'FAIL  手机入口代理异常')

  app.kill()
  setTimeout(() => process.exit(0), 1000)
}

main().catch((err) => {
  console.error('TEST ERROR:', err.message)
  console.error('--- app output ---')
  console.error(out.join('').slice(-3000))
  process.exit(2)
})
