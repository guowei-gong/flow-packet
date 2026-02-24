package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/flow-packet/server/internal/parser"
)

// AppState 应用状态，在各 handler 间共享
type AppState struct {
	ProtoDir     string                   // proto 文件存储目录
	ParseResult  *parser.ParseResult      // 当前解析结果
	RouteMappings map[uint32]RouteMapping  // route 映射表
}

// RouteMapping route 值到 message 名称的映射
type RouteMapping struct {
	Route       uint32 `json:"route"`
	RequestMsg  string `json:"requestMsg"`
	ResponseMsg string `json:"responseMsg"`
}

// NewAppState 创建应用状态
func NewAppState(protoDir string) *AppState {
	os.MkdirAll(protoDir, 0755)
	return &AppState{
		ProtoDir:      protoDir,
		RouteMappings: make(map[uint32]RouteMapping),
	}
}

// RegisterHandlers 注册所有 API handlers
func RegisterHandlers(srv *Server, state *AppState) {
	// HTTP 路由
	srv.HandleHTTP("POST /api/proto/upload", makeProtoUploadHandler(state, srv))

	// WebSocket action 路由
	srv.Handle("proto.list", makeProtoListHandler(state))
	srv.Handle("route.list", makeRouteListHandler(state))
	srv.Handle("route.set", makeRouteSetHandler(state))
	srv.Handle("route.delete", makeRouteDeleteHandler(state))
}

// makeProtoUploadHandler 创建 Proto 文件上传处理函数
func makeProtoUploadHandler(state *AppState, srv *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		if err := r.ParseMultipartForm(32 << 20); err != nil {
			writeJSONError(w, http.StatusBadRequest, "failed to parse form")
			return
		}

		files := r.MultipartForm.File["files"]
		if len(files) == 0 {
			writeJSONError(w, http.StatusBadRequest, "no files uploaded")
			return
		}

		// 前端通过 paths 字段发送每个文件的相对路径（与 files 一一对应）
		paths := r.MultipartForm.Value["paths"]

		// 清空旧文件，避免残留文件干扰解析
		os.RemoveAll(state.ProtoDir)
		os.MkdirAll(state.ProtoDir, 0755)

		// 保存文件（保留子目录结构）
		for i, fh := range files {
			// 优先使用 paths 字段的相对路径，回退到 fh.Filename
			saveName := fh.Filename
			if i < len(paths) && paths[i] != "" {
				saveName = paths[i]
			}

			// 清理路径，防止目录穿越
			cleanName := filepath.Clean(saveName)
			if strings.Contains(cleanName, "..") {
				writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("invalid path: %s", saveName))
				return
			}
			if filepath.Ext(cleanName) != ".proto" {
				writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("invalid file type: %s", saveName))
				return
			}

			src, err := fh.Open()
			if err != nil {
				writeJSONError(w, http.StatusInternalServerError, "failed to open file")
				return
			}

			dstPath := filepath.Join(state.ProtoDir, cleanName)
			// 创建子目录
			if dir := filepath.Dir(dstPath); dir != "." {
				os.MkdirAll(dir, 0755)
			}

			dst, err := os.Create(dstPath)
			if err != nil {
				src.Close()
				writeJSONError(w, http.StatusInternalServerError, "failed to save file")
				return
			}

			io.Copy(dst, src)
			src.Close()
			dst.Close()
		}

		// 解析整个 protoDir 下所有 proto 文件
		result, err := parser.ParseProtoDir(state.ProtoDir)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("parse error: %v", err))
			return
		}

		state.ParseResult = result

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{
			"files":    result.Files,
			"messages": result.AllMessages(),
		})
	}
}

// makeProtoListHandler 创建 proto.list 处理函数
func makeProtoListHandler(state *AppState) HandlerFunc {
	return func(payload json.RawMessage) (any, error) {
		if state.ParseResult == nil {
			return map[string]any{
				"files":    []any{},
				"messages": []any{},
			}, nil
		}
		return map[string]any{
			"files":    state.ParseResult.Files,
			"messages": state.ParseResult.AllMessages(),
		}, nil
	}
}

// makeRouteListHandler 创建 route.list 处理函数
func makeRouteListHandler(state *AppState) HandlerFunc {
	return func(payload json.RawMessage) (any, error) {
		routes := make([]RouteMapping, 0, len(state.RouteMappings))
		for _, rm := range state.RouteMappings {
			routes = append(routes, rm)
		}
		return map[string]any{"routes": routes}, nil
	}
}

// makeRouteSetHandler 创建 route.set 处理函数
func makeRouteSetHandler(state *AppState) HandlerFunc {
	return func(payload json.RawMessage) (any, error) {
		var rm RouteMapping
		if err := json.Unmarshal(payload, &rm); err != nil {
			return nil, fmt.Errorf("invalid payload: %w", err)
		}
		if rm.Route == 0 {
			return nil, fmt.Errorf("route cannot be 0")
		}
		state.RouteMappings[rm.Route] = rm
		return map[string]string{"status": "ok"}, nil
	}
}

// makeRouteDeleteHandler 创建 route.delete 处理函数
func makeRouteDeleteHandler(state *AppState) HandlerFunc {
	return func(payload json.RawMessage) (any, error) {
		var req struct {
			Route uint32 `json:"route"`
		}
		if err := json.Unmarshal(payload, &req); err != nil {
			return nil, fmt.Errorf("invalid payload: %w", err)
		}
		delete(state.RouteMappings, req.Route)
		return map[string]string{"status": "ok"}, nil
	}
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
