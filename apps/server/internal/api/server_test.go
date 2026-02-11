package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestServerStartStop(t *testing.T) {
	srv := NewServer()
	port, err := srv.Start()
	if err != nil {
		t.Fatalf("Start error: %v", err)
	}
	defer srv.Stop()

	if port <= 0 {
		t.Fatalf("invalid port: %d", port)
	}

	// 验证 HTTP 可访问
	resp, err := http.Get(fmt.Sprintf("http://127.0.0.1:%d/ws", port))
	if err != nil {
		t.Fatalf("HTTP request error: %v", err)
	}
	resp.Body.Close()
}

func TestWebSocketHandshake(t *testing.T) {
	srv := NewServer()
	port, err := srv.Start()
	if err != nil {
		t.Fatalf("Start error: %v", err)
	}
	defer srv.Stop()

	url := fmt.Sprintf("ws://127.0.0.1:%d/ws", port)
	ws, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("WebSocket dial error: %v", err)
	}
	defer ws.Close()
}

func TestMessageRouting(t *testing.T) {
	srv := NewServer()

	// 注册 handler
	srv.Handle("ping", func(payload json.RawMessage) (any, error) {
		return map[string]string{"pong": "ok"}, nil
	})

	port, err := srv.Start()
	if err != nil {
		t.Fatalf("Start error: %v", err)
	}
	defer srv.Stop()

	ws, _, err := websocket.DefaultDialer.Dial(fmt.Sprintf("ws://127.0.0.1:%d/ws", port), nil)
	if err != nil {
		t.Fatalf("Dial error: %v", err)
	}
	defer ws.Close()

	// 发送请求
	req := ClientMessage{ID: "1", Action: "ping"}
	if err := ws.WriteJSON(req); err != nil {
		t.Fatalf("WriteJSON error: %v", err)
	}

	// 读取响应
	ws.SetReadDeadline(time.Now().Add(2 * time.Second))
	var resp ServerMessage
	if err := ws.ReadJSON(&resp); err != nil {
		t.Fatalf("ReadJSON error: %v", err)
	}

	if resp.ID != "1" {
		t.Fatalf("resp.ID = %q, want %q", resp.ID, "1")
	}
	if resp.Event != "ping" {
		t.Fatalf("resp.Event = %q, want %q", resp.Event, "ping")
	}
}

func TestUnknownAction(t *testing.T) {
	srv := NewServer()
	port, err := srv.Start()
	if err != nil {
		t.Fatalf("Start error: %v", err)
	}
	defer srv.Stop()

	ws, _, err := websocket.DefaultDialer.Dial(fmt.Sprintf("ws://127.0.0.1:%d/ws", port), nil)
	if err != nil {
		t.Fatalf("Dial error: %v", err)
	}
	defer ws.Close()

	req := ClientMessage{ID: "2", Action: "nonexistent"}
	ws.WriteJSON(req)

	ws.SetReadDeadline(time.Now().Add(2 * time.Second))
	var resp ServerMessage
	ws.ReadJSON(&resp)

	if resp.Event != "error" {
		t.Fatalf("resp.Event = %q, want %q", resp.Event, "error")
	}
	if resp.ID != "2" {
		t.Fatalf("resp.ID = %q, want %q", resp.ID, "2")
	}
}

func TestInvalidJSON(t *testing.T) {
	srv := NewServer()
	port, err := srv.Start()
	if err != nil {
		t.Fatalf("Start error: %v", err)
	}
	defer srv.Stop()

	ws, _, err := websocket.DefaultDialer.Dial(fmt.Sprintf("ws://127.0.0.1:%d/ws", port), nil)
	if err != nil {
		t.Fatalf("Dial error: %v", err)
	}
	defer ws.Close()

	// 发送畸形 JSON
	ws.WriteMessage(websocket.TextMessage, []byte("{invalid"))

	ws.SetReadDeadline(time.Now().Add(2 * time.Second))
	var resp ServerMessage
	ws.ReadJSON(&resp)

	if resp.Event != "error" {
		t.Fatalf("resp.Event = %q, want %q", resp.Event, "error")
	}
}

func TestHandlerError(t *testing.T) {
	srv := NewServer()
	srv.Handle("fail", func(payload json.RawMessage) (any, error) {
		return nil, fmt.Errorf("something went wrong")
	})

	port, err := srv.Start()
	if err != nil {
		t.Fatalf("Start error: %v", err)
	}
	defer srv.Stop()

	ws, _, err := websocket.DefaultDialer.Dial(fmt.Sprintf("ws://127.0.0.1:%d/ws", port), nil)
	if err != nil {
		t.Fatalf("Dial error: %v", err)
	}
	defer ws.Close()

	ws.WriteJSON(ClientMessage{ID: "3", Action: "fail"})

	ws.SetReadDeadline(time.Now().Add(2 * time.Second))
	var resp ServerMessage
	ws.ReadJSON(&resp)

	if resp.Event != "error" {
		t.Fatalf("resp.Event = %q, want %q", resp.Event, "error")
	}

	payload, _ := json.Marshal(resp.Payload)
	if !strings.Contains(string(payload), "something went wrong") {
		t.Fatalf("error message not found in payload: %s", payload)
	}
}

func TestBroadcast(t *testing.T) {
	srv := NewServer()
	port, err := srv.Start()
	if err != nil {
		t.Fatalf("Start error: %v", err)
	}
	defer srv.Stop()

	// 连接两个客户端
	url := fmt.Sprintf("ws://127.0.0.1:%d/ws", port)
	ws1, _, _ := websocket.DefaultDialer.Dial(url, nil)
	defer ws1.Close()
	ws2, _, _ := websocket.DefaultDialer.Dial(url, nil)
	defer ws2.Close()

	// 等待连接注册
	time.Sleep(50 * time.Millisecond)

	// 广播消息
	srv.Broadcast(ServerMessage{Event: "test.broadcast", Payload: "hello"})

	// 两个客户端都应收到
	for i, ws := range []*websocket.Conn{ws1, ws2} {
		ws.SetReadDeadline(time.Now().Add(2 * time.Second))
		var resp ServerMessage
		if err := ws.ReadJSON(&resp); err != nil {
			t.Fatalf("client %d ReadJSON error: %v", i+1, err)
		}
		if resp.Event != "test.broadcast" {
			t.Fatalf("client %d event = %q, want %q", i+1, resp.Event, "test.broadcast")
		}
	}
}

func TestHandlerWithPayload(t *testing.T) {
	srv := NewServer()
	srv.Handle("echo", func(payload json.RawMessage) (any, error) {
		var data map[string]any
		json.Unmarshal(payload, &data)
		return data, nil
	})

	port, err := srv.Start()
	if err != nil {
		t.Fatalf("Start error: %v", err)
	}
	defer srv.Stop()

	ws, _, _ := websocket.DefaultDialer.Dial(fmt.Sprintf("ws://127.0.0.1:%d/ws", port), nil)
	defer ws.Close()

	msg := `{"id":"4","action":"echo","payload":{"key":"value"}}`
	ws.WriteMessage(websocket.TextMessage, []byte(msg))

	ws.SetReadDeadline(time.Now().Add(2 * time.Second))
	var resp ServerMessage
	ws.ReadJSON(&resp)

	if resp.ID != "4" {
		t.Fatalf("resp.ID = %q, want %q", resp.ID, "4")
	}
	if resp.Event != "echo" {
		t.Fatalf("resp.Event = %q, want %q", resp.Event, "echo")
	}
}
