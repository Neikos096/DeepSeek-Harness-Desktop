// API Key 凭据读写模块
// 与 deepseek-harness 官方新版格式一致(v0.1.1+):
//   version: 1
//   refs:
//     DEEPSEEK_API_KEY: sk-xxx
// 兼容旧版扁平格式(顶层直接 DEEPSEEK_API_KEY),读取/保存时自动归一化。
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const YAML = require('yaml')

const KEY_NAME = 'DEEPSEEK_API_KEY'

function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

function credentialsPath() {
  return path.join(dshHome(), '.credentials.yaml')
}

function readDocument() {
  const file = credentialsPath()
  if (!fs.existsSync(file)) return YAML.parseDocument('')
  const text = fs.readFileSync(file, 'utf8')
  return YAML.parseDocument(text)
}

/** 从任意历史格式中提取凭据条目(顶层旧格式 + version-1 的 refs) */
function parseEntries(doc) {
  const entries = {}
  const root = doc.toJSON()
  if (root && typeof root === 'object' && !Array.isArray(root)) {
    if (root.refs && typeof root.refs === 'object') {
      Object.assign(entries, root.refs)
    }
    for (const [k, v] of Object.entries(root)) {
      if (k !== 'version' && k !== 'refs' && k !== 'records' && typeof v === 'string') {
        entries[k] = v
      }
    }
  }
  return entries
}

/** 把文件重写为官方 version-1 格式(保留全部条目与值,不打印任何密钥) */
function migrateIfNeeded() {
  const file = credentialsPath()
  if (!fs.existsSync(file)) return false
  try {
    const doc = readDocument()
    const entries = parseEntries(doc)
    if (Object.keys(entries).length === 0) return false
    writeVersion1(entries)
    return true
  } catch {
    return false
  }
}

function writeVersion1(entries) {
  const ndoc = YAML.parseDocument('')
  ndoc.set('version', 1)
  const refs = new YAML.YAMLMap()
  ndoc.set('refs', refs)
  for (const [k, v] of Object.entries(entries)) {
    if (typeof v === 'string') refs.set(k, v)
  }
  const dir = dshHome()
  fs.mkdirSync(dir, { recursive: true })
  const file = credentialsPath()
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, String(ndoc), { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(tmp, file)
}

/** 是否已配置 DeepSeek API Key(非空即视为已配置) */
function hasApiKey() {
  try {
    const doc = readDocument()
    const value = parseEntries(doc)[KEY_NAME]
    return typeof value === 'string' && value.trim().length > 0
  } catch {
    return false
  }
}

/** 保存 API Key;保留文件中其他条目与注释 */
function saveApiKey(key) {
  const trimmed = String(key || '').trim()
  if (!trimmed) {
    throw new Error('API Key 不能为空')
  }
  const doc = readDocument()
  const entries = parseEntries(doc)
  entries[KEY_NAME] = trimmed
  writeVersion1(entries)
  return true
}

module.exports = { dshHome, credentialsPath, hasApiKey, saveApiKey, migrateIfNeeded, KEY_NAME }
