package network

import (
	"net"
	"sync"

	"github.com/flow-packet/server/internal/codec"
)

// TCPClient TCP 客户端，实现 Client 接口
// 采用读写 goroutine 分离模型，集成协议帧 Decoder 进行收包
type TCPClient struct {
	mu    sync.RWMutex
	state ConnState
	conn  net.Conn
	addr  string // 目标地址，用于重连

	packetCfg    codec.PacketConfig
	reconnectCfg ReconnectConfig
	reconnector  *Reconnector

	connectHandler    ConnectHandler
	disconnectHandler DisconnectHandler
	receiveHandler    ReceiveHandler

	sendCh chan []byte
	done   chan struct{}
}

// NewTCPClient 创建 TCP 客户端
func NewTCPClient(cfg codec.PacketConfig) *TCPClient {
	return &TCPClient{
		state:        ConnStateDisconnected,
		packetCfg:    cfg,
		reconnectCfg: DefaultReconnectConfig(),
		sendCh:       make(chan []byte, 256),
	}
}

// SetPacketConfig 动态更新协议帧配置
func (c *TCPClient) SetPacketConfig(cfg codec.PacketConfig) {
	c.packetCfg = cfg
}

// SetReconnectConfig 设置重连配置
func (c *TCPClient) SetReconnectConfig(cfg ReconnectConfig) {
	c.reconnectCfg = cfg
}

// Connect 建立 TCP 连接
func (c *TCPClient) Connect(addr string) error {
	c.mu.Lock()
	if c.state == ConnStateConnected {
		c.mu.Unlock()
		return nil
	}
	c.state = ConnStateConnecting
	c.mu.Unlock()

	conn, err := net.Dial("tcp", addr)
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
	// drain sendCh from previous session
	c.drainSendCh()
	c.mu.Unlock()

	tcpConn := &tcpConnWrapper{conn: conn}

	if h := c.connectHandler; h != nil {
		h(tcpConn)
	}

	go c.readLoop(tcpConn)
	go c.writeLoop(tcpConn)

	return nil
}

// Disconnect 断开连接（主动断开不触发重连）
func (c *TCPClient) Disconnect() error {
	// 停止重连器
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

	// signal goroutines to stop
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
func (c *TCPClient) Send(data []byte) error {
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
func (c *TCPClient) State() ConnState {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.state
}

// OnConnect 注册连接建立回调
func (c *TCPClient) OnConnect(handler ConnectHandler) {
	c.connectHandler = handler
}

// OnDisconnect 注册连接断开回调
func (c *TCPClient) OnDisconnect(handler DisconnectHandler) {
	c.disconnectHandler = handler
}

// OnReceive 注册数据接收回调
func (c *TCPClient) OnReceive(handler ReceiveHandler) {
	c.receiveHandler = handler
}

// readLoop 读 goroutine，使用 codec.Decoder 解码帧
func (c *TCPClient) readLoop(conn *tcpConnWrapper) {
	decoder := codec.NewDecoder(conn.conn, c.packetCfg)

	for {
		select {
		case <-c.done:
			return
		default:
		}

		pkt, err := decoder.Decode()
		if err != nil {
			c.handleDisconnect(conn, err)
			return
		}

		// 将解码后的 packet 重新编码为字节交给 receiveHandler
		// 这样上层可以拿到完整的 Packet 信息
		if h := c.receiveHandler; h != nil {
			encoded, encErr := codec.Encode(pkt, c.packetCfg)
			if encErr == nil {
				h(conn, encoded)
			}
		}
	}
}

// writeLoop 写 goroutine，从 sendCh 读取数据写入连接
func (c *TCPClient) writeLoop(conn *tcpConnWrapper) {
	for {
		select {
		case <-c.done:
			return
		case data := <-c.sendCh:
			if _, err := conn.Write(data); err != nil {
				c.handleDisconnect(conn, err)
				return
			}
		}
	}
}

// handleDisconnect 处理断开连接，并在配置启用时触发重连
func (c *TCPClient) handleDisconnect(conn *tcpConnWrapper, err error) {
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

	// 触发重连
	if c.reconnectCfg.Enable && addr != "" {
		c.mu.Lock()
		c.state = ConnStateReconnecting
		c.mu.Unlock()

		c.reconnector = NewReconnector(c.reconnectCfg)
		c.reconnector.Start(
			func() error { return c.Connect(addr) },
			nil, // onSuccess: Connect 内部会触发 OnConnect 回调
			func(retries int) {
				c.mu.Lock()
				c.state = ConnStateDisconnected
				c.mu.Unlock()
			},
		)
	}
}

// drainSendCh 清空发送通道中的残留数据
func (c *TCPClient) drainSendCh() {
	for {
		select {
		case <-c.sendCh:
		default:
			return
		}
	}
}

// tcpConnWrapper 将 net.Conn 包装为 network.Conn 接口
type tcpConnWrapper struct {
	conn net.Conn
}

func (w *tcpConnWrapper) Read(b []byte) (int, error)  { return w.conn.Read(b) }
func (w *tcpConnWrapper) Write(b []byte) (int, error) { return w.conn.Write(b) }
func (w *tcpConnWrapper) Close() error                { return w.conn.Close() }
func (w *tcpConnWrapper) LocalAddr() net.Addr         { return w.conn.LocalAddr() }
func (w *tcpConnWrapper) RemoteAddr() net.Addr        { return w.conn.RemoteAddr() }
