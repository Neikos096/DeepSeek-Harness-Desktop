# 构建自包含安装包(Windows)
# 用法: powershell -ExecutionPolicy Bypass -File scripts\build-installer.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$nodeVersion = '24.16.0'
$dshVersion = '0.1.0-rc.6'
$mirror = 'https://npmmirror.com/mirrors'
$npmRegistry = 'https://registry.npmmirror.com'

Set-Location $root

# 1. 便携版 Node.js(安装包运行时不再依赖系统 Node)
$nodeDir = Join-Path $root 'resources\node'
$nodeExe = Join-Path $nodeDir 'node.exe'
if (-not (Test-Path $nodeExe)) {
  Write-Host "[1/3] 下载便携版 Node.js v$nodeVersion ..."
  New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
  $zip = Join-Path $env:TEMP "node-v$nodeVersion-win-x64.zip"
  Invoke-WebRequest -Uri "$mirror/node/v$nodeVersion/node-v$nodeVersion-win-x64.zip" -OutFile $zip -UseBasicParsing
  $tmp = Join-Path $env:TEMP "node-v$nodeVersion-extract"
  if (Test-Path $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  Copy-Item -Path (Join-Path $tmp "node-v$nodeVersion-win-x64\*") -Destination $nodeDir -Recurse -Force
  Write-Host "Node.js 已就绪: $nodeExe"
} else {
  Write-Host "[1/3] 便携版 Node.js 已存在,跳过下载"
}

# 2. 编译好的 harness 运行时(官方 npm 发布包)
$runtimeDir = Join-Path $root 'resources\runtime'
$cli = Join-Path $runtimeDir 'node_modules\@deepseek-ai\dsh\lib\bin.js'
if (-not (Test-Path $cli)) {
  Write-Host "[2/3] 安装 harness 运行时 @deepseek-ai/dsh@$dshVersion ..."
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
  npm install "@deepseek-ai/dsh@$dshVersion" --prefix $runtimeDir --registry $npmRegistry --no-audit --no-fund
} else {
  Write-Host "[2/3] harness 运行时已存在,跳过安装"
}

if (-not (Test-Path $cli)) {
  throw "harness 运行时安装失败,请检查网络后重试: $cli"
}

# 3. 打包
Write-Host "[3/3] 使用 electron-builder 生成安装程序 ..."
$env:ELECTRON_MIRROR = "$mirror/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "$mirror/electron-builder-binaries/"
npm run dist

Write-Host ""
Write-Host "完成!安装包位于: $root\release"
