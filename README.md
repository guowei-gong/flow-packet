# FlowPacket

一款自定义协议帧的画布测试工具，支持多种网络协议和编码方式。

## 🤔 为什么需要 FlowPacket

游戏服的特性，导致使用常见的测试工具时存在一些障碍：

- **自定义长连接协议**

  为了让玩家获得更好的游戏体验，游戏服通常采用 TCP、WebSocket、KCP 等长连接通信。大多数 API 测试工具围绕 HTTP 设计，无法直接对接这些协议和自定义的二进制协议帧

- **测试用例难以管理**

  以往测试通常是手写一个 `Client.go`，在里面编写发送和监听逻辑。随着测试场景越来越多，文件不断膨胀，需要频繁地新增函数、注释掉暂时不用的用例，再取消注释来切换测试目标。而游戏业务往往是多步骤且有序的（如先创建角色，再进入游戏），每次只想验证流程中的某几步时，就得反复注释和恢复前置步骤——管理成本远大于编写成本

- **Proto 编码支持缺失**

  游戏服普遍使用 Protobuf 作为序列化方案，但常见的 API 测试工具对 Proto 编码的支持非常有限，往往需要额外的插件或手动转换，流程繁琐

- **需要面向网关获取真实结果**

  游戏服不仅需要测试请求-响应的业务逻辑，还需要验证服务端主动推送的通知是否正常。这些通知能力由网关提供，如果直接连接游戏节点，只能拿到一对一的响应，无法验证通知推送是否正确到达

FlowPacket 通过**可视化画布**解决以上问题——将协议消息建模为节点，用连线定义执行顺序，所见即所得地编排和运行完整的基本测试流程。

## 👀 预览

![运行结果](./docs/image/review.png)


<details>
<summary>自定义协议帧</summary>

![自定义协议帧](./docs/image/custom_head_frame.png)
</details>

<details>
<summary>模板可复用</summary>

![模板可复用](./docs/image/head_frame.png)
</details>

<details>
<summary>保存画布</summary>

![保存画布](./docs/image/save-canve.png)
</details>

<details>
<summary>自定义请求参数</summary>

![自定义请求参数](./docs/image/input_params.png)
</details>

## ✨ 核心功能

- 支持自定义头协议帧
- 画布拖拽构建测试用例
- 支持导入并解析 Proto
- 支持 Proto/Json 编解码
- 支持 TCP/Websocket 长连接
- 支持常见的游戏开源框架 Cherry/Due/Pomelo 协议帧

## 🚀 快速开始

请到发布页面下载对应的安装包：[Release page](https://github.com/guowei-gong/flow-packet/releases)

## 🔨 从源码构建

```bash
# 前置依赖：Node.js 18+, Go 1.21+

# 安装前端依赖
cd apps/renderer && npm install

# 开发模式
npm run dev

# 运行后端
cd apps/server/cmd/flow-packet/main.go
```

## 🛠 技术栈

| 层  | 技术                 |
|----|--------------------|
| 前端 | React + TypeScript |
| 画布 | React Flow         |
| 桌面 | Electron           |
| 后端 | Go                 |

## 👋 交流与讨论

个人微信：ggw1315

## 🍉 其他

- 感谢 [LINUX DO](https://linux.do/) 社区的 `开源自荐` 模块让更多朋友了解 FlowPacet 工具
