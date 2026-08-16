# DeepSeek Harness 桌面版

将 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 封装为本地桌面应用:双击启动后自动拉起内置的 harness 服务,在一个独立窗口中使用完整的 Web 界面,关闭窗口时自动清理后台服务。

## 目录结构

```
D:\Desktop\ds\
├─ deepseek-harness\            # 拉取的 harness 源码(开发版运行时)
└─ DeepSeek-Harness-Desktop\    # 桌面版应用(本目录)
   ├─ main.js                   # Electron 主程序:启动/关闭 harness 服务
   ├─ pages\loading.html        # 启动加载页
   ├─ assets\                   # 应用图标
   ├─ scripts\build-installer.ps1  # 生成自包含安装包
   ├─ 启动桌面版.bat            # 开发版启动入口
   └─ 安装依赖.bat              # 首次使用前安装依赖
```

## 方式一:开发版(使用克隆的源码)

环境要求:Node.js 22.19+ 或 24+([下载](https://nodejs.org/)),pnpm 11+。

```bat
:: 1. 构建 harness(首次,耗时几分钟)
cd D:\Desktop\ds\deepseek-harness
pnpm install
pnpm run build

:: 2. 安装桌面版依赖
cd D:\Desktop\ds\DeepSeek-Harness-Desktop
安装依赖.bat

:: 3. 启动
启动桌面版.bat
```

国内网络较慢时,可先设置镜像再安装:

```bat
pnpm install --registry=https://registry.npmmirror.com
npm install --registry=https://registry.npmmirror.com
```

## 方式二:安装包(自包含,无需系统 Node)

运行 `scripts\build-installer.ps1` 生成安装程序:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-installer.ps1
```

脚本会自动完成三件事:

1. 下载便携版 Node.js 放入 `resources\node`;
2. 安装官方编译好的 harness 运行时(`@deepseek-ai/dsh`)放入 `resources\runtime`;
3. 调用 electron-builder 生成 NSIS 安装包到 `release\`。

安装后的程序完全离线、自包含,不依赖系统安装 Node.js。

安装界面特性:

- 安装过程中会出现"安装选项"页,提供**创建桌面快捷方式**勾选框(默认勾选,可取消);
- 应用图标为 DeepSeek 官方黑色鲸鱼 logo(安装包、桌面快捷方式、任务栏、窗口图标统一使用);
- 安装新版本时会自动替换旧版本(同一应用 ID,先卸载旧版再安装新版)。

## 使用

1. 启动后等待加载页完成,自动进入 harness 主界面;
2. 首次使用:点击 **设置 → Models**,填入 DeepSeek API Key 并保存;
3. 点击 **选择工作区**,添加你希望让 agent 操作的文件夹;
4. 在会话输入框中下达任务即可(agent 可以读写文件、执行命令、维护计划,敏感操作会先征求同意)。

**v1.1.0 新增**:首次打开(未配置 API Key 时)会弹出登录页,直接输入 DeepSeek API Key 即可开始使用;页面下方提供"没有 api key? 点击此处前往获取"链接,点击跳转 DeepSeek 官方密钥管理页。Key 只保存在本机 `~/.dsh/.credentials.yaml`,与官方设置页使用同一存储,不经过任何第三方。

**v1.2.0 新增:手机访问**

电脑端托盘(右下角鲸鱼图标)菜单可开启"手机访问",开启后手机和电脑连同一 Wi-Fi,用手机浏览器访问提示的地址、输入口令,即可在手机上使用 harness;浏览器菜单选"添加到主屏幕"可像 App 一样使用(支持 PWA 安装)。

使用步骤:

1. 电脑端开启应用,点托盘鲸鱼图标 → **开启手机访问**;
2. 记下通知/菜单里显示的**地址**和**口令**;
3. 手机连同一 Wi-Fi,浏览器打开地址,输入口令即可;
4. 需要再次查看地址和口令时,托盘菜单选"显示手机访问地址与口令"。

安全提示:

- 手机访问是带口令保护的中转(支持 HTTP 与 WebSocket),但传输为局域网明文,口令不要让陌生人知道;
- 开启后,知道口令的人可以在局域网内操作你电脑上的 agent,**请仅在可信的 Wi-Fi 网络下开启**,用完可在托盘菜单关闭;
- Windows 首次开启时若弹出防火墙询问,请允许"专用网络"访问。

## 常见问题

- **启动时报"未找到 harness 运行环境"**:确认 `deepseek-harness` 与桌面版在同一目录,并已执行 `pnpm install`、`pnpm run build`;也可以设置环境变量 `DSH_DESKTOP_HARNESS_DIR` 指向源码目录。
- **启动时提示缺少 Node.js**:安装 Node.js 22.19+ 或 24+ 后重试。
- **端口占用**:应用默认自动选择空闲端口,一般无需手动配置;也可设置 `DSH_DESKTOP_PORT` 固定端口。
- **后台残留进程**:关闭窗口时应用会强制结束 harness 服务进程树;若异常退出,可在任务管理器中结束残留的 `node.exe` / `electron.exe`。

## 说明

- 安装包模式内置的是与源码同版本的官方编译运行时(`@deepseek-ai/dsh` npm 包),体积小、可离线运行;克隆的源码保留在 `deepseek-harness\` 供开发和二次修改。
- 本项目为 Electron 封装层,harness 本身版权归 DeepSeek AI 所有,遵循其 [MIT 许可证](../deepseek-harness/LICENSE)。

## API Key 安全说明

- 应用将 API Key 等凭据保存在系统用户目录的 `~/.dsh`(Windows 下为 `C:\Users\<用户名>\.dsh`)中,**不会写入项目目录**;
- 仓库通过 `.gitignore` 排除了凭据文件(`.credentials.yaml`)、`~/.dsh`、环境变量文件、构建产物与日志,防止误提交;
- 发布前已对项目文件进行敏感信息扫描,未发现任何 API Key;
- 请勿把 `~/.dsh` 目录或其中的 `.credentials.yaml` 文件复制到任何会公开的目录。
