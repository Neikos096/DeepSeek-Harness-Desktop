const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const { spawn } = require('node:child_process')
const net = require('node:net')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

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
let logs = []

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
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close()
    if (!mainWindow) app.quit()
    serverProc = null
  })

  // 等待服务就绪
  const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    if (serverProc.exitCode !== null) {
      throw new Error(`harness 服务启动失败,已退出(代码 ${serverProc.exitCode})。\n\n${logs.slice(-30).join('\n')}`)
    }
    try {
      const res = await fetch(`http://${HOST}:${serverPort}/`)
      if (res.ok) {
        log('harness 服务已就绪,正在打开界面 ...')
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
    createLoadingWindow()
    try {
      await startHarness()
      createMainWindow()
    } catch (err) {
      log(`启动失败: ${err.message}`)
      if (loadingWindow && !loadingWindow.isDestroyed()) loadingWindow.close()
      showFatalError('启动失败', err.message)
    }
  })

  app.on('before-quit', killServerTree)
  app.on('window-all-closed', () => {
    killServerTree()
    app.quit()
  })
}
