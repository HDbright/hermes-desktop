# DeepSeek Provider 新增记录

**日期**: 2026-05-17  
**修改类型**: 新增功能  
**描述**: 在 Hermes Desktop 中添加 DeepSeek 作为正式的 AI Provider

---

## 修改内容

### 1. 涉及文件

- `src/renderer/src/constants.ts` - 主要修改文件

### 2. 具体修改

#### 2.1 在 `PROVIDERS.options` 中添加 DeepSeek 选项
```typescript
{ value: "deepseek", label: "DeepSeek" },
```
位置：`constants.ts` 第 26 行

#### 2.2 在 `PROVIDERS.labels` 中添加 DeepSeek 标签
```typescript
deepseek: "DeepSeek",
```
位置：`constants.ts` 第 39 行

#### 2.3 在 `PROVIDERS.setup` 数组中添加完整的 DeepSeek 配置
```typescript
{
  id: "deepseek",
  name: "DeepSeek",
  desc: "DeepSeek AI, specialized for coding and reasoning",
  tag: "",
  envKey: "DEEPSEEK_API_KEY",
  url: "https://platform.deepseek.com/api_keys",
  placeholder: "sk-...",
  configProvider: "deepseek",
  baseUrl: "https://api.deepseek.com/v1",
  needsKey: true,
},
```
位置：`constants.ts` 第 118-129 行

---

## 功能说明

### 用户可以在以下场景使用 DeepSeek：

1. **"Set Up Your AI Provider" 页面** - 用户现在可以直接在 Setup 页面选择 DeepSeek 作为 Provider
2. **Providers 配置页面** - DeepSeek 会出现在 Provider 下拉选择器中
3. **Credentials 管理** - DEEPSEEK_API_KEY 已经在 SETTINGS_SECTIONS 中预配置好

### 相关配置（已存在）：

- ✅ `LOCAL_PRESETS` - DeepSeek 已经在本地预设中
- ✅ `SETTINGS_SECTIONS` - DEEPSEEK_API_KEY 已配置
- ✅ `resolveCustomEnvKey()` - 已支持 DeepSeek URL 识别

---

## 使用方法

1. 打开 Hermes Desktop 的 Setup 页面
2. 在 Provider 选择区域点击 "DeepSeek"
3. 输入你的 DeepSeek API Key（可在 https://platform.deepseek.com/api_keys 获取）
4. 点击 Continue 完成配置
5. 开始使用 DeepSeek 进行对话和任务

---

## 相关文件参考

- `src/renderer/src/screens/Setup/Setup.tsx` - Provider 选择 UI 组件
- `src/renderer/src/screens/Providers/Providers.tsx` - Provider 配置页面组件
- `src/renderer/src/constants.ts` - 核心配置文件
