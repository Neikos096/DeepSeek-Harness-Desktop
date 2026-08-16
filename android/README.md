# DeepSeek Harness 安卓版

一个简单的安卓 WebView 外壳:在手机里打开电脑端开启的"手机访问"地址,输入口令后即可在手机上完整使用 DeepSeek Harness。

## 使用步骤

1. 电脑端开启 DeepSeek Harness 桌面版,托盘鲸鱼图标 → **开启手机访问**,记下地址和口令;
2. 手机安装 `DeepSeek-Harness-Mobile.apk`(首次安装需允许"安装未知来源应用");
3. 打开 App,输入电脑端地址(例如 `http://192.168.1.5:3088`),点**连接**;
4. 页面提示输入访问口令,输入电脑端显示的口令即可进入;
5. 右上角"设置"按钮可随时修改地址。

## 手机本地模式(Termux)

如果想让 harness 完全跑在手机本地、直接修改手机文件,请先在手机上安装 Termux 并按 [termux/README.md](termux/README.md) 安装启动本地服务,然后在 App 设置页点 **"本机模式 (127.0.0.1:3080)"** 即可进入本地界面。

## 要求

- 安卓 7.0(API 24)及以上;
- 手机与电脑连接**同一 Wi-Fi**;
- 电脑端 Windows 防火墙需允许应用访问(专用网络)。

## 重新构建

需要 JDK 17+ 与 Android SDK(build-tools 35 / platform android-35),然后运行:

```powershell
.\build-apk.ps1
```

产物:`DeepSeek-Harness-Mobile.apk`。
