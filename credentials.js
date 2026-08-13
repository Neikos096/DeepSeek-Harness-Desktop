// API Key 凭据读写模块
// 与 deepseek-harness 官方格式一致:~/.dsh/.credentials.yaml 中的
// DEEPSEEK_API_KEY 映射,合并写入,不覆盖其他条目。
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

/** 是否已配置 DeepSeek API Key(非空即视为已配置) */
function hasApiKey() {
  try {
    const doc = readDocument()
    const value = doc.get(KEY_NAME)
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
  const dir = dshHome()
  fs.mkdirSync(dir, { recursive: true })
  const doc = readDocument()
  doc.set(KEY_NAME, trimmed)
  const file = credentialsPath()
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, String(doc), { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(tmp, file)
  return true
}

module.exports = { dshHome, credentialsPath, hasApiKey, saveApiKey, KEY_NAME }
