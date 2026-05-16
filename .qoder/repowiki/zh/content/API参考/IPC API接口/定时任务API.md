# 定时任务API

<cite>
**本文档引用的文件**
- [src/main/cronjobs.ts](file://src/main/cronjobs.ts)
- [src/main/index.ts](file://src/main/index.ts)
- [src/preload/index.ts](file://src/preload/index.ts)
- [src/renderer/src/screens/Schedules/Schedules.tsx](file://src/renderer/src/screens/Schedules/Schedules.tsx)
- [src/shared/i18n/locales/zh-CN/schedules.ts](file://src/shared/i18n/locales/zh-CN/schedules.ts)
- [src/shared/i18n/locales/en/schedules.ts](file://src/shared/i18n/locales/en/schedules.ts)
- [tests/ipc-handlers.test.ts](file://tests/ipc-handlers.test.ts)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)

## 简介

定时任务API是Hermes桌面应用中的核心功能模块，允许用户创建、管理和执行基于Cron表达式的自动化任务。该模块提供了完整的任务生命周期管理，包括任务创建、状态跟踪、执行控制和结果交付。

该API支持本地模式和远程模式两种运行方式，通过Electron的IPC机制实现前后端通信。系统集成了Cron表达式解析、任务调度机制和执行状态跟踪功能，为用户提供了一个强大而灵活的自动化任务管理平台。

## 项目结构

定时任务API的实现遵循Electron应用的标准架构模式，主要分布在以下三个层次：

```mermaid
graph TB
subgraph "渲染进程 (Renderer)"
UI[Schedules界面]
API[hermesAPI封装]
end
subgraph "主进程 (Main)"
IPC[IPC处理器]
CRON[CronJobs模块]
end
subgraph "系统集成"
FS[文件系统]
CLI[Hermes CLI]
REMOTE[远程API]
end
UI --> API
API --> IPC
IPC --> CRON
CRON --> FS
CRON --> CLI
CRON --> REMOTE
style UI fill:#e1f5fe
style API fill:#f3e5f5
style IPC fill:#fff3e0
style CRON fill:#e8f5e8
```

**图表来源**
- [src/main/cronjobs.ts:1-281](file://src/main/cronjobs.ts#L1-L281)
- [src/main/index.ts:934-963](file://src/main/index.ts#L934-L963)
- [src/preload/index.ts:578-640](file://src/preload/index.ts#L578-L640)

**章节来源**
- [src/main/cronjobs.ts:1-281](file://src/main/cronjobs.ts#L1-L281)
- [src/main/index.ts:934-963](file://src/main/index.ts#L934-L963)
- [src/preload/index.ts:578-640](file://src/preload/index.ts#L578-L640)

## 核心组件

定时任务API由四个核心组件构成，每个组件都有明确的职责分工：

### CronJob数据模型

CronJob接口定义了任务的完整数据结构，包括基本属性、状态信息和执行历史：

```mermaid
classDiagram
class CronJob {
+string id
+string name
+string schedule
+string prompt
+string state
+boolean enabled
+string next_run_at
+string last_run_at
+string last_status
+string last_error
+Repeat repeat
+string[] deliver
+string[] skills
+string script
}
class Repeat {
+number times
+number completed
}
CronJob --> Repeat : "包含"
```

**图表来源**
- [src/main/cronjobs.ts:9-24](file://src/main/cronjobs.ts#L9-L24)

### IPC通信层

IPC层负责前后端之间的消息传递，提供了类型安全的API封装：

```mermaid
sequenceDiagram
participant UI as "Schedules界面"
participant API as "hermesAPI"
participant IPC as "IPC处理器"
participant CRON as "CronJobs模块"
UI->>API : createCronJob(schedule, prompt)
API->>IPC : ipcRenderer.invoke("create-cron-job", ...)
IPC->>CRON : createCronJob(schedule, prompt)
CRON->>CRON : 验证参数
CRON->>CRON : 执行CLI命令
CRON-->>IPC : 返回结果
IPC-->>API : 返回Promise
API-->>UI : 处理结果
```

**图表来源**
- [src/preload/index.ts:601-615](file://src/preload/index.ts#L601-L615)
- [src/main/index.ts:940-949](file://src/main/index.ts#L940-L949)

**章节来源**
- [src/main/cronjobs.ts:9-24](file://src/main/cronjobs.ts#L9-L24)
- [src/preload/index.ts:578-640](file://src/preload/index.ts#L578-L640)
- [src/main/index.ts:934-963](file://src/main/index.ts#L934-L963)

## 架构概览

定时任务API采用分层架构设计，确保了良好的可维护性和扩展性：

```mermaid
graph TD
subgraph "表现层"
Schedules[Schedules界面]
I18n[国际化支持]
end
subgraph "API层"
hermesAPI[hermesAPI封装]
IPCHandlers[IPC处理器]
end
subgraph "业务逻辑层"
CronJobs[CronJobs模块]
Scheduler[调度器]
end
subgraph "数据访问层"
FileSystem[文件系统]
RemoteAPI[远程API]
HermesCLI[Hermes CLI]
end
Schedules --> hermesAPI
hermesAPI --> IPCHandlers
IPCHandlers --> CronJobs
CronJobs --> FileSystem
CronJobs --> RemoteAPI
CronJobs --> HermesCLI
CronJobs --> Scheduler
style Schedules fill:#e3f2fd
style hermesAPI fill:#f1f8e9
style CronJobs fill:#fff8e1
style FileSystem fill:#fce4ec
```

**图表来源**
- [src/renderer/src/screens/Schedules/Schedules.tsx:56-92](file://src/renderer/src/screens/Schedules/Schedules.tsx#L56-L92)
- [src/preload/index.ts:578-640](file://src/preload/index.ts#L578-L640)
- [src/main/cronjobs.ts:87-136](file://src/main/cronjobs.ts#L87-L136)

## 详细组件分析

### Cron表达式解析与验证

Cron表达式解析是定时任务的核心功能之一，系统支持标准的Cron格式和用户友好的频率选择器：

```mermaid
flowchart TD
Start([开始解析]) --> ValidateFormat["验证Cron格式"]
ValidateFormat --> FormatValid{"格式有效?"}
FormatValid --> |否| BuildFromFrequency["从频率构建Cron"]
FormatValid --> |是| ParseExpression["解析Cron表达式"]
BuildFromFrequency --> FrequencyType{"频率类型"}
FrequencyType --> Minutes["按分钟"]
FrequencyType --> Hourly["按小时"]
FrequencyType --> Daily["每天"]
FrequencyType --> Weekly["每周"]
FrequencyType --> Custom["自定义"]
ParseExpression --> ValidateComponents["验证各组件"]
ValidateComponents --> ComponentsValid{"组件有效?"}
ComponentsValid --> |否| ReturnError["返回解析错误"]
ComponentsValid --> |是| ReturnParsed["返回解析结果"]
Minutes --> GenerateExpression["生成Cron表达式"]
Hourly --> GenerateExpression
Daily --> GenerateExpression
Weekly --> GenerateExpression
Custom --> ValidateCustom["验证自定义表达式"]
GenerateExpression --> ReturnParsed
ValidateCustom --> ReturnParsed
```

**图表来源**
- [src/renderer/src/screens/Schedules/Schedules.tsx:125-163](file://src/renderer/src/screens/Schedules/Schedules.tsx#L125-L163)

### 任务调度机制

系统实现了完整的任务调度机制，支持多种调度策略：

```mermaid
stateDiagram-v2
[*] --> Created
Created --> Active : "启用任务"
Paused --> Active : "恢复"
Active --> Paused : "暂停"
Active --> Completed : "执行完成"
Completed --> Active : "重新启用"
Active --> Failed : "执行失败"
Failed --> Active : "重试"
Failed --> Paused : "停止"
state Active {
[*] --> Waiting
Waiting --> Executing : "到达执行时间"
Executing --> Completed : "成功执行"
Executing --> Failed : "执行失败"
Executing --> Waiting : "等待下一次"
}
```

**图表来源**
- [src/main/cronjobs.ts:14-24](file://src/main/cronjobs.ts#L14-L24)

### 远程模式集成

系统支持远程模式，允许通过HTTP API管理定时任务：

```mermaid
sequenceDiagram
participant Client as "客户端"
participant API as "Hermes API"
participant Cron as "Cron服务"
participant Storage as "存储后端"
Client->>API : GET /api/jobs
API->>Cron : 查询任务列表
Cron->>Storage : 读取任务数据
Storage-->>Cron : 返回任务列表
Cron-->>API : 返回JSON数据
API-->>Client : HTTP响应
Client->>API : POST /api/jobs
API->>Cron : 创建新任务
Cron->>Storage : 保存任务配置
Storage-->>Cron : 确认保存
Cron-->>API : 返回创建结果
API-->>Client : HTTP 201 Created
```

**图表来源**
- [src/main/cronjobs.ts:91-113](file://src/main/cronjobs.ts#L91-L113)
- [src/main/cronjobs.ts:178-197](file://src/main/cronjobs.ts#L178-L197)

**章节来源**
- [src/renderer/src/screens/Schedules/Schedules.tsx:125-163](file://src/renderer/src/screens/Schedules/Schedules.tsx#L125-L163)
- [src/main/cronjobs.ts:87-136](file://src/main/cronjobs.ts#L87-L136)
- [src/main/cronjobs.ts:178-280](file://src/main/cronjobs.ts#L178-L280)

## 依赖关系分析

定时任务API的依赖关系清晰明确，遵循单一职责原则：

```mermaid
graph LR
subgraph "外部依赖"
FS[文件系统]
ChildProcess[child_process]
Fetch[fetch API]
Path[path]
end
subgraph "内部模块"
Installer[installer模块]
Utils[utils模块]
Hermes[hermes模块]
end
subgraph "核心模块"
CronJobs[cronjobs.ts]
Main[index.ts]
Preload[preload/index.ts]
end
CronJobs --> FS
CronJobs --> ChildProcess
CronJobs --> Fetch
CronJobs --> Path
CronJobs --> Installer
CronJobs --> Utils
CronJobs --> Hermes
Main --> CronJobs
Preload --> Main
style CronJobs fill:#e8f5e8
style Main fill:#fff3e0
style Preload fill:#f3e5f5
```

**图表来源**
- [src/main/cronjobs.ts:1-7](file://src/main/cronjobs.ts#L1-L7)
- [src/main/index.ts:113-119](file://src/main/index.ts#L113-L119)
- [src/preload/index.ts:578-640](file://src/preload/index.ts#L578-L640)

**章节来源**
- [src/main/cronjobs.ts:1-7](file://src/main/cronjobs.ts#L1-L7)
- [src/main/index.ts:113-119](file://src/main/index.ts#L113-L119)
- [src/preload/index.ts:578-640](file://src/preload/index.ts#L578-L640)

## 性能考虑

定时任务API在设计时充分考虑了性能优化：

### 异步操作优化
- 使用异步文件读取避免阻塞主线程
- 实现超时机制防止长时间阻塞
- 缓存远程API响应减少网络请求

### 内存管理
- 及时清理事件监听器
- 合理使用Promise避免内存泄漏
- 控制并发执行数量

### 错误处理策略
- 实现重试机制处理临时故障
- 提供详细的错误信息便于调试
- 确保异常情况下的资源清理

## 故障排除指南

### 常见问题及解决方案

**任务无法创建**
- 检查Cron表达式格式是否正确
- 验证prompt内容是否为空
- 确认deliver目标是否有效

**任务无法执行**
- 检查系统时间和时区设置
- 验证Hermes CLI是否正常工作
- 查看任务状态和错误信息

**远程模式连接失败**
- 确认API地址和认证信息
- 检查网络连接状态
- 验证防火墙设置

**章节来源**
- [src/main/cronjobs.ts:133-135](file://src/main/cronjobs.ts#L133-L135)
- [src/main/cronjobs.ts:96-97](file://src/main/cronjobs.ts#L96-L97)

## 结论

定时任务API为Hermes桌面应用提供了完整的自动化任务管理功能。通过清晰的架构设计、完善的错误处理机制和灵活的配置选项，该模块能够满足各种复杂的定时任务需求。

系统的主要优势包括：
- 支持本地和远程两种运行模式
- 提供直观的用户界面和丰富的配置选项
- 实现了可靠的错误处理和状态跟踪
- 具备良好的性能表现和扩展性

未来可以考虑的功能增强包括：任务依赖管理、更精细的执行统计、任务模板系统等，这些改进将进一步提升用户体验和系统功能完整性。