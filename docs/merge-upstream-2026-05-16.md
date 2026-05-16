# 合并上游仓库更新记录

**日期**: 2026-05-16
**上游**: https://github.com/fathah/hermes-desktop
**本地版本**: v0.4.1 → v0.4.3
**合并提交**: `96397ee`

---

## 合并概要

将上游仓库 `main` 分支（23 个新提交）合并到本地 `main` 分支，自 `v0.4.0` 更新至 `v0.4.3`。

## 上游新增功能

| 类别 | 变更 |
|------|------|
| **Kanban 看板** | 新增 `src/main/kanban.ts`、`src/renderer/src/screens/Kanban/Kanban.tsx` |
| **Gateway 图标** | 新增大量品牌 SVG 图标（OpenAI, Claude, DeepSeek 等 35+ 个） |
| **BrandLogo 组件** | 新增 `src/renderer/src/components/common/BrandLogo.tsx` |
| **Chat 重构** | 提取为多个 Hooks：`useChatActions`、`useChatIPC`、`useChatScroll`、`useFastMode`、`useModelConfig` 等 |
| **Chat 组件拆分** | `ChatEmptyState`、`ChatHeader`、`MessageList`、`MessageRow`、`ModelPicker` |
| **日语 i18n** | 新增完整日语 locale（20 个翻译文件） |
| **Apple Notarization** | macOS 公证支持 |
| **子进程隐藏** | `HIDDEN_SUBPROCESS_OPTIONS` 统一封装，替代分散的 `windowsHide: true` |
| **会话修复** | `session_id` 传递修复、会话列表可见性刷新修复 |
| **Mac 自动更新** | 修复 auto update 下载流程 |

## 冲突解决记录

合并过程中有 **7 个文件** 产生冲突，全部已解决。详见合并提交 `96397ee`。

## 本地关键修复验证（全部保留 ✅）

| 文件 | 修复内容 | 状态 |
|------|---------|------|
| `Office.tsx` | webview URL `/office` 路径、自动重试、防抖 | ✅ |
| `index.ts` | `console-message` API 弃用修复 | ✅ |
| `index.ts` | `disable-gpu-shader-disk-cache` 磁盘缓存错误 | ✅ |
| `index.ts` | `NODE_TLS_REJECT_UNAUTHORIZED` Claw3D 子进程 | ✅ |
| `claw3d.ts` | Claw3D 子进程环境变量安全过滤 | ✅ |
| `.npmrc` | npm 配置 | ✅ 保留 |
| `.clangd` | clangd 假阳性诊断抑制 | ✅ 保留 |
| `.qoder/` | Qoder 项目知识库 | ✅ 保留 |

## 合并后修复

| 修复项 | 说明 |
|------|------|
| Sessions 删除按钮 | 合并后上游版本缺少删除会话功能，已从本地恢复 `handleDelete`、删除按钮 UI 和 `Trash` 图标 |

## 当前仓库状态

- **本地**: `main` 分支，包含上游 v0.4.3 所有功能 + 本地修复
- **相对于 gitee/origin**: 领先 27 个提交，待推送
- **待提交**: 仅有 `.qoder/` repowiki 文档未暂存修改（不影响功能）
