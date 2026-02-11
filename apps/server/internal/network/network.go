// Package network 提供网络层统一接口与 TCP/WebSocket 实现，参考 dobyte/due 的接口抽象
package network

import "net"

// Conn 连接接口，抽象不同传输协议的连接
type Conn interface {
	// Read 读取数据
	Read(b []byte) (n int, err error)
	// Write 写入数据
	Write(b []byte) (n int, err error)
	// Close 关闭连接
	Close() error
	// LocalAddr 本地地址
	LocalAddr() net.Addr
	// RemoteAddr 远端地址
	RemoteAddr() net.Addr
}

// ConnState 连接状态
type ConnState int

const (
	ConnStateDisconnected ConnState = iota // 未连接
	ConnStateConnecting                    // 连接中
	ConnStateConnected                     // 已连接
	ConnStateReconnecting                  // 重连中
)

// String 返回连接状态的字符串表示
func (s ConnState) String() string {
	switch s {
	case ConnStateDisconnected:
		return "disconnected"
	case ConnStateConnecting:
		return "connecting"
	case ConnStateConnected:
		return "connected"
	case ConnStateReconnecting:
		return "reconnecting"
	default:
		return "unknown"
	}
}

// ConnectHandler 连接建立回调
type ConnectHandler func(conn Conn)

// DisconnectHandler 连接断开回调
type DisconnectHandler func(conn Conn, err error)

// ReceiveHandler 数据接收回调
type ReceiveHandler func(conn Conn, data []byte)

// Client 客户端接口，管理到远端服务器的连接
type Client interface {
	// Connect 建立连接
	Connect(addr string) error
	// Disconnect 断开连接
	Disconnect() error
	// Send 发送数据
	Send(data []byte) error
	// State 获取当前连接状态
	State() ConnState
	// OnConnect 注册连接建立回调
	OnConnect(handler ConnectHandler)
	// OnDisconnect 注册连接断开回调
	OnDisconnect(handler DisconnectHandler)
	// OnReceive 注册数据接收回调
	OnReceive(handler ReceiveHandler)
}

// Server 服务端接口，监听并接受连接
type Server interface {
	// Start 启动服务，开始监听指定地址
	Start(addr string) error
	// Stop 停止服务
	Stop() error
	// OnConnect 注册新连接回调
	OnConnect(handler ConnectHandler)
	// OnDisconnect 注册连接断开回调
	OnDisconnect(handler DisconnectHandler)
	// OnReceive 注册数据接收回调
	OnReceive(handler ReceiveHandler)
}
