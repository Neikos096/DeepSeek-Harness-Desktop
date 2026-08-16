# DeepSeek Harness 手机本地版(Termux)

让 harness 完整跑在手机本地,并可以直接读写手机文件。

## 原理

在 Termux(安卓上的 Linux 终端)里安装 Node.js 和 DeepSeek Harness,harness 服务跑在手机本地(`127.0.0.1:3080`),用手机浏览器或本仓库的安卓 App 打开界面即可使用。agent 执行的命令和文件操作都发生在手机本地,通过 Termux 的存储授权可以读写相册、下载等共享目录。

## 安装步骤

1. 在手机应用商店(如 F-Droid 或 GitHub)安装 **Termux**;
2. 打开 Termux,输入:

```bash
pkg install -y git
git clone https://github.com/Neikos096/DeepSeek-Harness-Desktop.git
cd DeepSeek-Harness-Desktop/android/termux
bash termux-setup-dsh.sh
```

3. 过程中 Termux 会申请"允许访问所有文件"权限,点允许;
4. 安装完成后:

```bash
bash termux-start-dsh.sh
```

5. 等提示"启动完成"后,用手机浏览器打开 `http://127.0.0.1:3080`,或在"DeepSeek Harness"App 的设置页点"本机模式"。

## 文件访问说明

- agent 可以读写 Termux 目录下的所有文件;
- 授权后,`~/storage/shared` 对应手机的共享存储(相册 DCIM、下载 Download、文档 Documents 等),把工作区选到这里即可让 agent 修改手机上的真实文件;
- 系统级目录(需要 root)无法修改,这是安卓系统的安全限制。

## 注意事项

- 首次启动会初始化配置,需要几十秒,属正常;
- 部分依赖原生编译模块的功能(如某些终端特性)在 Termux 上可能不可用,核心的对话、读写文件、执行命令不受影响;
- 国内网络若安装慢,可在脚本中把 npm 源换成 `https://registry.npmmirror.com`。
