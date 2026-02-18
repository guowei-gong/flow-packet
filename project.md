# flow-packet

**可视化游戏服务器协议测试平台**

> Connect → Import → Drag → Configure → Wire → Run
> 配置连接，导入协议，拖拽编排，配置字段，画布连线，一键执行。

---

## 1. 项目概述

flow-packet 是一个面向**游戏服务器**的可视化协议测试工具。开发者通过导入 Proto 等协议定义文件，将消息节点拖拽到画布中并连线编排，即可按照流程顺序向目标服务器发起协议请求。

flow-packet 解决的核心问题：游戏服务器测试中，协议交互往往是**多步骤、有序、有状态**的（如：登录 → 进入房间 → 准备 → 开始战斗 → 结算），传统的单次请求工具（如 Postman、grpcui）无法高效处理这类场景。

### 1.1 核心工作流

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 1. 配置连接   │──▶│  2. 导入协议  │──▶│ 3. 拖拽到画布 │──▶│ 4. 配置字段   │──▶│  5. 连线编排  │──▶│  6. 运行执行  │
│ 协议/地址/端口 │    │  .proto 文件  │    │  消息成为节点  │    │  填写请求参数  │    │  定义请求顺序  │    │  按序发送请求  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 1.2 定位与边界

| 维度 | 说明 |
|------|------|
| **是什么** | 可视化协议流程编排器 + 游戏服务器测试客户端 |
| **不是什么** | 不是通用 API 网关、不是性能监控平台、不是协议设计工具 |
| **传输层** | TCP（首要），未来扩展 UDP、KCP |
| **序列化** | Protobuf（首要），未来扩展 JSON、FlatBuffers |
| **目标用户** | 游戏后端开发者、QA 测试工程师 |

---

## 2. 核心功能

### 2.1 连接配置（第一步）

用户在开始工作前，首先需要配置目标服务器连接：

- **传输协议选择**：TCP（默认）、UDP、KCP（后续版本）
- **目标地址**：IP 或域名
- **目标端口**：端口号
- **连接预设**：可保存多个连接配置，快速切换（如：本地开发服 / 测试服 / 预发布）
- **连接状态**：顶部状态栏实时显示连接状态（未连接 / 已连接 / 重连中）

```typescript
interface ConnectionConfig {
  name: string;              // 预设名称 (如 "本地开发服")
  protocol: 'tcp' | 'udp' | 'kcp';
  host: string;              // "127.0.0.1" | "game.example.com"
  port: number;              // 9001
  options: {
    timeout: number;         // 连接超时 (ms)
    reconnect: boolean;      // 是否自动重连
    reconnectInterval: number;
    reconnectMaxRetries: number;
  };
}
```

### 2.2 协议管理

- **导入 Proto 文件**：解析 `.proto` 文件，提取 `message` 定义，生成可用消息列表
- **协议浏览器**：树状结构展示所有已导入的 package、message、字段
- **多序列化支持**：Protobuf（v1）、JSON、FlatBuffers（后续版本）
- **协议版本管理**：支持同时加载多个版本的 Proto 文件

### 2.3 可视化画布

- **节点拖拽**：从协议浏览器拖拽 message 到画布，自动生成请求节点
- **连线编排**：节点间连线定义执行顺序，支持串行和条件分支
- **节点配置**：每个节点可配置请求参数、超时时间、断言条件
- **数据传递**：上游节点的响应数据可绑定到下游节点的请求参数
- **画布操作**：缩放、平移、对齐、分组、注释

### 2.4 协议帧

MVP 版本采用固定的 `size + header + route + seq + message` 帧格式（详见第 7 节）：

```
┌────────────────────────────────────────────────────────────────────────┐
│                          数据包帧结构                                   │
├──────────┬───────┬─────────┬──────────┬──────────┬─────────────────────┤
│  size    │ h (1b)│ extcode │  route   │   seq    │   message data      │
│ (4字节)  │ =0    │ (7bits) │ (默认2B) │ (默认2B)  │   (Proto编码体)     │
└──────────┴───────┴─────────┴──────────┴──────────┴─────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                          心跳包帧结构                                   │
├──────────┬───────┬─────────┬──────────────────────────────────────────┤
│  size    │ h (1b)│ extcode │        heartbeat time (ns)               │
│ (4字节)  │ =1    │ (7bits) │            (8字节)                        │
└──────────┴───────┴─────────┴──────────────────────────────────────────┘
```

- **MVP**：帧格式固定，route/seq 字节数可通过配置调整
- **后续版本**：开放完全自定义协议帧编辑器

### 2.5 连接管理

- **TCP 长连接**：建立并维持 TCP 连接，支持多连接并行
- **断线重连**：可配置重连策略（间隔、次数、退避算法）
- **连接池**：管理多个目标服务器地址的连接
- **传输层扩展**：预留 UDP、KCP 的传输层抽象接口

### 2.6 执行引擎

- **顺序执行**：按画布连线顺序依次发送请求
- **响应等待**：发送后等待服务器响应，支持超时控制
- **条件分支**：根据响应内容走不同的后续流程
- **循环节点**：支持重复执行某段流程 N 次
- **延时节点**：在流程中插入等待时间
- **变量系统**：全局变量和流程变量，支持动态参数

### 2.7 压测模式

- **并发连接**：模拟 N 个客户端同时连接
- **流程并行**：每个虚拟客户端独立执行画布流程
- **指标采集**：响应时间、成功率、吞吐量等
- **实时仪表盘**：压测过程中实时展示性能指标

---

## 3. 技术架构

### 3.1 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                     flow-packet                           │
│                                                          │
│  ┌─────────────────────────────────┐                     │
│  │      前端 (Electron Renderer)    │                     │
│  │                                 │                     │
│  │  ┌───────────┐  ┌───────────┐  │                     │
│  │  │ React Flow │  │ Proto     │  │                     │
│  │  │ 画布引擎    │  │ 浏览器     │  │                     │
│  │  └───────────┘  └───────────┘  │                     │
│  │  ┌───────────┐  ┌───────────┐  │                     │
│  │  │ 节点编辑器  │  │ 字段配置器 │  │                     │
│  │  │ (参数面板)  │  │ (值编辑)   │  │                     │
│  │  └───────────┘  └───────────┘  │                     │
│  └──────────────┬──────────────────┘                     │
│                 │ WebSocket / HTTP                        │
│  ┌──────────────▼──────────────────┐                     │
│  │         后端 (Go Service)        │                     │
│  │                                 │                     │
│  │  ┌───────────┐  ┌───────────┐  │                     │
│  │  │ Proto 解析  │  │ 协议编解码  │  │                     │
│  │  │ & 编解码    │  │ 帧封装     │  │                     │
│  │  └───────────┘  └───────────┘  │                     │
│  │  ┌───────────┐  ┌───────────┐  │                     │
│  │  │ TCP/UDP   │  │ 执行引擎   │  │                     │
│  │  │ 连接管理器  │  │ (流程调度)  │  │                     │
│  │  └───────────┘  └───────────┘  │                     │
│  │  ┌───────────┐                 │                     │
│  │  │ 压测引擎   │                 │                     │
│  │  │ (goroutine)│                 │                     │
│  │  └───────────┘                 │                     │
│  └─────────────────────────────────┘                     │
│                                                          │
│               Electron (壳) + Go (后端进程)                │
└──────────────────────────────────────────────────────────┘
```

### 3.2 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| **桌面框架** | Electron | 前端壳，启动时拉起 Go 后端进程 |
| **前端框架** | React + TypeScript | 主体 UI 框架 |
| **画布引擎** | React Flow (xyflow) | 节点拖拽、连线、画布交互 |
| **状态管理** | Zustand | 轻量，适合节点/边/连接等状态 |
| **Proto 解析** | protobufjs (前端预览) + Go protoreflect (后端解析) | 前端展示结构，后端负责实际编解码 |
| **网络层 (后端)** | Go | TCP/UDP/KCP 原生 socket，天然适合高并发网络编程 |
| **前后端通信** | WebSocket / HTTP API | Go 后端暴露本地服务，前端通过 WebSocket 通信 |
| **协议帧** | Go 自研 | 可配置的二进制帧封装/拆包模块 |
| **数据存储** | 本地文件系统 (JSON/SQLite) | 项目文件、流程配置持久化 |
| **压测引擎** | Go goroutine | goroutine 天然适合大量并发连接模拟 |
| **UI 组件库** | shadcn/ui + Tailwind CSS | 深度定制为 UE5 蓝图风格暗色主题 |
| **布局系统** | allotment / react-resizable-panels | 可拖拽调整的多面板布局 |

### 3.3 核心模块划分

```
flow-packet/
├── apps/
│   ├── server/                  # Go 后端服务
│   │   ├── cmd/
│   │   │   └── flow-packet/      # 入口
│   │   │       └── main.go
│   │   ├── internal/
│   │   │   ├── api/             # WebSocket / HTTP API 层
│   │   │   │   ├── handler.go
│   │   │   │   └── ws.go
│   │   │   ├── network/         # 传输层管理
│   │   │   │   ├── tcp.go
│   │   │   │   ├── udp.go       # (未来)
│   │   │   │   └── kcp.go       # (未来)
│   │   │   ├── codec/           # 编解码层
│   │   │   │   ├── proto.go     # Protobuf 编解码
│   │   │   │   ├── json.go      # JSON 编解码
│   │   │   │   └── frame.go     # 协议帧封装/拆包
│   │   │   ├── parser/          # Proto 文件解析
│   │   │   │   └── proto.go
│   │   │   ├── engine/          # 执行引擎
│   │   │   │   ├── runner.go    # 流程执行器
│   │   │   │   ├── scheduler.go # 节点调度
│   │   │   │   └── context.go   # 执行上下文 & 变量
│   │   │   └── bench/           # 压测模块
│   │   │       ├── pool.go      # 连接池
│   │   │       └── metrics.go   # 指标采集
│   │   ├── go.mod
│   │   └── go.sum
│   │
│   └── renderer/                # 前端 UI (Electron Renderer)
│       ├── src/
│       │   ├── components/
│       │   │   ├── canvas/      # 画布相关组件
│       │   │   │   ├── FlowCanvas.tsx
│       │   │   │   ├── nodes/   # 自定义节点类型
│       │   │   │   │   ├── RequestNode.tsx
│       │   │   │   │   ├── DelayNode.tsx
│       │   │   │   │   ├── ConditionNode.tsx
│       │   │   │   │   └── LoopNode.tsx
│       │   │   │   └── edges/   # 自定义连线
│       │   │   ├── proto/       # Proto 浏览器
│       │   │   │   ├── ProtoBrowser.tsx
│       │   │   │   └── MessageTree.tsx
│       │   │   ├── editor/      # 节点字段编辑器
│       │   │   │   ├── FieldEditor.tsx    # 字段值配置面板
│       │   │   │   ├── FieldInput.tsx     # 单字段输入组件
│       │   │   │   ├── NestedEditor.tsx   # 嵌套 message 编辑
│       │   │   │   ├── RepeatedEditor.tsx # repeated 字段编辑
│       │   │   │   ├── EnumSelector.tsx   # enum 下拉选择
│       │   │   │   ├── ParamBinder.tsx    # 变量绑定器
│       │   │   │   └── ValueModeSwitch.tsx # 字面量/变量/表达式切换
│       │   │   ├── connection/  # 连接管理面板
│       │   │   ├── execution/   # 执行面板 & 日志
│       │   │   └── bench/       # 压测仪表盘
│       │   ├── services/        # 与 Go 后端通信
│       │   │   ├── ws.ts        # WebSocket 客户端
│       │   │   └── api.ts       # HTTP API 调用
│       │   ├── stores/          # Zustand stores
│       │   ├── hooks/           # 自定义 hooks
│       │   └── types/           # TypeScript 类型定义
│       └── package.json
│
├── electron/                    # Electron 主进程 (薄层)
│   ├── main.ts                  # 启动窗口 + 拉起 Go 进程
│   └── preload.ts
│
├── docs/                        # 文档
├── examples/                    # 示例项目 & 示例 Proto
├── project.md                   # 本文件
└── README.md
```

---

## 4. 节点系统设计

### 4.1 节点类型

| 节点 | 图标 | 说明 |
|------|------|------|
| **请求节点 (Request)** | 📤 | 核心节点，发送一个协议消息并等待响应 |
| **延时节点 (Delay)** | ⏱️ | 等待指定时间后继续 |
| **条件节点 (Condition)** | 🔀 | 根据表达式判断走哪条分支 |
| **循环节点 (Loop)** | 🔁 | 重复执行子流程 N 次 |
| **日志节点 (Log)** | 📋 | 输出调试信息到执行面板 |
| **断言节点 (Assert)** | ✅ | 校验响应数据是否符合预期 |

### 4.2 请求节点数据模型

```typescript
interface RequestNode {
  id: string;
  type: 'request';

  // 协议配置
  route: number;              // 消息路由值
  messageName: string;        // 请求 Proto message 名称
  responseMessageName: string;// 响应 Proto message 名称
  protoFile: string;          // 来源 .proto 文件

  // 请求参数
  fields: Record<string, FieldValue>;   // 字段值 (支持变量绑定)

  // 执行配置
  timeout: number;            // 超时 (ms)
  retries: number;            // 重试次数

  // 响应处理
  assertions?: Assertion[];   // 断言规则
  extractors?: Extractor[];   // 从响应中提取变量
}

interface FieldValue {
  type: 'literal' | 'variable' | 'expression';
  value: string | number | boolean;
}
```

### 4.3 数据流转

```
  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │  登录请求      │────────▶│  进入房间      │────────▶│  准备就绪      │
  │              │         │              │         │              │
  │ req: {       │         │ req: {       │         │ req: {       │
  │   account,   │         │   roomId:    │         │   roomId:    │
  │   password   │         │   ${login    │         │   ${ctx.     │
  │ }            │         │     .roomId} │         │     roomId}  │
  │              │         │ }            │         │ }            │
  │ ──▶ extract: │         │              │         │              │
  │   token,     │         │              │         │              │
  │   roomId     │         │              │         │              │
  └──────────────┘         └──────────────┘         └──────────────┘
        │                                                  │
        │  token 写入全局变量                                 │
        │  roomId 传递给下游                                  │
        ▼                                                  ▼
   ctx.token = "abc123"                          游戏流程继续...
   ctx.roomId = 10086
```

---

## 5. 字段编辑器设计

字段编辑器是 MVP 的核心交互之一。用户将 Proto message 拖入画布后，点击节点即可展开右侧面板，逐字段配置请求参数。

### 5.1 交互流程

```
用户拖拽 LoginRequest 到画布
        │
        ▼
  画布出现节点卡片：
  ┌─────────────────┐
  │ 📤 LoginRequest  │
  │                 │
  │  account: ___   │
  │  password: ___  │
  │  platform: ___  │
  └─────────────────┘
        │ 点击节点
        ▼
  右侧展开字段编辑面板：
  ┌─────────────────────────────────┐
  │ LoginRequest 字段配置             │
  ├─────────────────────────────────┤
  │                                 │
  │ account  [literal ▾]            │
  │ ┌─────────────────────────┐     │
  │ │ player001               │     │
  │ └─────────────────────────┘     │
  │                                 │
  │ password [variable ▾]           │
  │ ┌─────────────────────────┐     │
  │ │ ${ctx.password}         │     │
  │ └─────────────────────────┘     │
  │                                 │
  │ platform [literal ▾]            │
  │ ┌─────────────────────────┐     │
  │ │ ▼ ANDROID              │     │
  │ │   IOS                   │     │
  │ │   PC                    │     │
  │ └─────────────────────────┘     │
  │                                 │
  └─────────────────────────────────┘
```

### 5.2 字段类型 → 输入组件映射

| Proto 类型 | 输入组件 | 说明 |
|-----------|---------|------|
| `int32/64, uint32/64, sint32/64` | 数字输入框 | 支持范围校验 |
| `float, double` | 数字输入框 | 支持小数 |
| `bool` | 开关 (Switch) | true / false |
| `string` | 文本输入框 | 单行/多行自适应 |
| `bytes` | Hex 编辑器 / Base64 输入 | 可切换显示模式 |
| `enum` | 下拉选择 (Select) | 选项来自 Proto 定义 |
| `message` (嵌套) | 可折叠子表单 | 递归渲染字段 |
| `repeated T` | 列表编辑器 | 动态增删条目 |
| `map<K, V>` | 键值对编辑器 | 动态增删键值 |
| `oneof` | Tab 切换 | 同时只激活一个字段 |

### 5.3 值模式 (Value Mode)

每个字段支持三种赋值模式，通过下拉切换：

| 模式 | 标识 | 说明 | 示例 |
|------|------|------|------|
| **字面量 (Literal)** | `literal` | 直接输入固定值 | `"player001"` |
| **变量引用 (Variable)** | `variable` | 引用上游节点的响应字段或全局变量 | `${login.token}` |
| **表达式 (Expression)** | `expression` | JavaScript 表达式，可做简单计算 | `Date.now()` |

### 5.4 字段编辑器数据模型

```typescript
// 节点中存储的字段配置
interface FieldConfig {
  name: string;           // 字段名
  protoType: string;      // Proto 类型 (int32, string, enum, message...)
  mode: 'literal' | 'variable' | 'expression';
  value: any;             // 字面量值 / 变量路径 / 表达式字符串

  // 嵌套 message 的子字段
  children?: FieldConfig[];

  // repeated 字段的条目列表
  items?: FieldConfig[];
}

// 前端发送给 Go 后端的请求数据
interface NodeExecuteRequest {
  nodeId: string;
  route: number;
  messageName: string;
  fields: Record<string, ResolvedValue>;  // 已解析后的最终值
}
```

---

## 6. 前后端通信设计

Go 后端作为独立进程运行，前端通过 WebSocket 保持长连接通信。

### 6.1 通信协议

```typescript
// 前端 → Go 后端
interface ClientMessage {
  id: string;              // 请求ID，用于匹配响应
  action: string;          // 操作类型
  payload: any;            // 操作参数
}

// Go 后端 → 前端
interface ServerMessage {
  id?: string;             // 对应请求ID (请求-响应模式)
  event: string;           // 事件类型
  payload: any;            // 事件数据
}
```

### 6.2 核心 API

| Action / Event | 方向 | 说明 |
|---------------|------|------|
| `proto.import` | 前端 → Go | 导入 Proto 文件，返回解析后的 message 结构 |
| `proto.list` | 前端 → Go | 获取已导入的所有 message 列表 |
| `conn.connect` | 前端 → Go | 建立 TCP 连接到目标服务器 |
| `conn.disconnect` | 前端 → Go | 断开连接 |
| `conn.status` | Go → 前端 | 连接状态变更推送 |
| `flow.execute` | 前端 → Go | 提交画布流程，开始执行 |
| `flow.stop` | 前端 → Go | 停止正在执行的流程 |
| `node.result` | Go → 前端 | 单个节点执行结果推送（实时） |
| `node.error` | Go → 前端 | 节点执行错误推送 |
| `flow.complete` | Go → 前端 | 整个流程执行完成 |

## 7. 协议帧设计

### 7.1 MVP 协议帧格式

MVP 版本采用固定的 `size + header + route + seq + message` 协议格式。后续版本再开放自定义协议帧配置。

#### 数据包

```
 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7
+---------------------------------------------------------------+-+-------------+-------------------------------+-------------------------------+
|                              size                             |h|   extcode   |             route             |              seq              |
+---------------------------------------------------------------+-+-------------+-------------------------------+-------------------------------+
|                                                                message data ...                                                               |
+-----------------------------------------------------------------------------------------------------------------------------------------------+
```

#### 心跳包

```
 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7
+---------------------------------------------------------------+-+-------------+---------------------------------------------------------------+
|                              size                             |h|   extcode   |                      heartbeat time (ns)                      |
+---------------------------------------------------------------+-+-------------+---------------------------------------------------------------+
```

### 7.2 字段说明

| 字段 | 长度 | 说明 |
|------|------|------|
| **size** | 4 bytes（固定） | 包长度位，不可修改 |
| **header** | 1 byte | 包含心跳标识位和扩展操作码 |
| ├─ h | 1 bit | 心跳标识。`0` = 数据包，`1` = 心跳包 |
| └─ extcode | 7 bits | 扩展操作码，暂未定义 |
| **route** | 1 / 2 / 4 bytes（默认 2） | 消息路由，不同路由对应不同业务处理流程。心跳包无此字段 |
| **seq** | 0 / 1 / 2 / 4 bytes（默认 2） | 消息序列号，用于请求/响应配对确认。设为 0 可屏蔽。心跳包无此字段 |
| **message data** | n bytes | 消息体（Proto 编码）。心跳包无此字段 |
| **heartbeat time** | 8 bytes | 服务器时间（ns）。仅下行心跳包携带，上行心跳包无需携带 |

### 7.3 Go 数据模型

```go
// PacketConfig MVP版本的协议帧配置
type PacketConfig struct {
    RouteBytes int  // route 字段字节数: 1, 2, 4（默认 2）
    SeqBytes   int  // seq 字段字节数: 0, 1, 2, 4（默认 2）
}

// Packet 解析后的数据包
type Packet struct {
    Size      uint32 // 包长度
    Heartbeat bool   // 是否为心跳包
    ExtCode   uint8  // 扩展操作码 (7 bits)
    Route     uint32 // 消息路由 (数据包)
    Seq       uint32 // 消息序列号 (数据包)
    Data      []byte // 消息体 (数据包) / 心跳时间 (心跳包)
}

// HeartbeatPacket 心跳包
type HeartbeatPacket struct {
    Size      uint32
    Heartbeat bool   // 固定为 true
    ExtCode   uint8
    TimeNano  int64  // 下行心跳携带的服务器时间 (ns)
}
```

### 7.4 编解码流程

```
发送 (Encode):
  前端填写的字段值
       │
       ▼
  Proto Marshal → message data (bytes)
       │
       ▼
  组装帧: size + header(h=0, extcode=0) + route + seq + message data
       │
       ▼
  TCP Write

接收 (Decode):
  TCP Read
       │
       ▼
  读取 size (4 bytes) → 确定完整包长
       │
       ▼
  读取 header (1 byte) → 判断 h 位
       │
       ├── h=1 → 心跳包 → 读取 heartbeat time → 推送给前端显示
       │
       └── h=0 → 数据包 → 读取 route + seq + message data
                                  │
                                  ▼
                           Proto Unmarshal → 结构化响应
                                  │
                                  ▼
                           匹配 seq → 关联到对应请求节点
                                  │
                                  ▼
                           推送给前端展示
```

### 7.5 Route 映射

在 MVP 中，用户需要配置 route 值与 Proto message 的映射关系：

```typescript
// 前端配置的路由映射表
interface RouteMapping {
  route: number;           // 路由值，如 1001
  requestMessage: string;  // 请求 message 名，如 "LoginRequest"
  responseMessage: string; // 响应 message 名，如 "LoginResponse"
  description?: string;    // 备注，如 "登录"
}

// 示例
const routes: RouteMapping[] = [
  { route: 1001, requestMessage: "LoginRequest",    responseMessage: "LoginResponse",    description: "登录" },
  { route: 1002, requestMessage: "EnterRoomRequest", responseMessage: "EnterRoomResponse", description: "进入房间" },
  { route: 2001, requestMessage: "ReadyRequest",     responseMessage: "ReadyResponse",     description: "准备就绪" },
];
```

用户在画布中拖入一个 message 节点时，自动关联其 route 值；如果尚未配置映射，则提示用户填写。

### 7.6 心跳机制

flow-packet 自动处理心跳收发，用户无需手动配置：

- **上行心跳**：Go 后端按配置间隔定时发送（不携带数据）
- **下行心跳**：接收后解析服务器时间，在执行面板中显示延迟
- **心跳超时**：连续 N 次未收到下行心跳，判定连接断开，触发重连

```go
// HeartbeatConfig 心跳配置
type HeartbeatConfig struct {
    Interval     time.Duration // 心跳发送间隔（默认 15s）
    Timeout      time.Duration // 心跳超时时间（默认 45s）
    MaxMissCount int           // 最大允许丢失次数（默认 3）
}
```

### 7.7 后续版本：自定义协议帧

v0.3 版本将开放完全自定义的协议帧配置，届时支持：

- 可视化协议头编辑器（拖拽字段、配置字节长度和字节序）
- 自定义魔数 (Magic Number)
- 自定义校验算法（CRC、Checksum 等）
- 协议模板导入/导出

---

## 8. 版本路线图

### v0.1 — MVP（最小可用版本）

- [ ] **UE5 蓝图风格界面框架**：暗色主题、四面板布局（左/中/右/底）
- [ ] **连接配置面板**：选择协议 (TCP)、输入地址、端口、连接/断开
- [ ] Proto 文件导入与解析（Go 端解析，返回 message 结构给前端）
- [ ] 协议浏览器（左侧面板，树状展示 message 列表）
- [ ] React Flow 画布：从协议浏览器拖拽消息节点、连线编排
- [ ] **蓝图风格节点**：标题栏着色、执行流引脚、数据输出引脚
- [ ] **节点字段编辑器**（右侧属性面板）：点击节点可配置每个字段的值
  - [ ] 基础类型输入（int32, string, bool, float, bytes 等）
  - [ ] enum 字段下拉选择
  - [ ] 嵌套 message 展开编辑
  - [ ] repeated 字段动态增删
  - [ ] oneof 字段切换
- [ ] 协议帧实现：`size + header(h+extcode) + route + seq + message`（Go 端）
- [ ] Route 映射配置：route 值 ↔ Proto message 名称的映射表
- [ ] 心跳包自动收发与超时检测
- [ ] TCP 连接建立与管理（Go 后端）
- [ ] Protobuf 编解码（Go 端，使用动态 message）
- [ ] 前后端 WebSocket 通信
- [ ] 按画布顺序串行发送请求
- [ ] **执行日志面板**（底部面板）：显示请求/响应、解码后的结构化数据、耗时

### v0.2 — 流程增强

- [ ] 条件分支节点
- [ ] 循环节点
- [ ] 延时节点
- [ ] 变量系统（全局变量 + 上下文传递）
- [ ] 响应数据提取器
- [ ] 断言节点

### v0.3 — 自定义协议帧

- [ ] 可视化协议头编辑器（替代 MVP 固定格式）
- [ ] 自定义字段顺序、字节长度、字节序
- [ ] 自定义魔数 (Magic Number)
- [ ] 帧校验算法（CRC、Checksum 等）
- [ ] 协议模板导入/导出
- [ ] 内置常见游戏协议模板库

### v0.4 — 项目管理与体验优化

- [ ] 项目文件保存/加载（.fpkt 格式）
- [ ] 流程模板导入/导出
- [ ] 执行历史与日志回放
- [ ] 脚本节点（自定义 JS 逻辑）
- [ ] 暗色/亮色主题

### v0.5 — 多传输层

- [ ] UDP 支持
- [ ] KCP 支持
- [ ] 传输层插件机制

### v0.6 — 压测模式

- [ ] 并发连接池管理
- [ ] 虚拟客户端批量执行
- [ ] 实时性能指标仪表盘
- [ ] 压测报告导出

### v1.0 — 正式发布

- [ ] 多序列化支持（JSON、FlatBuffers）
- [ ] 插件系统
- [ ] 完善的文档与教程
- [ ] 示例项目库
- [ ] 国际化（中/英）

---

## 9. 竞品对比

| 特性 | flow-packet | Postman | grpcui | BloomRPC | 自写脚本 |
|------|-----------|---------|--------|----------|---------|
| 可视化流程编排 | ✅ | ❌ (仅 Collection Runner) | ❌ | ❌ | ❌ |
| TCP 长连接 | ✅ | ❌ | ❌ | ❌ | ✅ |
| 自定义协议头 | ✅ | ❌ | ❌ | ❌ | ✅ |
| Proto 编解码 | ✅ | ❌ | ✅ | ✅ | ✅ |
| 数据流转/变量绑定 | ✅ | ⚠️ 有限 | ❌ | ❌ | ✅ |
| 游戏协议适配 | ✅ 专为此设计 | ❌ | ❌ | ❌ | ✅ 但成本高 |
| 上手门槛 | 低（可视化） | 低 | 中 | 低 | 高 |
| 压测能力 | ✅ (v0.6) | ❌ | ❌ | ❌ | ✅ |

---

## 10. 开发规范

### 10.1 分支策略

- `main`：稳定发布分支
- `develop`：开发主分支
- `feature/*`：功能分支
- `fix/*`：修复分支

### 10.2 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat(canvas): 添加条件分支节点
fix(network): 修复 TCP 断线重连后丢包问题
docs: 更新协议帧配置文档
refactor(codec): 重构 Proto 编解码模块
```

### 10.3 代码风格

- ESLint + Prettier
- TypeScript strict mode
- 组件命名：PascalCase
- 文件命名：kebab-case
- 中文注释，英文代码

---

## 11. 开源协议

MIT License

---

## 12. 参与贡献

flow-packet 是一个开源项目，欢迎社区参与：

1. **Issues**：提交 Bug 报告或功能建议
2. **Pull Requests**：认领 Issue 或提交改进
3. **文档**：完善使用文档和教程
4. **示例**：贡献游戏协议模板和测试用例
5. **推广**：Star、分享、写博客

> 📮 项目地址：（即将创建）
>
> 💬 交流群：待建立
