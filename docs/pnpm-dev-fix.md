# pnpm dev 启动失败修复指南

## 问题描述

运行 `pnpm dev` 启动开发模式时，出现以下错误：

```
error during start dev server and electron app:
Error: Electron uninstall
    at getElectronPath (electron-vite/dist/chunks/lib-q6ns0vZr.js:155:19)
```

## 根本原因

`electron-vite` 启动 Electron 时的逻辑是：
1. 通过 `require.resolve('electron')` 找到 electron 模块目录
2. 读取模块目录下的 `path.txt` 文件
3. 拼接路径 `dist/<path.txt内容>` 得到可执行文件路径
4. 启动 Electron

**问题在于**：pnpm 安装 electron 时，**postinstall 脚本被跳过**，导致 `path.txt` 文件没有生成。虽然 `electron.exe` 二进制文件实际存在于 `node_modules\.pnpm\electron@x.x.x\node_modules\electron\dist\` 目录中，但 `electron-vite` 找不到 `path.txt`，因此报错 "Electron uninstall"。

## 修复步骤

### 方法一：手动创建 path.txt（推荐）

直接在 electron 模块目录下创建 `path.txt` 文件：

```powershell
# Windows
Set-Content "node_modules\.pnpm\electron@42.0.1\node_modules\electron\path.txt" -Value "electron.exe" -NoNewline

# Linux/macOS
echo -n "electron" > node_modules/.pnpm/electron@42.0.1/node_modules/electron/path.txt
```

### 方法二：允许 pnpm 执行 postinstall 脚本

在项目根目录创建或修改 `.npmrc` 文件，添加以下配置：

```ini
# .npmrc
enable-pre-post-scripts=true
onlyBuiltDependencies=electron
```

然后重新安装依赖：

```bash
pnpm install
```

### 方法三：设置环境变量跳过检查

临时设置 `ELECTRON_EXEC_PATH` 环境变量指向 electron 可执行文件：

```powershell
# Windows
$env:ELECTRON_EXEC_PATH = "node_modules\.pnpm\electron@42.0.1\node_modules\electron\dist\electron.exe"
pnpm dev
```

## 验证方法

修复后运行以下命令验证：

```bash
pnpm dev
```

正常启动会显示：

```
> electron-vite dev

vite v7.3.3 building ssr environment for development...
✓ 103 modules transformed.
out/main/index.js  305.98 kB
✓ built in 479ms

electron main process built successfully

-----

vite v7.3.3 building ssr environment for development...
✓ 1 modules transformed.
out/preload/index.js  12.55 kB
✓ built in 20ms

electron preload scripts built successfully

-----

dev server running for the electron renderer process at:

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose

starting electron app...
```

## 预防措施

为了避免此问题再次发生，建议在项目中：

1. **始终使用单一包管理器**（本项目使用 pnpm），不要混用 npm/yarn
2. 在 `.npmrc` 中配置 `enable-pre-post-scripts=true`，允许执行 postinstall 脚本
3. 配置国内镜像加速 electron 二进制下载：

```ini
# .npmrc - 完整配置示例
registry=https://registry.npmmirror.com
electron_mirror=https://npmmirror.com/mirrors/electron/
enable-pre-post-scripts=true
```

## 相关文件

- [node_modules\.pnpm\electron@42.0.1\node_modules\electron\path.txt](file:///E:/MyProject/github-projects/hermes-desktop/node_modules/.pnpm/electron@42.0.1/node_modules/electron/path.txt) - Electron 路径配置文件
- [.npmrc](file:///E:/MyProject/github-projects/hermes-desktop/.npmrc) - pnpm 配置文件
- [package.json](file:///E:/MyProject/github-projects/hermes-desktop/package.json) - 项目依赖配置

## 参考链接

- [electron-vite GitHub](https://github.com/alex8088/electron-vite)
- [pnpm Configuration](https://pnpm.io/npmrc)