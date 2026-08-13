// electron-builder afterPack 钩子:
// electron-builder 的 extraResources 会静默跳过 node_modules,
// 因此在打包完成后手动把便携 Node 与 harness 运行时复制进应用目录。
const fs = require('node:fs')
const path = require('node:path')

exports.default = async function afterPack(context) {
  const { appOutDir } = context
  const appRoot = path.join(__dirname, '..')

  const sources = [
    ['resources/node', 'node'],
    ['resources/runtime', 'runtime']
  ]

  for (const [from, to] of sources) {
    const src = path.join(appRoot, from)
    const dest = path.join(appOutDir, 'resources', to)
    if (!fs.existsSync(src)) {
      throw new Error(`afterPack: 缺少打包资源 ${src},请先运行 scripts\\build-installer.ps1 的前两步`)
    }
    fs.mkdirSync(dest, { recursive: true })
    fs.cpSync(src, dest, { recursive: true })
    console.log(`afterPack: 已复制 ${from} -> resources/${to}`)
  }
}
