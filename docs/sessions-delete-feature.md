# Sessions 删除功能 — 修改总结

> 更新日期: 2026-05-13
> 版本: hermes-desktop 0.3.7

## 功能概述

为 Sessions（会话）页面完整实现删除功能，涵盖从 SQLite 数据库到前端 UI 的全链路打通。用户可在会话列表中 hover 任意会话卡片，点击右上角的删除按钮并确认后，永久删除该会话及其所有消息。

## 涉及的文件（8 个）

| # | 层级 | 文件路径 | 修改内容 |
|---|------|---------|---------|
| 1 | 数据库 | `src/main/sessions.ts` | 新增 `getDbWritable()` 和 `deleteSession()` |
| 2 | 缓存层 | `src/main/session-cache.ts` | 新增 `removeSessionFromCache()` |
| 3 | IPC 主进程 | `src/main/index.ts` | 注册 `delete-session` IPC handler |
| 4 | Preload 桥接 | `src/preload/index.ts` | 暴露 `deleteSession()` API |
| 5 | 类型定义 | `src/preload/index.d.ts` | 添加 `deleteSession` 类型签名 |
| 6 | 前端 UI | `src/renderer/src/screens/Sessions/Sessions.tsx` | 添加删除按钮 UI + confirm 确认对话框 |
| 7 | 国际化 | `src/shared/i18n/locales/zh-CN/sessions.ts` + `en/sessions.ts` | 添加 `delete` / `deleteConfirm` 翻译 |
| 8 | 样式 | `src/renderer/src/assets/main.css` | 删除按钮 CSS 样式 |

---

## 详细修改说明

### 1. 数据库层 — `src/main/sessions.ts`

新增两个函数：

```typescript
function getDbWritable(): Database.Database | null {
  if (!existsSync(DB_PATH)) return null;
  return new Database(DB_PATH);
}

export function deleteSession(sessionId: string): boolean {
  const db = getDbWritable();
  if (!db) return false;
  try {
    db.pragma("foreign_keys = ON");
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM messages WHERE session_id = ?").run(sessionId);
      db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    });
    tx();
    return true;
  } catch {
    return false;
  } finally {
    db.close();
  }
}
```

- `getDbWritable()` — 获取可写（非只读）的数据库连接，用于写入操作
- `deleteSession()` — 使用事务删除会话：先删 messages（外键约束），再删 sessions，确保数据完整性

### 2. 缓存层 — `src/main/session-cache.ts`

新增函数：

```typescript
export function removeSessionFromCache(sessionId: string): void {
  const cache = readCache();
  const filtered = cache.sessions.filter((s) => s.id !== sessionId);
  if (filtered.length !== cache.sessions.length) {
    cache.sessions = filtered;
    writeCache(cache);
  }
}
```

- 删除后同步清理本地 `sessions.json` 缓存文件，确保下次加载不会重新显示已删除的会话

### 3. IPC 主进程 — `src/main/index.ts`

导入变更：

```typescript
import { listSessions, getSessionMessages, searchSessions, deleteSession } from "./sessions";
import {
  syncSessionCache,
  listCachedSessions,
  updateSessionTitle,
  removeSessionFromCache,
} from "./session-cache";
```

注册 handler：

```typescript
ipcMain.handle("delete-session", (_event, sessionId: string) => {
  const conn = getConnectionConfig();
  if (conn.mode === "ssh" && conn.ssh) return false;
  const ok = deleteSession(sessionId);
  if (ok) removeSessionFromCache(sessionId);
  return ok;
});
```

- SSH 模式下暂不支持删除（返回 false）
- 删除成功后同步清理缓存

### 4. Preload 桥接 — `src/preload/index.ts`

```typescript
deleteSession: (sessionId: string): Promise<boolean> =>
  ipcRenderer.invoke("delete-session", sessionId),
```

### 5. 类型定义 — `src/preload/index.d.ts`

```typescript
deleteSession: (sessionId: string) => Promise<boolean>;
```

### 6. 前端 UI — `src/renderer/src/screens/Sessions/Sessions.tsx`

主要变更：

- 导入 `Trash` 图标
- `SessionCard` memo 组件新增 `onDelete` prop，渲染删除按钮
- 新增 `handleDelete` 回调函数，使用 `window.confirm` 弹出确认框
- 删除成功后从本地 state 中过滤掉对应会话
- 搜索结果列表中的卡片同样添加了删除按钮

```typescript
const handleDelete = useCallback(
  async (sessionId: string) => {
    const confirmed = window.confirm(t("sessions.deleteConfirm"));
    if (!confirmed) return;
    const ok = await window.hermesAPI.deleteSession(sessionId);
    if (ok) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setSearchResults((prev) => prev.filter((r) => r.sessionId !== sessionId));
    }
  },
  [t],
);
```

### 7. 国际化 — i18n

**中文** (`src/shared/i18n/locales/zh-CN/sessions.ts`)：

```typescript
delete: "删除",
deleteConfirm: "确定要删除这个会话吗？此操作不可撤销。",
```

**英文** (`src/shared/i18n/locales/en/sessions.ts`)：

```typescript
delete: "Delete",
deleteConfirm: "Are you sure you want to delete this session? This cannot be undone.",
```

### 8. 样式 — `src/renderer/src/assets/main.css`

`.sessions-card` 新增 `position: relative`，为绝对定位的删除按钮提供定位上下文。

删除按钮样式（hover 时显示）：

```css
.sessions-card-delete {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--transition), color var(--transition), background var(--transition);
}

.sessions-card:hover .sessions-card-delete,
.sessions-card--active .sessions-card-delete {
  opacity: 1;
}

.sessions-card-delete:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}
```

---

## 功能行为

1. **鼠标悬停** → 会话卡片右上角出现红色的 🗑 删除按钮（默认隐藏，hover 显示）
2. **点击删除** → 弹出浏览器原生 confirm 确认对话框
3. **确认删除** →
   - 从 SQLite 数据库中删除会话及其所有消息（事务保证）
   - 从本地 `sessions.json` 缓存中移除
   - 前端列表即时更新，无需刷新页面
4. **取消删除** → 无任何操作
5. **搜索模式** → 搜索结果中的会话同样支持删除操作

---

## 构建验证

```bash
pnpm run build:win
```

- `typecheck` — ✅ 通过
- `vite build` (main + preload + renderer) — ✅ 通过
- `electron-builder` — ✅ 生成 `dist/hermes-desktop-0.3.7-setup.exe`
