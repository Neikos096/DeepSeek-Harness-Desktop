// 打包版手机访问冒烟测试
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const UNPACKED = 'D:/Desktop/ds/DeepSeek-Harness-Desktop/release/win-unpacked'
const EXE = fs.readdirSync(UNPACKED).find((f) => f.endsWith('.exe') && f.startsWith('DeepSeek'))
const PROXY_PORT = 3088
const HARNESS_PORT = 3239
const TOKEN = 'test-token-123'
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-pkg-mobile-'))
const tmpUserData = path.join(tmpHome, 'userdata')

fs.writeFileSync(path.join(tmpHome, '.credentials.yaml'), `DEEPSEEK_API_KEY: sk-smoke-123456\n`)
fs.writeFileSync(path.join(tmpHome, 'desktop-mobile.json'), JSON.stringify({ enabled: true, token: TOKEN }))

function waitHttp(port, tries = 120) {
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
  const app = spawn(path.join(UNPACKED, EXE), [`--user-data-dir=${tmpUserData}`], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      DSH_HOME: tmpHome,
      DSH_DESKTOP_PORT: String(HARNESS_PORT),
      DSH_DESKTOP_MOBILE_PORT: String(PROXY_PORT)
    }
  })
  await waitHttp(HARNESS_PORT)
  console.log('PASS  harness 已启动')
  await waitHttp(PROXY_PORT)
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

main().catch((err) => { console.error('TEST ERROR:', err.message); process.exit(2) })
