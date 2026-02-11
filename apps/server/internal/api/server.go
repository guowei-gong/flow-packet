// Package api 提供 HTTP/WebSocket API 服务层
package api

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// ClientMessage 前端发送的消息格式
type ClientMessage struct {
	ID      string          `json:"id"`
	Action  string          `json:"action"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// ServerMessage 发送给前端的消息格式
type ServerMessage struct {
	ID      string `json:"id,omitempty"`
	Event   string `json:"event"`
	Payload any    `json:"payload,omitempty"`
}

// HandlerFunc 处理函数签名
type HandlerFunc func(payload json.RawMessage) (any, error)

// Server HTTP/WebSocket 服务器
type Server struct {
	mu       sync.RWMutex
	handlers map[string]HandlerFunc
	clients  map[*wsClient]struct{}
	listener net.Listener
	mux      *http.ServeMux

	upgrader websocket.Upgrader
}

// NewServer 创建服务器实例
func NewServer() *Server {
	s := &Server{
		handlers: make(map[string]HandlerFunc),
		clients:  make(map[*wsClient]struct{}),
		mux:      http.NewServeMux(),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}

	s.mux.HandleFunc("/ws", s.handleWebSocket)
	return s
}

// Handle 注册消息处理函数
func (s *Server) Handle(action string, handler HandlerFunc) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.handlers[action] = handler
}

// HandleHTTP 注册 HTTP 路由
func (s *Server) HandleHTTP(pattern string, handler http.HandlerFunc) {
	s.mux.HandleFunc(pattern, handler)
}

// Start 启动服务器，动态分配端口
func (s *Server) Start() (int, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, fmt.Errorf("listen: %w", err)
	}

	s.listener = ln
	port := ln.Addr().(*net.TCPAddr).Port

	go http.Serve(ln, s.mux)

	return port, nil
}

// Stop 停止服务器
func (s *Server) Stop() error {
	if s.listener != nil {
		return s.listener.Close()
	}
	return nil
}

// Broadcast 向所有连接的客户端广播消息
func (s *Server) Broadcast(msg ServerMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	for c := range s.clients {
		c.send(data)
	}
}

// handleWebSocket WebSocket 升级处理
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := newWSClient(conn, s)

	s.mu.Lock()
	s.clients[client] = struct{}{}
	s.mu.Unlock()

	go client.readPump()
	go client.writePump()
}

// removeClient 移除客户端
func (s *Server) removeClient(c *wsClient) {
	s.mu.Lock()
	delete(s.clients, c)
	s.mu.Unlock()
}

// routeMessage 路由消息到对应的 handler
func (s *Server) routeMessage(msg ClientMessage) ServerMessage {
	s.mu.RLock()
	handler, ok := s.handlers[msg.Action]
	s.mu.RUnlock()

	if !ok {
		return ServerMessage{
			ID:    msg.ID,
			Event: "error",
			Payload: map[string]string{
				"message": fmt.Sprintf("unknown action: %s", msg.Action),
			},
		}
	}

	result, err := handler(msg.Payload)
	if err != nil {
		return ServerMessage{
			ID:    msg.ID,
			Event: "error",
			Payload: map[string]string{
				"message": err.Error(),
			},
		}
	}

	return ServerMessage{
		ID:      msg.ID,
		Event:   msg.Action,
		Payload: result,
	}
}

// wsClient WebSocket 客户端连接
type wsClient struct {
	conn   *websocket.Conn
	server *Server
	sendCh chan []byte
	done   chan struct{}
}

func newWSClient(conn *websocket.Conn, server *Server) *wsClient {
	return &wsClient{
		conn:   conn,
		server: server,
		sendCh: make(chan []byte, 256),
		done:   make(chan struct{}),
	}
}

func (c *wsClient) send(data []byte) {
	select {
	case c.sendCh <- data:
	case <-c.done:
	default:
		// drop if channel full
	}
}

func (c *wsClient) readPump() {
	defer func() {
		c.server.removeClient(c)
		c.conn.Close()
		close(c.done)
	}()

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			return
		}

		var clientMsg ClientMessage
		if err := json.Unmarshal(message, &clientMsg); err != nil {
			resp := ServerMessage{
				Event: "error",
				Payload: map[string]string{
					"message": "invalid JSON",
				},
			}
			data, _ := json.Marshal(resp)
			c.send(data)
			continue
		}

		resp := c.server.routeMessage(clientMsg)
		data, err := json.Marshal(resp)
		if err != nil {
			continue
		}
		c.send(data)
	}
}

func (c *wsClient) writePump() {
	defer c.conn.Close()

	for {
		select {
		case <-c.done:
			return
		case data := <-c.sendCh:
			if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}
		}
	}
}
