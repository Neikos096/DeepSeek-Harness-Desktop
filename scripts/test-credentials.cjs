// 凭据模块单元测试:在临时 DSH_HOME 下验证写入/读取/合并/格式迁移
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-cred-test-'))
process.env.DSH_HOME = tmp
const credentials = require(path.join(__dirname, '..', 'credentials.js'))

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1) }
  console.log('ok:', msg)
}

assert(credentials.hasApiKey() === false, 'empty home -> no key')

credentials.saveApiKey('  sk-test-123456  ')
assert(credentials.hasApiKey() === true, 'after save -> key exists')

// 保存后应为 version-1 格式
let text = fs.readFileSync(path.join(tmp, '.credentials.yaml'), 'utf8')
assert(text.includes('version: 1') && text.includes('DEEPSEEK_API_KEY: sk-test-123456'), 'saved in version-1 layout')

// 合并写入:先放一条其他配置,再保存 key,其他配置应保留
fs.writeFileSync(path.join(tmp, '.credentials.yaml'), 'version: 1\nrefs:\n  CUSTOM_VALUE: hello\n  # keep\n')
credentials.saveApiKey('sk-test-654321')
text = fs.readFileSync(path.join(tmp, '.credentials.yaml'), 'utf8')
assert(text.includes('CUSTOM_VALUE: hello'), 'unrelated entry preserved')
assert(text.includes('DEEPSEEK_API_KEY: sk-test-654321'), 'key written with correct name')
assert(!text.includes('sk-test-123456'), 'old value replaced')

// 旧版扁平格式自动迁移
fs.writeFileSync(path.join(tmp, '.credentials.yaml'), 'DEEPSEEK_API_KEY: sk-flat-999\nOTHER_KEY: abc\n')
const migrated = credentials.migrateIfNeeded()
assert(migrated === true, 'flat layout migrated')
text = fs.readFileSync(path.join(tmp, '.credentials.yaml'), 'utf8')
assert(text.includes('version: 1') && text.includes('refs:') && text.includes('OTHER_KEY: abc'), 'migrated to version-1 layout')
assert(credentials.hasApiKey() === true, 'migrated key readable')

// 混乱混合格式也能读出 Key
fs.writeFileSync(path.join(tmp, '.credentials.yaml'),
  'version: 1\nrefs:\n  { X: 1, DEEPSEEK_API_KEY: sk-hybrid-111 }\nDEEPSEEK_API_KEY: sk-hybrid-222\n')
assert(credentials.hasApiKey() === true, 'hybrid format readable')
credentials.migrateIfNeeded()
text = fs.readFileSync(path.join(tmp, '.credentials.yaml'), 'utf8')
assert(!text.includes('{'), 'hybrid file normalized')
assert(text.includes('sk-hybrid-222'), 'hybrid values kept (top-level wins)')

console.log('ALL TESTS PASSED')
