package network

import (
	"fmt"
	"net"
	"net/url"
	"sync"

	"github.com/flow-packet/server/internal/codec"
	"github.com/gorilla/websocket"
)

// WSClient WebSocket 网关客户端, 实现 Client 接口
// 通过 WebSocket Binary Message 传输协议帧, 帧格式与 TCP 完全相同
type WSClient struct {
	mu    sync.RWMutex
	state ConnState
	conn  *websocket.Conn
	addr  string // 目标地址, 用于重连

	packetCfg    codec.PacketConfig
	reconnectCfg ReconnectConfig
	reconnector  *Reconnector

	connectHandler    ConnectHandler
	disconnectHandler DisconnectHandler
	receiveHandler    ReceiveHandler

	sendCh chan []byte
	done   chan struct{}
}

// NewWSClient 创建 WebSocket 网关客户端
func NewWSClient(cfg codec.PacketConfig) *WSClient {
	return &WSClient{
		state:        ConnStateDisconnected,
		packetCfg:    cfg,
		reconnectCfg: DefaultReconnectConfig(),
		sendCh:       make(chan []byte, 256),
	}
}

// SetPacketConfig 动态更新协议帧配置
func (c *WSClient) SetPacketConfig(cfg codec.PacketConfig) {
	c.packetCfg = cfg
}

// SetReconnectConfig 设置重连配置
func (c *WSClient) SetReconnectConfig(cfg ReconnectConfig) {
	c.reconnectCfg = cfg
}

// Connect 建立 WebSocket 连接
func (c *WSClient) Connect(addr string) error {
	c.mu.Lock()
	if c.state == ConnStateConnected {
		c.mu.Unlock()
		return nil
	}
	c.state = ConnStateConnecting
	c.mu.Unlock()

	u := url.URL{Scheme: "ws", Host: addr}
	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		c.mu.Lock()
		c.state = ConnStateDisconnected
		c.mu.Unlock()
		return err
	}

	c.mu.Lock()
	c.conn = conn
	c.addr = addr
	c.state = ConnStateConnected
	c.done = make(chan struct{})
	c.drainSendCh()
	c.mu.Unlock()

	wsConn := &wsConnWrapper{conn: conn}

	if h := c.connectHandler; h != nil {
		h(wsConn)
	}

	go c.readLoop(wsConn)
	go c.writeLoop(wsConn)

	return nil
}

// Disconnect 断开连接(主动断开不触发重连)
func (c *WSClient) Disconnect() error {
	if c.reconnector != nil {
		c.reconnector.Stop()
	}

	c.mu.Lock()
	if c.state == ConnStateDisconnected {
		c.mu.Unlock()
		return nil
	}
	c.state = ConnStateDisconnected
	conn := c.conn
	c.conn = nil

	select {
	case <-c.done:
	default:
		close(c.done)
	}
	c.mu.Unlock()

	if conn != nil {
		return conn.Close()
	}
	return nil
}

// Send 发送已编码的数据帧
func (c *WSClient) Send(data []byte) error {
	c.mu.RLock()
	if c.state != ConnStateConnected {
		c.mu.RUnlock()
		return net.ErrClosed
	}
	c.mu.RUnlock()

	select {
	case c.sendCh <- data:
		return nil
	case <-c.done:
		return net.ErrClosed
	}
}

// State 获取当前连接状态
func (c *WSClient) State() ConnState {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.state
}

// OnConnect 注册连接建立回调
func (c *WSClient) OnConnect(handler ConnectHandler) {
	c.connectHandler = handler
}

// OnDisconnect 注册连接断开回调
func (c *WSClient) OnDisconnect(handler DisconnectHandler) {
	c.disconnectHandler = handler
}

// OnReceive 注册数据接收回调
func (c *WSClient) OnReceive(handler ReceiveHandler) {
	c.receiveHandler = handler
}

// readLoop 读 goroutine, 每条 Binary Message 是一个完整协议帧
func (c *WSClient) readLoop(conn *wsConnWrapper) {
	for {
		select {
		case <-c.done:
			return
		default:
		}

		msgType, msg, err := c.conn.ReadMessage()
		if err != nil {
			c.handleDisconnect(conn, err)
			return
		}

		if msgType != websocket.BinaryMessage {
			continue
		}

		pkt, err := codec.DecodeBytes(msg, c.packetCfg)
		if err != nil {
			continue
		}

		if h := c.receiveHandler; h != nil {
			encoded, encErr := codec.Encode(pkt, c.packetCfg)
			if encErr == nil {
				h(conn, encoded)
			}
		}
	}
}

// writeLoop 写 goroutine, 从 sendCh 读取数据通过 WebSocket Binary Message 发送
func (c *WSClient) writeLoop(conn *wsConnWrapper) {
	for {
		select {
		case <-c.done:
			return
		case data := <-c.sendCh:
			if err := c.conn.WriteMessage(websocket.BinaryMessage, data); err != nil {
				c.handleDisconnect(conn, err)
				return
			}
		}
	}
}

// handleDisconnect 处理断开连接, 并在配置启用时触发重连
func (c *WSClient) handleDisconnect(conn *wsConnWrapper, err error) {
	c.mu.Lock()
	if c.state == ConnStateDisconnected {
		c.mu.Unlock()
		return
	}
	c.state = ConnStateDisconnected
	addr := c.addr
	c.conn = nil
	select {
	case <-c.done:
	default:
		close(c.done)
	}
	c.mu.Unlock()

	conn.Close()

	if h := c.disconnectHandler; h != nil {
		h(conn, err)
	}

	if c.reconnectCfg.Enable && addr != "" {
		c.mu.Lock()
		c.state = ConnStateReconnecting
		c.mu.Unlock()

		c.reconnector = NewReconnector(c.reconnectCfg)
		c.reconnector.Start(
			func() error { return c.Connect(addr) },
			nil,
			func(retries int) {
				c.mu.Lock()
				c.state = ConnStateDisconnected
				c.mu.Unlock()
			},
		)
	}
}

// drainSendCh 清空发送通道中的残留数据
func (c *WSClient) drainSendCh() {
	for {
		select {
		case <-c.sendCh:
		default:
			return
		}
	}
}

// wsConnWrapper 将 websocket.Conn 包装为 network.Conn 接口
type wsConnWrapper struct {
	conn *websocket.Conn
}

func (w *wsConnWrapper) Read(b []byte) (int, error) {
	return 0, fmt.Errorf("websocket: use ReadMessage instead of Read")
}

func (w *wsConnWrapper) Write(b []byte) (int, error) {
	err := w.conn.WriteMessage(websocket.BinaryMessage, b)
	if err != nil {
		return 0, err
	}
	return len(b), nil
}

func (w *wsConnWrapper) Close() error { return w.conn.Close() }

func (w *wsConnWrapper) LocalAddr() net.Addr { return w.conn.LocalAddr() }

func (w *wsConnWrapper) RemoteAddr() net.Addr { return w.conn.RemoteAddr() }
