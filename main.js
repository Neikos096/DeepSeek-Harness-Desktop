const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, Notification, clipboard } = require('electron')
const { spawn } = require('node:child_process')
const net = require('node:net')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const credentials = require('./credentials')
const mobileProxy = require('./mobile-proxy')

// ---------------------------------------------------------------------------
// 路径与配置
// ---------------------------------------------------------------------------

// 默认使用与桌面版同级的 deepseek-harness 源码目录
const DEFAULT_HARNESS_DIR = path.join(__dirname, '..', 'deepseek-harness')
const HARNESS_DIR = process.env.DSH_DESKTOP_HARNESS_DIR || DEFAULT_HARNESS_DIR
const PORT = Number(process.env.DSH_DESKTOP_PORT || 0) // 0 = 自动选择空闲端口
const HOST = '127.0.0.1'

let serverProc = null
let serverPort = 0
let mainWindow = null
let loadingWindow = null
let loginWindow = null
let bootStarted = false
let quitting = false
let harnessReady = false
let logs = []
let tray = null
let mobile = null

// 手机访问设置(口令持久化在 ~/.dsh/desktop-mobile.json)
const MOBILE_SETTINGS_FILE = path.join(credentials.dshHome(), 'desktop-mobile.json')

function readMobileSettings() {
  try {
    return JSON.parse(fs.readFileSync(MOBILE_SETTINGS_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function writeMobileSettings(settings) {
  fs.mkdirSync(credentials.dshHome(), { recursive: true })
  fs.writeFileSync(MOBILE_SETTINGS_FILE, JSON.stringify(settings, null, 2))
}

// 运行模式:打包版(安装包)自带 Node 与编译好的 harness;
// 开发版直接使用同级 deepseek-harness 源码目录。
function resolveRuntime() {
  if (app.isPackaged) {
    const nodeExe = path.join(process.resourcesPath, 'node', 'node.exe')
    const cli = path.join(process.resourcesPath, 'runtime', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
    const cwd = path.join(app.getPath('documents'), 'DeepSeek-Harness-Workspace')
    return { node: nodeExe, cli, cwd, packaged: true }
  }
  return {
    node: 'node',
    cli: path.join(HARNESS_DIR, 'apps', 'cli', 'src', 'bin.ts'),
    cwd: HARNESS_DIR,
    packaged: false
  }
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function log(text) {
  const line = `[${new Date().toLocaleTimeString()}] ${text}`
  logs.push(line)
  if (logs.length > 500) logs.shift()
  console.log(line)
  for (const win of [mainWindow, loadingWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send('dsh-log', line)
  }
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, HOST, () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
  })
}

function nodeAvailable() {
  return new Promise((resolve) => {
    const child = spawn('node', ['--version'], { windowsHide: true })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.on('error', () => resolve(null))
    child.on('close', (code) => resolve(code === 0 ? out.trim() : null))
  })
}

function checkRuntime(rt) {
  if (rt.packaged) {
    return fs.existsSync(rt.node) && fs.existsSync(rt.cli)
  }
  return fs.existsSync(path.join(rt.cwd, 'apps', 'web', 'dist', 'index.html')) &&
    fs.existsSync(path.join(rt.cwd, 'apps', 'cli', 'lib', 'bin.js'))
}

function killServerTree() {
  if (!serverProc || serverProc.killed) return
  const pid = serverProc.pid
  try {
    // Windows 下强制结束整棵进程树,避免遗留子进程
    const { spawnSync } = require('node:child_process')
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
  } catch {
    try { serverProc.kill() } catch { /* ignore */ }
  }
  serverProc = null
}

// ---------------------------------------------------------------------------
// 窗口
// ---------------------------------------------------------------------------

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 720,
    height: 480,
    resizable: false,
    frame: false,
    show: false,
    backgroundColor: '#0b1320',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  loadingWindow.setMenuBarVisibility(false)
  loadingWindow.loadFile(path.join(__dirname, 'pages', 'loading.html'))
  loadingWindow.once('ready-to-show', () => loadingWindow.show())
  loadingWindow.on('closed', () => { loadingWindow = null })
}

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 480,
    height: 640,
    resizable: false,
    show: false,
    backgroundColor: '#0b1320',
    title: '登录 DeepSeek Harness',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  loginWindow.setMenuBarVisibility(false)
  loginWindow.loadFile(path.join(__dirname, 'pages', 'login.html'))
  loginWindow.once('ready-to-show', () => loginWindow.show())
  loginWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  loginWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault()
      if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url)
    }
  })
  loginWindow.on('closed', () => {
    loginWindow = null
    if (!bootStarted) app.quit()
  })
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#0b1320',
    title: 'DeepSeek Harness 桌面版',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.setMenuBarVisibility(false)
  mainWindow.loadURL(`http://${HOST}:${serverPort}`)
  mainWindow.once('ready-to-show', () => {
    if (loadingWindow && !loadingWindow.isDestroyed()) loadingWindow.close()
    mainWindow.show()
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    log(`页面加载失败 (${code}): ${desc}`)
  })
  mainWindow.on('closed', () => { mainWindow = null })
}

function showFatalError(title, body) {
  const html = `<!doctype html><html><head><meta charset="utf-8">
    <style>body{font-family:'Microsoft YaHei',sans-serif;background:#0b1320;color:#e8eef7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
    .box{max-width:640px;padding:32px;background:#101b2c;border:1px solid #1e3248;border-radius:12px}
    h1{color:#ff6b6b;font-size:20px}pre{white-space:pre-wrap;background:#0a111d;padding:12px;border-radius:8px;font-size:12px;max-height:260px;overflow:auto}
    button{margin-top:16px;padding:8px 18px;background:#2f6feb;color:#fff;border:none;border-radius:6px;cursor:pointer}</style></head>
    <body><div class="box"><h1>${title}</h1><pre>${body}</pre>
    <button onclick="require('electron').ipcRenderer.send('quit')">退出</button></div></body></html>`
  const win = new BrowserWindow({ width: 760, height: 560, backgroundColor: '#0b1320', show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false } })
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  win.once('ready-to-show', () => win.show())
}

// ---------------------------------------------------------------------------
// 手机访问(托盘控制)
// ---------------------------------------------------------------------------

function refreshTrayMenu() {
  if (!tray) return
  const on = mobile !== null
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: on ? '手机访问:已开启' : '手机访问:已关闭', enabled: false },
    on
      ? { label: '关闭手机访问', click: () => stopMobile() }
      : { label: '开启手机访问', click: () => startMobile() },
    { label: '显示手机访问地址与口令', click: () => showMobileInfo() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]))
}

function ensureTray() {
  if (tray) return
  tray = new Tray(path.join(__dirname, 'assets', 'icon.png'))
  tray.setToolTip('DeepSeek Harness 桌面版')
  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus()
  })
  refreshTrayMenu()
}

async function startMobile() {
  if (mobile) return
  if (!serverPort) {
    log('请等待 harness 启动完成后再开启手机访问')
    return
  }
  const settings = readMobileSettings()
  const token = settings.token || mobileProxy.generateToken()
  const port = Number(process.env.DSH_DESKTOP_MOBILE_PORT || 3088)
  try {
    mobile = await mobileProxy.startMobileProxy({
      harnessPort: serverPort,
      token,
      listenPort: port,
      pagesDir: path.join(__dirname, 'pages'),
      pwaDir: path.join(__dirname, 'assets', 'pwa'),
      onLog: (m) => log(m)
    })
    writeMobileSettings({ ...settings, token, enabled: true })
    refreshTrayMenu()
    const url = `http://${mobileProxy.lanAddresses()[0] || '127.0.0.1'}:${mobile.port}`
    if (Notification.isSupported()) {
      new Notification({
        title: '手机访问已开启',
        body: `${url}  口令: ${token}`
      }).show()
    }
    log(`手机访问服务已开启,地址 ${url}(口令见通知/托盘菜单)`)
  } catch (err) {
    mobile = null
    log(`手机访问开启失败: ${err.message}`)
    refreshTrayMenu()
  }
}

async function stopMobile() {
  if (!mobile) return
  const handle = mobile
  mobile = null
  try { await handle.close() } catch { /* ignore */ }
  writeMobileSettings({ ...readMobileSettings(), enabled: false })
  refreshTrayMenu()
  log('手机访问服务已关闭')
}

function showMobileInfo() {
  if (!mobile) {
    dialog.showMessageBox({
      type: 'info',
      title: '手机访问',
      message: '手机访问未开启',
      detail: '请先在托盘菜单(右下角鲸鱼图标)点击"开启手机访问"。'
    })
    return
  }
  const settings = readMobileSettings()
  const url = `http://${mobileProxy.lanAddresses()[0] || '127.0.0.1'}:${mobile.port}`
  clipboard.writeText(`${url}\n口令: ${settings.token}`)
  dialog.showMessageBox({
    type: 'info',
    title: '手机访问地址与口令',
    message: `地址: ${url}`,
    detail: `口令: ${settings.token}\n\n已复制到剪贴板。\n手机连接同一 Wi-Fi 后,打开浏览器访问上面的地址,输入口令即可使用;浏览器菜单选"添加到主屏幕"可像 App 一样使用。`
  })
}

// ---------------------------------------------------------------------------
// 启动 harness 服务
// ---------------------------------------------------------------------------

async function startHarness() {
  const rt = resolveRuntime()

  if (!checkRuntime(rt)) {
    if (rt.packaged) {
      throw new Error('安装包缺少运行时组件,请重新安装。')
    }
    throw new Error(`未找到可用的 harness 运行环境:\n${rt.cwd}\n\n请确认它与桌面版位于同一目录,或设置环境变量 DSH_DESKTOP_HARNESS_DIR 指向 deepseek-harness 文件夹;并确保已执行 pnpm install 和 pnpm run build。`)
  }

  let nodeVersion
  if (rt.packaged) {
    nodeVersion = await new Promise((resolve) => {
      const child = spawn(rt.node, ['--version'], { windowsHide: true })
      let out = ''
      child.stdout.on('data', (d) => (out += d))
      child.on('error', () => resolve(null))
      child.on('close', () => resolve(out.trim() || null))
    })
  } else {
    nodeVersion = await nodeAvailable()
  }
  if (!nodeVersion) {
    throw new Error(rt.packaged
      ? '内置 Node.js 运行时不可用,请重新安装。'
      : '未检测到 Node.js。\n\nDeepSeek Harness 桌面版需要 Node.js 22.19+ 或 24+,请先安装:https://nodejs.org/')
  }
  log(`Node.js ${nodeVersion} 已就绪`)

  serverPort = PORT || await findFreePort()
  log(`正在启动 harness 服务 (http://${HOST}:${serverPort}) ...`)

  if (rt.packaged && !fs.existsSync(rt.cwd)) {
    fs.mkdirSync(rt.cwd, { recursive: true })
  }

  const args = rt.packaged
    ? [rt.cli, 'web', '--host', HOST, '--port', String(serverPort)]
    : ['--import', 'tsx/esm', rt.cli, 'web', '--host', HOST, '--port', String(serverPort)]

  serverProc = spawn(rt.node, args, {
    cwd: rt.cwd,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' }
  })

  serverProc.stdout.on('data', (d) => log(String(d).trimEnd()))
  serverProc.stderr.on('data', (d) => log(String(d).trimEnd()))
  serverProc.on('exit', (code, signal) => {
    log(`harness 服务已退出 (code=${code}, signal=${signal})`)
    if (!quitting && harnessReady) {
      showFatalError('harness 服务已退出',
        `后台服务进程意外结束(退出码 ${code})。\n\n最近日志:\n${logs.slice(-20).join('\n')}\n\n应用将关闭,请重新启动。`)
    }
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close()
    if (!mainWindow) app.quit()
    serverProc = null
  })

  // 等待服务就绪
  const proc = serverProc
  const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`harness 服务启动失败,进程已退出(代码 ${proc.exitCode})。\n\n${logs.slice(-30).join('\n')}`)
    }
    try {
      const res = await fetch(`http://${HOST}:${serverPort}/`)
      if (res.ok) {
        log('harness 服务已就绪,正在打开界面 ...')
        harnessReady = true
        return
      }
    } catch { /* 尚未就绪 */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('等待 harness 服务启动超时。\n\n' + logs.slice(-30).join('\n'))
}

// ---------------------------------------------------------------------------
// 应用生命周期
// ---------------------------------------------------------------------------

process.on('uncaughtException', (err) => {
  try {
    console.error('未捕获异常:', err)
    showFatalError('程序遇到错误', String((err && err.stack) || err))
  } catch { /* ignore */ }
})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    ipcMain.on('quit', () => app.quit())
    credentials.migrateIfNeeded()

    const bootApp = async () => {
      bootStarted = true
      createLoadingWindow()
      try {
        await startHarness()
        createMainWindow()
        ensureTray()
        if (readMobileSettings().enabled === true) startMobile()
      } catch (err) {
        log(`启动失败: ${err.message}`)
        if (loadingWindow && !loadingWindow.isDestroyed()) loadingWindow.close()
        showFatalError('启动失败', err.message)
      }
    }

    ipcMain.handle('has-api-key', () => credentials.hasApiKey())
    ipcMain.handle('save-api-key', (_event, key) => {
      credentials.saveApiKey(key)
      log('API Key 已保存(仅保存在本机)')
      bootStarted = true
      if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close()
      loginWindow = null
      bootApp()
      return { ok: true }
    })

    if (credentials.hasApiKey()) {
      bootApp()
    } else {
      createLoginWindow()
    }
  })

  app.on('before-quit', () => {
    quitting = true
    killServerTree()
  })
  app.on('before-quit', () => {
    if (mobile) { mobile.close().catch(() => {}) }
  })
  app.on('window-all-closed', () => {
    killServerTree()
    app.quit()
  })
}
