// 凭据模块单元测试:在临时 DSH_HOME 下验证写入/读取/合并
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

// 合并写入:先放一条其他配置,再保存 key,其他配置应保留
const other = 'CUSTOM_VALUE: hello\n# a comment\n'
fs.writeFileSync(path.join(tmp, '.credentials.yaml'), other)
credentials.saveApiKey('sk-test-654321')
const text = fs.readFileSync(path.join(tmp, '.credentials.yaml'), 'utf8')
assert(text.includes('CUSTOM_VALUE: hello'), 'unrelated entry preserved')
assert(text.includes('# a comment'), 'comment preserved')
assert(text.includes('DEEPSEEK_API_KEY: sk-test-654321'), 'key written with correct name')
assert(!text.includes('sk-test-123456'), 'old value replaced')

console.log('ALL TESTS PASSED')
