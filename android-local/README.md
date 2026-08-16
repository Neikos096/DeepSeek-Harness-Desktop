# DSH 本地版(安卓 APK)

一个**安装即用**的安卓本地 AI 文件助手:填一次 DeepSeek API Key、选一个文件夹,就能用自然语言让 AI 帮你**读取、写入、创建、删除**手机里的文件。所有对话只发给 DeepSeek,文件操作全部在手机本地完成。

> 说明:这是完整 harness 的轻量本地版(直接调用 DeepSeek API + 文件工具),适合"装完就能用";需要完整 harness(终端、任务规划等)请在电脑上使用,或参照 `android/termux/` 在 Termux 里运行完整版。

## 安装使用

1. 安装 `DSH-Local.apk`(允许"安装未知来源应用");
2. 打开 App,粘贴 DeepSeek API Key(在 [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) 获取);
3. 点"选择工作文件夹",在系统文件选择器里选一个文件夹(如"下载"或"文档"),不选则使用应用私有目录;
4. 点"开始使用",直接告诉 AI 想做什么,例如:
   - "列出当前目录下的文件"
   - "读一下 笔记.txt"
   - "帮我写一个 待办.md,内容是……"
   - "把 旧笔记.txt 删掉"

右上角"设置"可回到配置页;Self-Test 按钮可自检文件读写功能。

## 安全说明

- 文件只在你选择的文件夹范围内操作,App 无法越权访问其他应用的数据;
- 请求仅发送给 DeepSeek API,文件内容只用于当前对话;
- 系统级目录(需 root)不可操作,这是安卓系统限制。

## 重新构建

需要 JDK 17+ 与 Android SDK(build-tools 35 / platform android-35),运行:

```powershell
.\build-apk.ps1
```

产物:`DSH-Local.apk`。
