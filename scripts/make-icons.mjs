// 用官方 DeepSeek 鲸鱼 logo 生成应用图标(PNG + ICO)
// 用法: node scripts/make-icons.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('D:/Desktop/ds/deepseek-harness/node_modules/.pnpm/node_modules/sharp')
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = path.join(root, 'assets')
const svg = fs.readFileSync(path.join(assets, 'whale.svg'), 'utf8')

function svgWith(fill) {
  return svg.replace('fill="#000"', `fill="${fill}"`)
}

// 黑色鲸鱼(透明底) -> 应用图标
const blackSvg = svgWith('#000000')
const png256 = await sharp(Buffer.from(blackSvg)).resize(256, 256).png().toBuffer()
fs.writeFileSync(path.join(assets, 'icon.png'), png256)
fs.writeFileSync(path.join(assets, 'icon.svg'), blackSvg)

// 白色鲸鱼(透明底) -> 深色加载页使用
const whiteSvg = svgWith('#ffffff')
const white256 = await sharp(Buffer.from(whiteSvg)).resize(256, 256).png().toBuffer()
fs.writeFileSync(path.join(assets, 'whale-white.png'), white256)

// 多尺寸 ICO(全部内嵌 PNG,Windows Vista+ 支持)
const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = []
for (const size of sizes) {
  pngs.push(await sharp(Buffer.from(blackSvg)).resize(size, size).png().toBuffer())
}

const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(pngs.length, 4)

const entries = []
let offset = 6 + 16 * pngs.length
for (let i = 0; i < pngs.length; i++) {
  const size = sizes[i]
  const e = Buffer.alloc(16)
  e.writeUInt8(size >= 256 ? 0 : size, 0) // width
  e.writeUInt8(size >= 256 ? 0 : size, 1) // height
  e.writeUInt8(0, 2) // colors
  e.writeUInt8(0, 3) // reserved
  e.writeUInt16LE(1, 4) // planes
  e.writeUInt16LE(32, 6) // bit count
  e.writeUInt32LE(pngs[i].length, 8)
  e.writeUInt32LE(offset, 12)
  entries.push(e)
  offset += pngs[i].length
}

fs.writeFileSync(path.join(assets, 'icon.ico'), Buffer.concat([header, ...entries, ...pngs]))
console.log('icons generated:', fs.readdirSync(assets).join(', '))
