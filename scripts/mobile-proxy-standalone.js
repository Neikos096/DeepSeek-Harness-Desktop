// 独立启动手机中转(供测试/脱离桌面壳使用)
const path = require('node:path')
const { startMobileProxy } = require('../mobile-proxy.js')

const APP_DIR = path.join(__dirname, '..')
startMobileProxy({
  harnessPort: Number(process.env.DSH_HARNESS_PORT || 3237),
  token: process.env.DSH_MOBILE_TOKEN || 'test-token-123',
  listenPort: Number(process.env.DSH_MOBILE_PORT || 3088),
  pagesDir: path.join(APP_DIR, 'pages'),
  pwaDir: path.join(APP_DIR, 'assets', 'pwa'),
  onLog: (m) => console.log(m)
}).then(() => {
  console.log('mobile proxy ready')
  setInterval(() => {}, 60000)
}).catch((err) => {
  console.error('proxy failed:', err)
  process.exit(1)
})
