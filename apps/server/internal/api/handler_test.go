package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func setupTestServer(t *testing.T) (*Server, *AppState, int) {
	t.Helper()
	tmpDir, err := os.MkdirTemp("", "proto-test-*")
	if err != nil {
		t.Fatalf("create temp dir: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(tmpDir) })

	state := NewAppState(tmpDir)
	srv := NewServer()
	RegisterHandlers(srv, state)

	port, err := srv.Start()
	if err != nil {
		t.Fatalf("Start error: %v", err)
	}
	t.Cleanup(func() { srv.Stop() })

	return srv, state, port
}

func createMultipartBody(t *testing.T, files map[string]string) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	for name, content := range files {
		part, err := writer.CreateFormFile("files", name)
		if err != nil {
			t.Fatalf("create form file: %v", err)
		}
		part.Write([]byte(content))
	}

	writer.Close()
	return body, writer.FormDataContentType()
}

func TestProtoUpload(t *testing.T) {
	_, _, port := setupTestServer(t)

	protoContent := `syntax = "proto3";
package test;
message Ping { int64 timestamp = 1; }
message Pong { int64 timestamp = 1; string message = 2; }
`
	body, contentType := createMultipartBody(t, map[string]string{
		"test.proto": protoContent,
	})

	resp, err := http.Post(
		fmt.Sprintf("http://127.0.0.1:%d/api/proto/upload", port),
		contentType,
		body,
	)
	if err != nil {
		t.Fatalf("POST error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("status = %d, body = %s", resp.StatusCode, respBody)
	}

	var result map[string]any
	json.NewDecoder(resp.Body).Decode(&result)

	messages, ok := result["messages"].([]any)
	if !ok {
		t.Fatalf("messages type = %T", result["messages"])
	}
	if len(messages) != 2 {
		t.Fatalf("message count = %d, want 2", len(messages))
	}
}

func TestProtoUploadInvalidFile(t *testing.T) {
	_, _, port := setupTestServer(t)

	body, contentType := createMultipartBody(t, map[string]string{
		"readme.txt": "not a proto file",
	})

	resp, err := http.Post(
		fmt.Sprintf("http://127.0.0.1:%d/api/proto/upload", port),
		contentType,
		body,
	)
	if err != nil {
		t.Fatalf("POST error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
}

func TestProtoUploadNoFiles(t *testing.T) {
	_, _, port := setupTestServer(t)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.Close()

	resp, err := http.Post(
		fmt.Sprintf("http://127.0.0.1:%d/api/proto/upload", port),
		writer.FormDataContentType(),
		body,
	)
	if err != nil {
		t.Fatalf("POST error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
}

func wsRequest(t *testing.T, ws *websocket.Conn, id, action string, payload any) ServerMessage {
	t.Helper()
	msg := map[string]any{"id": id, "action": action}
	if payload != nil {
		p, _ := json.Marshal(payload)
		msg["payload"] = json.RawMessage(p)
	}
	ws.WriteJSON(msg)
	ws.SetReadDeadline(time.Now().Add(2 * time.Second))
	var resp ServerMessage
	if err := ws.ReadJSON(&resp); err != nil {
		t.Fatalf("ReadJSON error: %v", err)
	}
	return resp
}

func TestProtoListEmpty(t *testing.T) {
	_, _, port := setupTestServer(t)

	ws, _, err := websocket.DefaultDialer.Dial(fmt.Sprintf("ws://127.0.0.1:%d/ws", port), nil)
	if err != nil {
		t.Fatalf("Dial error: %v", err)
	}
	defer ws.Close()

	resp := wsRequest(t, ws, "1", "proto.list", nil)
	if resp.Event != "proto.list" {
		t.Fatalf("event = %q, want %q", resp.Event, "proto.list")
	}
}

func TestRouteSetListDelete(t *testing.T) {
	_, _, port := setupTestServer(t)

	ws, _, err := websocket.DefaultDialer.Dial(fmt.Sprintf("ws://127.0.0.1:%d/ws", port), nil)
	if err != nil {
		t.Fatalf("Dial error: %v", err)
	}
	defer ws.Close()

	// 设置 route 映射
	resp := wsRequest(t, ws, "1", "route.set", RouteMapping{
		Route:       1001,
		RequestMsg:  "game.LoginRequest",
		ResponseMsg: "game.LoginResponse",
	})
	if resp.Event != "route.set" {
		t.Fatalf("set event = %q, want %q", resp.Event, "route.set")
	}

	// 列出 route 映射
	resp = wsRequest(t, ws, "2", "route.list", nil)
	if resp.Event != "route.list" {
		t.Fatalf("list event = %q, want %q", resp.Event, "route.list")
	}
	payload, _ := json.Marshal(resp.Payload)
	var listResult struct {
		Routes []RouteMapping `json:"routes"`
	}
	json.Unmarshal(payload, &listResult)
	if len(listResult.Routes) != 1 {
		t.Fatalf("routes count = %d, want 1", len(listResult.Routes))
	}
	if listResult.Routes[0].Route != 1001 {
		t.Fatalf("route = %d, want 1001", listResult.Routes[0].Route)
	}

	// 删除 route
	resp = wsRequest(t, ws, "3", "route.delete", map[string]uint32{"route": 1001})
	if resp.Event != "route.delete" {
		t.Fatalf("delete event = %q, want %q", resp.Event, "route.delete")
	}

	// 验证已删除
	resp = wsRequest(t, ws, "4", "route.list", nil)
	payload, _ = json.Marshal(resp.Payload)
	json.Unmarshal(payload, &listResult)
	if len(listResult.Routes) != 0 {
		t.Fatalf("routes count after delete = %d, want 0", len(listResult.Routes))
	}
}

func TestRouteSetInvalid(t *testing.T) {
	_, _, port := setupTestServer(t)

	ws, _, err := websocket.DefaultDialer.Dial(fmt.Sprintf("ws://127.0.0.1:%d/ws", port), nil)
	if err != nil {
		t.Fatalf("Dial error: %v", err)
	}
	defer ws.Close()

	// route 为 0 应报错
	resp := wsRequest(t, ws, "1", "route.set", RouteMapping{
		Route:      0,
		RequestMsg: "test",
	})
	if resp.Event != "error" {
		t.Fatalf("event = %q, want %q", resp.Event, "error")
	}
}
