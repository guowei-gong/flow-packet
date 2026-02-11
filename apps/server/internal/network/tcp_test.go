package network

import (
	"bytes"
	"net"
	"sync"
	"testing"
	"time"

	"github.com/flow-packet/server/internal/codec"
)

// startEchoServer 启动一个简单的 TCP 回声服务器，收到数据后原样返回
func startEchoServer(t *testing.T) (addr string, cleanup func()) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen error: %v", err)
	}

	var (
		wg    sync.WaitGroup
		mu    sync.Mutex
		conns []net.Conn
	)
	done := make(chan struct{})

	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			conn, err := ln.Accept()
			if err != nil {
				select {
				case <-done:
					return
				default:
				}
				return
			}
			mu.Lock()
			conns = append(conns, conn)
			mu.Unlock()

			wg.Add(1)
			go func(c net.Conn) {
				defer wg.Done()
				defer c.Close()
				buf := make([]byte, 4096)
				for {
					n, err := c.Read(buf)
					if err != nil {
						return
					}
					c.Write(buf[:n])
				}
			}(conn)
		}
	}()

	return ln.Addr().String(), func() {
		close(done)
		ln.Close()
		mu.Lock()
		for _, c := range conns {
			c.Close()
		}
		mu.Unlock()
		wg.Wait()
	}
}

// startSendServer 启动一个 TCP 服务器，接受连接后主动发送指定数据
func startSendServer(t *testing.T, data []byte) (addr string, cleanup func()) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen error: %v", err)
	}

	done := make(chan struct{})
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		conn.Write(data)
		// keep connection open until done
		<-done
	}()

	return ln.Addr().String(), func() {
		close(done)
		ln.Close()
		wg.Wait()
	}
}

func TestTCPClientConnectDisconnect(t *testing.T) {
	addr, closeServer := startEchoServer(t)
	defer closeServer()

	client := NewTCPClient(codec.DefaultPacketConfig())

	// 初始状态应为断开
	if client.State() != ConnStateDisconnected {
		t.Fatalf("initial state = %v, want disconnected", client.State())
	}

	// 连接
	if err := client.Connect(addr); err != nil {
		t.Fatalf("Connect error: %v", err)
	}
	if client.State() != ConnStateConnected {
		t.Fatalf("state after connect = %v, want connected", client.State())
	}

	// 断开
	if err := client.Disconnect(); err != nil {
		t.Fatalf("Disconnect error: %v", err)
	}
	if client.State() != ConnStateDisconnected {
		t.Fatalf("state after disconnect = %v, want disconnected", client.State())
	}
}

func TestTCPClientConnectFailure(t *testing.T) {
	client := NewTCPClient(codec.DefaultPacketConfig())

	// 连接不存在的地址
	err := client.Connect("127.0.0.1:1")
	if err == nil {
		t.Fatal("expected error for invalid address")
	}
	if client.State() != ConnStateDisconnected {
		t.Fatalf("state after failed connect = %v, want disconnected", client.State())
	}
}

func TestTCPClientDoubleConnect(t *testing.T) {
	addr, closeServer := startEchoServer(t)
	defer closeServer()

	client := NewTCPClient(codec.DefaultPacketConfig())
	defer client.Disconnect()

	if err := client.Connect(addr); err != nil {
		t.Fatalf("Connect error: %v", err)
	}

	// 重复连接应无操作
	if err := client.Connect(addr); err != nil {
		t.Fatalf("second Connect should be no-op, got error: %v", err)
	}
}

func TestTCPClientDoubleDisconnect(t *testing.T) {
	addr, closeServer := startEchoServer(t)
	defer closeServer()

	client := NewTCPClient(codec.DefaultPacketConfig())

	if err := client.Connect(addr); err != nil {
		t.Fatalf("Connect error: %v", err)
	}

	if err := client.Disconnect(); err != nil {
		t.Fatalf("Disconnect error: %v", err)
	}

	// 重复断开应无操作
	if err := client.Disconnect(); err != nil {
		t.Fatalf("second Disconnect should be no-op, got error: %v", err)
	}
}

func TestTCPClientSendReceive(t *testing.T) {
	addr, closeServer := startEchoServer(t)
	defer closeServer()

	cfg := codec.DefaultPacketConfig()
	client := NewTCPClient(cfg)

	received := make(chan []byte, 1)
	client.OnReceive(func(conn Conn, data []byte) {
		cp := make([]byte, len(data))
		copy(cp, data)
		received <- cp
	})

	if err := client.Connect(addr); err != nil {
		t.Fatalf("Connect error: %v", err)
	}
	defer client.Disconnect()

	// 编码并发送一个数据包
	pkt := &codec.Packet{Route: 1001, Seq: 1, Data: []byte("hello")}
	frame, err := codec.Encode(pkt, cfg)
	if err != nil {
		t.Fatalf("Encode error: %v", err)
	}

	if err := client.Send(frame); err != nil {
		t.Fatalf("Send error: %v", err)
	}

	// 等待接收回调触发
	select {
	case data := <-received:
		if !bytes.Equal(data, frame) {
			t.Fatalf("received data mismatch:\n  got:  %v\n  want: %v", data, frame)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for receive callback")
	}
}

func TestTCPClientReceiveFromServer(t *testing.T) {
	cfg := codec.DefaultPacketConfig()

	// 服务端主动发送一个心跳包
	hbPkt := &codec.Packet{Heartbeat: true, ExtCode: 0}
	hbFrame, _ := codec.Encode(hbPkt, cfg)

	addr, closeServer := startSendServer(t, hbFrame)
	defer closeServer()

	client := NewTCPClient(cfg)

	received := make(chan []byte, 1)
	client.OnReceive(func(conn Conn, data []byte) {
		cp := make([]byte, len(data))
		copy(cp, data)
		received <- cp
	})

	if err := client.Connect(addr); err != nil {
		t.Fatalf("Connect error: %v", err)
	}
	defer client.Disconnect()

	select {
	case data := <-received:
		if !bytes.Equal(data, hbFrame) {
			t.Fatalf("received heartbeat mismatch:\n  got:  %v\n  want: %v", data, hbFrame)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for heartbeat receive")
	}
}

func TestTCPClientConnectCallback(t *testing.T) {
	addr, closeServer := startEchoServer(t)
	defer closeServer()

	client := NewTCPClient(codec.DefaultPacketConfig())

	connected := make(chan Conn, 1)
	client.OnConnect(func(conn Conn) {
		connected <- conn
	})

	if err := client.Connect(addr); err != nil {
		t.Fatalf("Connect error: %v", err)
	}
	defer client.Disconnect()

	select {
	case conn := <-connected:
		if conn == nil {
			t.Fatal("OnConnect callback received nil conn")
		}
		if conn.RemoteAddr() == nil {
			t.Fatal("RemoteAddr is nil")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for connect callback")
	}
}

func TestTCPClientDisconnectCallback(t *testing.T) {
	// 启动一个接受连接后立即关闭的服务器
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen error: %v", err)
	}
	defer ln.Close()

	ready := make(chan struct{})
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		close(ready)
		// 等待客户端 readLoop 启动
		time.Sleep(100 * time.Millisecond)
		conn.Close()
	}()

	client := NewTCPClient(codec.DefaultPacketConfig())
	client.SetReconnectConfig(ReconnectConfig{Enable: false}) // 禁用重连

	disconnected := make(chan error, 1)
	client.OnDisconnect(func(conn Conn, err error) {
		disconnected <- err
	})

	if err := client.Connect(ln.Addr().String()); err != nil {
		t.Fatalf("Connect error: %v", err)
	}

	<-ready

	select {
	case <-disconnected:
		// 断开回调触发成功
	case <-time.After(5 * time.Second):
		t.Fatal("timeout waiting for disconnect callback")
	}
}

func TestTCPClientSendWhenDisconnected(t *testing.T) {
	client := NewTCPClient(codec.DefaultPacketConfig())

	err := client.Send([]byte("test"))
	if err == nil {
		t.Fatal("expected error when sending on disconnected client")
	}
}

func TestTCPClientImplementsInterface(t *testing.T) {
	// 编译期验证 TCPClient 实现了 Client 接口
	var _ Client = (*TCPClient)(nil)
}
