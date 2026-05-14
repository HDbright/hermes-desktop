# Hermes Desktop 项目架构分析文档

> 版本：0.3.5 | 作者：fathah (Nous Research) | 分析日期：2026-05-14

---

## 一、项目概述

**Hermes Agent Desktop** 是一个基于 **Electron + React** 的桌面应用程序，用于安装、配置和与 **Hermes Agent**（一个基于 Python 的自改进 AI 助手）进行交互。

- **技术栈**：Electron 39 + React 19 + TypeScript 5.9 + Vite 7 + TailwindCSS 4
- **连接模式**：本地 (Local)、远程 HTTP (Remote)、SSH 隧道 (SSH)
- **i18n**：英语、简体中文、西班牙语、葡萄牙语（巴西）
- **平台支援**：Windows (NSIS)、macOS (DMG)、Linux (AppImage/Snap/DEB/RPM)

---

## 二、项目结构

```
hermes-desktop/
├── .agents/              # Agent 技能定义（electron-pro, hermes-agent, typescript-expert）
├── .github/workflows/    # GitHub Actions CI
├── build/                # 打包资源（图标、macOS 权限、WinGet 模板）
├── docs/                 # 文档
├── resources/            # icon.png
├── scripts/              # 辅助脚本（WinGet 清单生成）
├── src/
│   ├── main/             # Electron 主进程（Node.js 后端，20 个模块）
│   ├── preload/          # contextBridge 预加载（IPC 接口 + 类型声明）
│   ├── renderer/src/     # React 前端（15 个 Screens + 8 个 Components）
│   └── shared/i18n/      # 国际化（4 语言 × 19 文件/语言）
├── tests/                # 单元测试（9 个文件）
├── package.json
├── electron-builder.yml  # Electron 打包配置
├── electron.vite.config.ts
├── tsconfig.json / tsconfig.node.json / tsconfig.web.json
└── vitest.config.ts
```

---

## 三、架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                      Main Process (Node.js)                   │
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  index.ts    │  │  hermes.ts   │  │  installer.ts      │  │
│  │  入口/IPC总控│  │  API网关/聊天│  │  安装/备份/迁移    │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  config.ts   │  │  claw3d.ts   │  │  ssh-remote.ts     │  │
│  │  配置管理    │  │  3D可视化集成│  │  SSH远程代理(1143行)│  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ sessions.ts  │  │  profiles.ts │  │  memory/soul/tools  │  │
│  │  会话/SQLite │  │  Profile管理 │  │  记忆/人格/工具集   │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ skills.ts    │  │  models.ts   │  │  cronjobs.ts       │  │
│  │  技能管理    │  │  模型库      │  │  定时任务          │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
│                        ↕ IPC (ipcMain.handle)                 │
├──────────────────────────────────────────────────────────────┤
│              Preload (contextBridge: hermesAPI)               │
├──────────────────────────────────────────────────────────────┤
│                   Renderer Process (React 19)                  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  15 Screens                                              │ │
│  │  Welcome / Install / Setup / Layout / Chat / Sessions /  │ │
│  │  Profiles / Models / Providers / Settings / Gateway /    │ │
│  │  Agents / Memory / Soul / Tools / Skills / Schedules /   │ │
│  │  Office (Claw3D 3D)                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Components: ThemeProvider / ErrorBoundary / I18nProvider│ │
│  │  AgentMarkdown (react-markdown) / Versions / RemoteNotice│ │
│  └─────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│                     External Backends                         │
│                                                               │
│  Python: Hermes Agent CLI (gateway/chat/config/profile...)    │
│  API:    DeepSeek / OpenRouter / DashScope / OpenAI ...       │
│  DB:     SQLite (state.db, sessions.json)                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 四、主进程模块详解 (src/main/)

### 4.1 入口与调度

| 文件 | 行数 | 职责 |
|------|------|------|
| [index.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/index.ts) | 1167 | 创建 BrowserWindow、注册 50+ IPC handler、构建原生菜单、自动更新、窗口管理 |
| [installer.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/installer.ts) | 955 | 路径常量(`HERMES_HOME`/`HERMES_PYTHON`)、安装状态检查、官方脚本安装、OpenClaw 迁移、备份/还原、MCP 服务器、日志 |

### 4.2 核心功能

| 文件 | 行数 | 职责 |
|------|------|------|
| [hermes.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/hermes.ts) | 834 | **聊天引擎**：API 网关生命周期(start/stop/restart)、消息发送（HTTP SSE 流式 + CLI 回退）、健康检查轮询、远程连接测试 |
| [config.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/config.ts) | 421 | 三层配置读写：`desktop.json`(连接模式)、`.env`(API 密钥)、`config.yaml`(模型/平台)；Profile 分层；凭证池 |
| [sessions.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/sessions.ts) | 181 | SQLite state.db 读写，FTS5 全文搜索 |
| [session-cache.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/session-cache.ts) | 187 | 本地索引缓存、自动标题生成、O(1) 查询 |
| [profiles.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/profiles.ts) | 257 | Profile CRUD，调用 `hermes profile` CLI |

### 4.3 远程连接

| 文件 | 行数 | 职责 |
|------|------|------|
| [ssh-remote.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/ssh-remote.ts) | 1143 | **最大模块**：通过 SSH exec 执行远程操作，内含 Python 脚本用于远程 SQLite 操作 |
| [ssh-tunnel.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/ssh-tunnel.ts) | 219 | SSH 端口转发隧道、健康检查、自动端口分配 |

### 4.4 AI 个性与工具

| 文件 | 行数 | 职责 |
|------|------|------|
| [memory.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/memory.ts) | 206 | MEMORY.md + USER.md 读写，2200/1375 字符限制 |
| [soul.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/soul.ts) | 37 | SOUL.md（Agent 人格定义） |
| [tools.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/tools.ts) | 293 | 16 种工具开关管理（web、browser、terminal、file、code...） |
| [skills.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/skills.ts) | 292 | 技能扫描、搜索注册表、SKILL.md 元数据解析 |
| [models.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/models.ts) | 97 | models.json 管理，含默认模型播种 |

### 4.5 3D 可视化

| 文件 | 行数 | 职责 |
|------|------|------|
| [claw3d.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/claw3d.ts) | 771 | **Claw3D 集成**：仓库 clone、npm 安装、dev server + adapter 生命周期、配置同步 |

### 4.6 辅助模块

| 文件 | 行数 | 职责 |
|------|------|------|
| [cronjobs.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/cronjobs.ts) | 280 | 定时任务 CRUD，通过远程 API |
| [askpass.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/askpass.ts) | 207 | sudo 密码 GUI 对话框（仅非 Windows） |
| [sse-parser.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/sse-parser.ts) | 130 | SSE 流式解析器（独立可测试） |
| [utils.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/utils.ts) | 44 | stripAnsi、profileHome、escapeRegex、safeWriteFile |
| [locale.ts](file:///E:/MyProject/github-projects/hermes-desktop/src/main/locale.ts) | 14 | 语言 getter/setter |

---

## 五、IPC 通信接口 (preload)

预加载脚本通过 `contextBridge.exposeInMainWorld` 暴露两个全局对象：

### `window.hermesAPI`

按功能分组提供 50+ 个方法：

```
安装: checkInstall / verifyInstall / startInstall / getHermesVersion
聊天: sendMessage / startGateway / stopGateway / isGatewayRunning / testRemoteConnection
配置: getEnv / setEnv / getConfig / setConfig / getModelConfig / setModelConfig
会话: getSessions / getSessionMessages / searchMessages
Profile: listProfiles / createProfile / deleteProfile / switchProfile
记忆: getMemory / setMemory / areMemoryEqual / getUserProfile / setUserProfile / resetMemory
人格: getSoul / setSoul / resetSoul
工具: getTools / setTool / resetTools
技能: listSkills / searchSkills / installSkill / uninstallSkill
模型: getModels / addModel / updateModel / deleteModel / getDefaultModels
Claw3D: claw3dStatus / claw3dSetup / claw3dStartAll / claw3dStopAll / getClaw3dLogs
        setClaw3dPort / setClaw3dWsUrl
定时任务: listJobs / getJob / createJob / deleteJob / toggleJobPause / triggerJob
备份: backup / import / dump / checkOpenClaw / runClawMigrate
MCP: listMcp / discoverMemoryProviders
更新: getUpdateStatus / checkForUpdates / quitAndInstall
语言: getLocale / setLocale
其他: isMaximized / getOS / readLogs / runHermesDoctor / runHermesUpdate / refreshHermesVersion
```

### `window.electron`

暴露 Electron 进程信息：`versions`、`process.type`、`platform`

---

## 六、渲染进程架构 (src/renderer/src/)

### 6.1 应用状态机

```
SplashScreen → Welcome → Install → Setup → Layout (主界面)
                                                  ├── Chat
                                                  ├── Sessions
                                                  ├── Profiles
                                                  ├── Models
                                                  ├── Providers
                                                  ├── Settings
                                                  ├── Gateway
                                                  ├── Agents
                                                  ├── Memory / Soul / Tools / Skills
                                                  ├── Schedules
                                                  └── Office (Claw3D)
```

### 6.2 路由 / 导航

- 使用自制的路由机制（非 react-router），由 `App.tsx` 管理 `screen` 状态
- 侧边栏导航 + 底部面板（3D 可视化嵌入可用）

### 6.3 技术特性

| 特性 | 实现方式 |
|------|----------|
| UI 框架 | React 19 + TailwindCSS 4 |
| Markdown 渲染 | react-markdown + remark-gfm |
| 代码高亮 | react-syntax-highlighter |
| 图标 | lucide-react |
| 国际化 | i18next + react-i18next |
| 主题 | ThemeProvider (light/dark/system) |
| 错误边界 | ErrorBoundary |

---

## 七、关键路径与数据流

### 7.1 聊天消息流

```
用户输入消息
  → Chat.tsx 调用 window.hermesAPI.sendMessage(message, callbacks)
    → preload IPC: ipcRenderer.invoke("send-message", ...)
      → hermes.ts: sendMessage()
        → 尝试 HTTP SSE 流式 API (http://127.0.0.1:8642/v1/chat/completions)
          → 成功: SSE 解析 → onChunk 回调 → 渲染流式回复
          → 失败: 回退到 CLI 模式 (python hermes chat ...)
            → stdout 逐行解析 → onChunk 回调
        → onDone 回调 → 保存会话到 SQLite
```

### 7.2 Claw3D Office 启动流

```
用户点击 Start
  → Office.tsx 调用 window.hermesAPI.claw3dStartAll()
    → claw3d.ts: startAll()
      → 1. 检测端口 8642 → 未占则启动 Hermes 网关
      → 2. 检测端口 3000 → 未占则启动 Claw3D (node server/index.js)
      → 3. 检测端口 18789 → 未占则启动 Hermes Adapter
      → 4. 返回 { success: true }
    → webview 加载 http://localhost:3000/office
      → Claw3D UI 连接 ws://localhost:3000/api/gateway/ws
        → 代理到 ws://localhost:18789 (adapter)
          → HTTP 转发 http://127.0.0.1:8642 (Hermes 网关)
            → DeepSeek/OpenRouter API
```

### 7.3 配置读写路径

```
Settings UI 修改配置
  → window.hermesAPI.setConfig("provider", "deepseek", "default")
    → config.ts: setConfigValue()
      → 读写 C:\Users\Administrator\AppData\Local\hermes\config.yaml
      → 重启网关（如果 API key 变更）
      → 返回成功
```

---

## 八、关键环境变量与路径

### Windows 环境变量

| 变量 | 默认值 |
|------|--------|
| `HERMES_HOME` | `C:\Users\Administrator\AppData\Local\hermes` (用户级) |
| `NVM_DIR` | `D:\nvm4w` |

### 关键文件路径

| 文件 | 用途 |
|------|------|
| `%HERMES_HOME%\config.yaml` | Hermes Agent 主配置 |
| `%HERMES_HOME%\.env` | API 密钥 |
| `%HERMES_HOME%\desktop.json` | Desktop 连接配置 |
| `%HERMES_HOME%\state.db` | SQLite 会话数据库 |
| `%HERMES_HOME%\sessions.json` | 会话索引缓存 |
| `%HERMES_HOME%\models.json` | 用户保存的模型配置 |
| `%HERMES_HOME%\auth.json` | 凭证池 |
| `%HERMES_HOME%\MEMORY.md` | AI 记忆 |
| `%HERMES_HOME%\USER.md` | 用户资料 |
| `%HERMES_HOME%\SOUL.md` | Agent 人格 |
| `%USERPROFILE%\.openclaw\claw3d\settings.json` | Claw3D 连接设置 |

### Claw3D 配置示例

```json
{
  "version": 1,
  "gateway": {
    "url": "ws://localhost:18789",
    "token": "",
    "adapterType": "hermes"
  }
}
```

### Claw3D .env 文件

```ini
PORT=3000
HERMES_API_URL=http://127.0.0.1:8642
NEXT_PUBLIC_GATEWAY_URL=ws://localhost:18789
CLAW3D_GATEWAY_URL=ws://localhost:18789
HERMES_ADAPTER_PORT=18789
```

---

## 九、依赖关系图

```
hermes-desktop (Electron 39 + React 19)
│
├── 构建工具
│   ├── electron-vite (Vite 5 集成)
│   ├── typescript (5.9)
│   └── electron-builder (打包)
│
├── 前端
│   ├── tailwindcss 4 (样式)
│   ├── lucide-react (图标)
│   ├── react-markdown / remark-gfm (Markdown)
│   └── react-i18next (国际化)
│
├── 后端
│   ├── better-sqlite3 (原生 SQLite)
│   ├── electron-updater (自动更新)
│   └── @electron-toolkit/utils
│
└── 本地依赖
    ├── Hermes Agent CLI (Python, pip 安装)
    ├── Claw3D Office (npm 安装, Next.js)
    └── OpenClaw settings (空或迁移)
```

---

## 十、常见问题排查指南

### 聊天 401 错误

1. 检查 `%HERMES_HOME%\config.yaml` 中 `model.provider` 必须匹配 `providers` 中的一个 key
2. 检查 `%HERMES_HOME%\.env` 中对应的 `*_API_KEY` 是否有效
3. 用 curl 直接测试 API

### Office 连接超时

1. 检查端口：`netstat -ano | sls "3000|18789|8642" | sls "LISTENING"`
2. 先发送聊天消息确认网关已启动
3. 确认 `settings.json` 使用嵌套 `gateway.url` 格式

### Dev server exit code 3221225794

- 原因：Windows DLL 初始化失败 (`0xC0000142`)
- 解决：直接 `node server/index.js --dev`，不要用 `cmd.exe /c npm`

---

## 十一、技术债务与改进建议

1. **渲染进程路由**：当前使用自制状态机，建议引入 `react-router` 支持深链接
2. **类型安全**：preload API 采用字符串 IPC 通道名称，可改为 `typed-ipc` 自动推断类型
3. **错误处理**：主进程大量 `try {} catch { /* non-fatal */ }`，建议统一日志记录
4. **Claw3D 启动**：建议创建独立的启动管理服务，替代当前的手动 spawn 检测
5. **测试覆盖率**：当前仅 9 个测试文件，建议增加 IPC 端到端测试
6. **Windows PATH**：`findNpm()` 依赖硬编码路径，建议读取注册表 `HKLM\SOFTWARE\Node.js\InstallPath`
