# FlowPacket

English | [中文](./README_CN.md)

A canvas-based testing tool for custom protocol frames, supporting multiple network protocols and encoding formats.

## 🤔 Why FlowPacket

The nature of game servers makes common testing tools impractical:

- **Custom Long-Connection Protocols**

  To deliver a better gaming experience, game servers typically communicate over long-lived connections such as TCP, WebSocket, and KCP. Most API testing tools are built around HTTP and cannot interface with these protocols or custom binary frames

- **Test Cases Are Hard to Manage**

  Traditionally, testing means writing a `Client.go` with handcrafted send/receive logic. As test scenarios grow, the file bloats — you constantly add new functions, comment out unused cases, and uncomment them to switch targets. Game workflows are often multi-step and sequential (e.g., create a character, then enter the game), so verifying just a few steps requires repeatedly commenting and restoring prerequisites — the management overhead far exceeds the writing effort

- **Lack of Proto Encoding Support**

  Game servers widely use Protobuf for serialization, yet few API testing tools offer native Proto support. Extra plugins or manual conversion make the workflow cumbersome

- **Need to Test Through the Gateway**

  Game servers need to test not only request-response logic but also server-initiated push notifications. These notification capabilities are provided by the gateway — connecting directly to a game node only yields one-to-one responses and cannot verify whether push notifications are delivered correctly

FlowPacket solves these problems with a **visual canvas** — model protocol messages as nodes, define execution order with connections, and run complete test flows in a WYSIWYG manner.

## 👀 Preview

![Preview](./docs/image/review.png)


<details>
<summary>Custom Protocol Frame</summary>

![Custom Protocol Frame](./docs/image/custom_head_frame.png)
</details>

<details>
<summary>Reusable Templates</summary>

![Reusable Templates](./docs/image/head_frame.png)
</details>

<details>
<summary>Save Canvas</summary>

![Save Canvas](./docs/image/save-canve.png)
</details>

<details>
<summary>Custom Request Parameters</summary>

![Custom Request Parameters](./docs/image/input_params.png)
</details>

## ✨ Key Features

- Custom header protocol frames
- Drag-and-drop canvas to build test cases
- Import and parse Proto files
- Proto / JSON encoding and decoding
- TCP / WebSocket long connections
- Built-in support for popular game frameworks: Cherry / Due / Pomelo protocol frames

## 🚀 Getting Started

Download the installer from the release page: [Release page](https://github.com/guowei-gong/flow-packet/releases)

## 🔨 Build from Source

```bash
# Prerequisites: Node.js 18+, Go 1.21+

# Install frontend dependencies
cd apps/renderer && npm install

# Development mode
npm run dev

# Run backend
cd apps/server/cmd/flow-packet/main.go
```

## 🛠 Tech Stack

| Layer    | Technology         |
|----------|--------------------|
| Frontend | React + TypeScript |
| Canvas   | React Flow         |
| Desktop  | Electron           |
| Backend  | Go                 |

## 👋 Contact

WeChat: ggw1315

## 🍉 Acknowledgments

- Thanks to the [LINUX DO](https://linux.do/) community's open-source showcase for helping more people discover FlowPacket
