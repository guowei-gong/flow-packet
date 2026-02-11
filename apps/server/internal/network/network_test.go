package network

import (
	"net"
	"testing"
)

// mockConn 用于验证 Conn 接口契约的 mock 实现
type mockConn struct {
	closed     bool
	written    []byte
	localAddr  net.Addr
	remoteAddr net.Addr
}

func (c *mockConn) Read(b []byte) (int, error)  { return 0, nil }
func (c *mockConn) Write(b []byte) (int, error) { c.written = b; return len(b), nil }
func (c *mockConn) Close() error                { c.closed = true; return nil }
func (c *mockConn) LocalAddr() net.Addr         { return c.localAddr }
func (c *mockConn) RemoteAddr() net.Addr        { return c.remoteAddr }

// mockClient 用于验证 Client 接口契约的 mock 实现
type mockClient struct {
	state            ConnState
	connectHandler   ConnectHandler
	disconnectHandler DisconnectHandler
	receiveHandler   ReceiveHandler
}

func (c *mockClient) Connect(addr string) error     { c.state = ConnStateConnected; return nil }
func (c *mockClient) Disconnect() error              { c.state = ConnStateDisconnected; return nil }
func (c *mockClient) Send(data []byte) error         { return nil }
func (c *mockClient) State() ConnState               { return c.state }
func (c *mockClient) OnConnect(h ConnectHandler)      { c.connectHandler = h }
func (c *mockClient) OnDisconnect(h DisconnectHandler) { c.disconnectHandler = h }
func (c *mockClient) OnReceive(h ReceiveHandler)      { c.receiveHandler = h }

func TestConnInterface(t *testing.T) {
	var conn Conn = &mockConn{
		localAddr:  &net.TCPAddr{IP: net.ParseIP("127.0.0.1"), Port: 8080},
		remoteAddr: &net.TCPAddr{IP: net.ParseIP("192.168.1.1"), Port: 9001},
	}

	// 验证写入
	data := []byte("hello")
	n, err := conn.Write(data)
	if err != nil {
		t.Fatalf("Write error: %v", err)
	}
	if n != len(data) {
		t.Fatalf("Write returned %d, want %d", n, len(data))
	}

	// 验证地址
	if conn.LocalAddr().String() != "127.0.0.1:8080" {
		t.Fatalf("LocalAddr = %s, want 127.0.0.1:8080", conn.LocalAddr())
	}
	if conn.RemoteAddr().String() != "192.168.1.1:9001" {
		t.Fatalf("RemoteAddr = %s, want 192.168.1.1:9001", conn.RemoteAddr())
	}

	// 验证关闭
	if err := conn.Close(); err != nil {
		t.Fatalf("Close error: %v", err)
	}
	if !conn.(*mockConn).closed {
		t.Fatal("Close did not set closed flag")
	}
}

func TestClientInterface(t *testing.T) {
	var client Client = &mockClient{}

	// 验证初始状态
	if client.State() != ConnStateDisconnected {
		t.Fatalf("initial state = %v, want disconnected", client.State())
	}

	// 验证连接
	if err := client.Connect("127.0.0.1:9001"); err != nil {
		t.Fatalf("Connect error: %v", err)
	}
	if client.State() != ConnStateConnected {
		t.Fatalf("state after connect = %v, want connected", client.State())
	}

	// 验证断开
	if err := client.Disconnect(); err != nil {
		t.Fatalf("Disconnect error: %v", err)
	}
	if client.State() != ConnStateDisconnected {
		t.Fatalf("state after disconnect = %v, want disconnected", client.State())
	}

	// 验证回调注册
	connectCalled := false
	client.OnConnect(func(conn Conn) { connectCalled = true })
	client.OnDisconnect(func(conn Conn, err error) {})
	client.OnReceive(func(conn Conn, data []byte) {})

	mc := client.(*mockClient)
	if mc.connectHandler == nil {
		t.Fatal("OnConnect handler not registered")
	}
	if mc.disconnectHandler == nil {
		t.Fatal("OnDisconnect handler not registered")
	}
	if mc.receiveHandler == nil {
		t.Fatal("OnReceive handler not registered")
	}

	// 触发回调验证
	mc.connectHandler(nil)
	if !connectCalled {
		t.Fatal("OnConnect handler not called")
	}
}

func TestConnStateString(t *testing.T) {
	tests := []struct {
		state ConnState
		want  string
	}{
		{ConnStateDisconnected, "disconnected"},
		{ConnStateConnecting, "connecting"},
		{ConnStateConnected, "connected"},
		{ConnStateReconnecting, "reconnecting"},
		{ConnState(99), "unknown"},
	}
	for _, tt := range tests {
		if got := tt.state.String(); got != tt.want {
			t.Errorf("ConnState(%d).String() = %q, want %q", tt.state, got, tt.want)
		}
	}
}
