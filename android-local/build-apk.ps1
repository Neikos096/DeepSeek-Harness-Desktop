# 构建 DSH 本地版 APK(无 Gradle)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_HOME = $sdk

$buildTools = "$sdk\build-tools\35.0.0"
$platform = "$sdk\platforms\android-35\android.jar"
$build = Join-Path $root 'build'
$outApk = Join-Path $root 'DSH-Local.apk'

if (Test-Path $build) { Remove-Item -LiteralPath $build -Recurse -Force }
New-Item -ItemType Directory -Force -Path $build | Out-Null

Write-Host '[1/5] aapt2 compile + link'
& "$buildTools\aapt2.exe" compile --dir (Join-Path $root 'res') -o (Join-Path $build 'res.zip')
& "$buildTools\aapt2.exe" link -o (Join-Path $build 'app.unaligned.apk') -I $platform `
  --manifest (Join-Path $root 'AndroidManifest.xml') -R (Join-Path $build 'res.zip') `
  -A (Join-Path $root 'assets') --auto-add-overlay

Write-Host '[2/5] javac'
New-Item -ItemType Directory -Force -Path (Join-Path $build 'classes') | Out-Null
Get-ChildItem (Join-Path $root 'src') -Recurse -Filter '*.java' | ForEach-Object {
  & javac --release 17 -classpath $platform -d (Join-Path $build 'classes') $_.FullName
}

Write-Host '[3/5] d8'
New-Item -ItemType Directory -Force -Path (Join-Path $build 'dex') | Out-Null
$classes = Get-ChildItem (Join-Path $build 'classes') -Recurse -Filter '*.class' | ForEach-Object { $_.FullName }
& "$buildTools\d8.bat" --release --lib $platform --output (Join-Path $build 'dex') $classes

Write-Host '[4/5] add dex + zipalign'
& jar uf (Join-Path $build 'app.unaligned.apk') -C (Join-Path $build 'dex') .
& "$buildTools\zipalign.exe" -f 4 (Join-Path $build 'app.unaligned.apk') (Join-Path $build 'app.aligned.apk')

Write-Host '[5/5] sign'
$keystore = Join-Path $root 'debug.keystore'
if (-not (Test-Path $keystore)) {
  & keytool -genkeypair -v -keystore $keystore -alias androiddebugkey -keyalg RSA -keysize 2048 `
    -validity 10000 -storepass android -keypass android -dname "CN=Android Debug,O=Android,C=US"
}
& "$buildTools\apksigner.bat" sign --ks $keystore --ks-key-alias androiddebugkey `
  --ks-pass pass:android --key-pass pass:android --out $outApk (Join-Path $build 'app.aligned.apk')

Write-Host "APK: $outApk ($([math]::Round((Get-Item $outApk).Length / 1MB, 2)) MB)"
