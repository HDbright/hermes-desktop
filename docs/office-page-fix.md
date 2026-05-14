# Hermes Desktop Office 页面修复记录

## 问题概述

Hermes Desktop 的 Office 页面（Claw3D 3D 办公场景）无法正常连接 Hermes 后端，反复出现以下错误：

1. **Port 3000 is in use** — 端口被外部 Claw3D 占用时无法复用
2. **Timed out connecting to the gateway** — WebSocket 连接超时
3. **Error: AggregateError** — Hermes API 网关未启动，adapter 无法转发
4. **Error code: 401** — API Key 认证失败
5. **Dev server exited with code 3221225794** — Windows DLL 初始化失败

## 根因分析

### 架构链路

```
Claw3D UI (webview) → ws://localhost:3000/api/gateway/ws (代理)
    → ws://localhost:18789 (hermes-adapter)
        → http://127.0.0.1:8642 (Hermes API 网关)
            → DeepSeek API
```

### 根因清单

| # | 问题 | 根因 |
|---|------|------|
| 1 | 端口冲突 | `isDevServerRunning()` 只检查自管进程，不检查端口占用 |
| 2 | 连接超时 | `startAll()` 没有先启动 Hermes 网关（8642），adapter 转发失败 |
| 3 | 401 错误 | `config.yaml` 中 `provider: "custom"` 不存在，Gateway 错用 OpenRouter key |
| 4 | 配置目录错误 | 系统 `HERMES_HOME` = `C:\Users\Administrator\AppData\Local\hermes`，非 `~/.hermes` |
| 5 | settings.json 格式 | `writeClaw3dSettings()` 写入扁平格式，Claw3D 读取嵌套格式 |
| 6 | DLL 初始化失败 | `cmd.exe /c npm run dev` 在 Electron spawn 下 SWC 加载失败 |
| 7 | 过期错误残留 | `getClaw3dStatus()` 不清除旧错误，服务正常运行仍显示错误 |

---

## 修改文件清单

### 1. `src/main/claw3d.ts` — 核心修复

| 位置 | 修改 | 目的 |
|------|------|------|
| L9 | `import { join, dirname } from "path"` | 新增 `dirname` |
| L14 | `import { startGateway, getApiUrl } from "./hermes"` | 引入网关启动函数 |
| L198-227 | `isDevServerRunning()` 改为异步，新增端口检查 | 检测外部启动的服务 |
| L229-257 | `isAdapterRunning()` 改为异步，新增端口 18789 检查 | 同上 |
| L265-266 | 服务运行时清除过期错误 | 避免旧错误残留 |
| L538-561 | **dev server 改用 `node.exe` 直接启动** | 绕过 `cmd.exe` DLL 问题 |
| L623-638 | **adapter 同样直接用 `node.exe`** | 同上 |
| L704-715 | `startAll()` 先确保网关就绪（端口检查） | 正确启动顺序 |
| L728-748 | `startAll()` 写入含 `HERMES_API_URL` 的 `.env` | adapter 能找到网关 |
| L91-100 | `writeClaw3dSettings()` 写入嵌套 `gateway` 格式 | 兼容 Claw3D settings 读取 |

#### 关键代码片段

```typescript
// 端口检测 — 检测外部已运行的服务
async function isDevServerRunning(): Promise<boolean> {
  if (devServerProcess && !devServerProcess.killed) return true;
  const pid = readPid(DEV_PID_FILE);
  if (pid && isProcessRunning(pid)) return true;
  cleanupPid(DEV_PID_FILE);
  // 检查端口是否已被占用
  const port = getSavedPort();
  // ... TCP connect 检查
}

// 直接使用 node.exe，避免 cmd.exe 导致 DLL 加载失败
const nodeExe = join(dirname(findNpm()), "node.exe");
const proc = spawn(nodeExe, [
  join(HERMES_OFFICE_DIR, "server", "index.js"), "--dev"
], { ... });

// 启动顺序：网关 → dev server → adapter
if (!await checkPort(8642)) {
  startGateway();
  for (let i = 0; i < 10; i++) {
    if (await checkPort(8642)) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
}
```

### 2. `src/main/index.ts` — IPC 异步化

| 位置 | 修改 |
|------|------|
| L854 | `claw3d-start-all` handler 改为 `async` |
| L861 | `claw3d-start-dev` handler 改为 `async` |
| L866 | `claw3d-start-adapter` handler 改为 `async` |

### 3. `src/renderer/src/screens/Office/Office.tsx` — Webview URL

| 位置 | 修改 | 目的 |
|------|------|------|
| L216 | `claw3dUrl = "http://localhost:${port}"` | 兼容 Electron webview |

### 4. `C:\Users\Administrator\AppData\Local\hermes\config.yaml` — 真实配置

**修改前：**
```yaml
model:
  provider: "custom"    # 不存在！
providers: {}           # 空的 — Gateway 找不到匹配的 provider
```

**修改后：**
```yaml
model:
  default: "deepseek-chat"
  provider: "deepseek"
providers:
  deepseek:
    type: openai
    base_url: "https://api.deepseek.com/v1"
    api_key_env: DEEPSEEK_API_KEY
```

### 5. `C:\Users\Administrator\.openclaw\claw3d\settings.json` — 格式修正

**修改前：**
```json
{ "adapter": "hermes", "url": "ws://localhost:18789", "token": "" }
```

**修改后：**
```json
{ "gateway": { "url": "ws://localhost:18789", "token": "", "adapterType": "hermes" } }
```

### 6. `C:\Users\Administrator\AppData\Local\hermes\hermes-office\.env` — 环境变量

```ini
PORT=3000
HERMES_API_URL=http://127.0.0.1:8642
NEXT_PUBLIC_GATEWAY_URL=ws://localhost:18789
CLAW3D_GATEWAY_URL=ws://localhost:18789
HERMES_ADAPTER_PORT=18789
HERMES_MODEL=hermes
HERMES_AGENT_NAME=Hermes
```

---

## 重要发现

### `HERMES_HOME` 环境变量

Windows 原生安装时，系统环境变量 `HERMES_HOME` 指向：
```
C:\Users\Administrator\AppData\Local\hermes
```
**不是** `C:\Users\Administrator\.hermes`。代码中 `installer.ts` 的默认值 `join(homedir(), ".hermes")` 仅在环境变量未设置时使用。

### Windows spawn 陷阱

在 Windows 上通过 Electron spawn `cmd.exe /d /s /c npm run dev` 时，Next.js 的 SWC 编译器可能无法正确初始化 DLL（`STATUS_DLL_INIT_FAILED` = `0xC0000142` = 3221225794）。解决方案是直接 spawn `node.exe` 调用入口脚本。

---

## 正确的使用流程

1. **聊天页** 发送一条消息 → 自动启动 Hermes 网关（端口 8642）
2. **Office 页** → 点击 **Start** → 自动依次启动 Claw3D + Adapter
3. 在 Claw3D 界面中选 **Hermes backend** → 点击 **Connect**

---

## 调试命令

```powershell
# 检查端口状态
netstat -ano | sls ":3000|:18789|:8642" | sls "LISTENING"

# 测试 WebSocket 代理链路
node -e "
const ws = new (require('ws'))('ws://localhost:3000/api/gateway/ws');
ws.on('open', () => ws.send(JSON.stringify({type:'req',id:'t',method:'connect',params:{client:{id:'h',mode:'studio',agent:{id:'Hermes',name:'Hermes'}},auth:{}}})));
ws.on('message', d => {
  const m = JSON.parse(d.toString());
  if (m.event==='connect.challenge') ws.send(JSON.stringify({type:'req',id:'t',method:'connect',params:{client:{id:'h',mode:'studio',agent:{id:'Hermes',name:'Hermes'}},auth:{},challenge:m.payload.nonce}}));
  if (m.type==='res') console.log('RESULT:', m.ok ? 'OK' : 'FAIL');
});
"

# 测试 DeepSeek API Key
node -e "
const https = require('https');
const data = JSON.stringify({model:'deepseek-chat',messages:[{role:'user',content:'hi'}],max_tokens:5});
const req = https.request({hostname:'api.deepseek.com',path:'/v1/chat/completions',method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer sk-YOUR_KEY'}},res => {
  let b=''; res.on('data',c=>b+=c); res.on('end',()=>console.log('STATUS:',res.statusCode,b.substring(0,100)));
});
req.write(data); req.end();
"
```

---

> 修复日期：2026-05-14
> 涉及文件：`claw3d.ts`, `index.ts`, `Office.tsx`, `config.yaml`, `settings.json`, `.env`
