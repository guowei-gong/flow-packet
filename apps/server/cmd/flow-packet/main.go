package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/flow-packet/server/internal/api"
	"github.com/flow-packet/server/internal/codec"
	"github.com/flow-packet/server/internal/engine"
	"github.com/flow-packet/server/internal/network"
	"google.golang.org/protobuf/reflect/protoreflect"
)

func main() {
	// 工作目录
	workDir, err := os.UserConfigDir()
	if err != nil {
		workDir = os.TempDir()
	}
	dataDir := filepath.Join(workDir, "flow-packet")
	protoDir := filepath.Join(dataDir, "proto")
	os.MkdirAll(protoDir, 0755)

	// 协议配置
	packetCfg := codec.PacketConfig{
		RouteBytes: 2,
		SeqBytes:   2,
	}

	// 初始化 TCP 客户端
	tcpClient := network.NewTCPClient(packetCfg)

	// 初始化执行引擎
	runner := engine.NewRunner(packetCfg)
	runner.SetSendFunc(func(data []byte) error {
		return tcpClient.Send(data)
	})

	// 初始化 API 服务
	srv := api.NewServer()
	appState := api.NewAppState(protoDir)
	api.RegisterHandlers(srv, appState)

	// 注册连接管理 handlers
	registerConnHandlers(srv, tcpClient, &packetCfg, runner)

	// 注册流程执行 handlers
	registerFlowHandlers(srv, runner, appState)

	// TCP 收包回调 → 匹配 seq 响应
	// 注意：闭包捕获 packetCfg 变量（而非值），registerConnHandlers 通过指针更新后，
	// 此处下次调用即使用新配置
	tcpClient.OnReceive(func(conn network.Conn, data []byte) {
		pkt, err := codec.DecodeBytes(data, packetCfg)
		if err != nil {
			return
		}
		if pkt.IsHeartbeat() {
			return
		}
		// 先精确匹配 seq；若服务端不回传 seq（seq=0），回退到匹配最早的等待请求
		if !runner.SeqCtx().Resolve(pkt.Seq, pkt.Data) {
			runner.SeqCtx().ResolveFirst(pkt.Data)
		}
	})

	// TCP 连接状态推送
	tcpClient.OnConnect(func(conn network.Conn) {
		srv.Broadcast(api.ServerMessage{
			Event:   "conn.status",
			Payload: map[string]any{"state": "connected", "addr": conn.RemoteAddr().String()},
		})
	})
	tcpClient.OnDisconnect(func(conn network.Conn, err error) {
		srv.Broadcast(api.ServerMessage{
			Event:   "conn.status",
			Payload: map[string]any{"state": "disconnected"},
		})
	})

	// 启动 HTTP/WS 服务（固定端口，与前端 fallback 一致）
	port, err := srv.Start(58996)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to start server: %v\n", err)
		os.Exit(1)
	}

	// 输出端口号供 Electron 读取
	fmt.Printf("PORT:%d\n", port)

	// 等待退出信号
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	// 优雅退出
	tcpClient.Disconnect()
	srv.Stop()
}

func registerConnHandlers(srv *api.Server, client *network.TCPClient, packetCfg *codec.PacketConfig, runner *engine.Runner) {
	srv.Handle("conn.connect", func(payload json.RawMessage) (any, error) {
		var req struct {
			Host      string `json:"host"`
			Port      int    `json:"port"`
			Timeout   int    `json:"timeout"`
			Reconnect bool   `json:"reconnect"`
			Heartbeat bool   `json:"heartbeat"`
			FrameFields []struct {
				Name    string `json:"name"`
				Bytes   int    `json:"bytes"`
				IsRoute bool   `json:"isRoute"`
				IsSeq   bool   `json:"isSeq"`
			} `json:"frameFields"`
		}
		if err := json.Unmarshal(payload, &req); err != nil {
			return nil, fmt.Errorf("invalid payload: %w", err)
		}

		// 根据 frameFields 动态计算 PacketConfig
		if len(req.FrameFields) > 0 {
			// Due 检测：存在 name=="header" && bytes==1 → legacy 模式
			isDue := false
			for _, f := range req.FrameFields {
				if strings.ToLower(f.Name) == "header" && f.Bytes == 1 {
					isDue = true
					break
				}
			}

			if isDue {
				// Legacy Due 模式：只计算 RouteBytes/SeqBytes
				var routeBytes, seqBytes int
				for _, f := range req.FrameFields {
					if f.IsRoute {
						routeBytes += f.Bytes
					}
					if f.IsSeq || strings.ToLower(f.Name) == "seq" {
						seqBytes = f.Bytes
					}
				}
				newCfg := codec.PacketConfig{
					RouteBytes: routeBytes,
					SeqBytes:   seqBytes,
				}
				*packetCfg = newCfg
				client.SetPacketConfig(newCfg)
				runner.SetPacketConfig(newCfg)
			} else {
				// 字段驱动模式
				fields := make([]codec.FieldDef, len(req.FrameFields))
				for i, f := range req.FrameFields {
					fields[i] = codec.FieldDef{
						Name:    f.Name,
						Bytes:   f.Bytes,
						IsRoute: f.IsRoute,
						IsSeq:   f.IsSeq,
					}
				}
				fdCfg, err := codec.NewFieldDrivenConfig(fields)
				if err != nil {
					return nil, fmt.Errorf("invalid frame fields: %w", err)
				}
				newCfg := codec.PacketConfig{
					FieldDriven: fdCfg,
				}
				*packetCfg = newCfg
				client.SetPacketConfig(newCfg)
				runner.SetPacketConfig(newCfg)
			}
		}

		addr := fmt.Sprintf("%s:%d", req.Host, req.Port)

		client.SetReconnectConfig(network.ReconnectConfig{
			Enable:      req.Reconnect,
			MaxRetries:  10,
			InitialWait: 1_000_000_000,  // 1s
			MaxWait:     30_000_000_000, // 30s
			Multiplier:  2.0,
		})

		if err := client.Connect(addr); err != nil {
			return nil, fmt.Errorf("connect failed: %w", err)
		}

		return map[string]string{"status": "connected"}, nil
	})

	srv.Handle("conn.disconnect", func(payload json.RawMessage) (any, error) {
		if err := client.Disconnect(); err != nil {
			return nil, fmt.Errorf("disconnect failed: %w", err)
		}
		return map[string]string{"status": "disconnected"}, nil
	})

	srv.Handle("conn.status", func(payload json.RawMessage) (any, error) {
		return map[string]string{"state": client.State().String()}, nil
	})
}

func registerFlowHandlers(srv *api.Server, runner *engine.Runner, state *api.AppState) {
	srv.Handle("flow.execute", func(payload json.RawMessage) (any, error) {
		var req struct {
			Nodes []engine.FlowNode `json:"nodes"`
			Edges []engine.FlowEdge `json:"edges"`
		}
		if err := json.Unmarshal(payload, &req); err != nil {
			return nil, fmt.Errorf("invalid payload: %w", err)
		}

		// 设置消息解析器
		runner.SetResolver(func(messageName string) protoreflect.MessageDescriptor {
			if state.ParseResult == nil {
				return nil
			}
			md := state.ParseResult.FindMessageDescriptor(messageName)
			return md
		})

		// 设置响应解析器
		runner.SetResponseResolver(func(route uint32) protoreflect.MessageDescriptor {
			mapping, ok := state.RouteMappings[route]
			if !ok || state.ParseResult == nil {
				return nil
			}
			return state.ParseResult.FindMessageDescriptor(mapping.ResponseMsg)
		})

		// 异步执行
		go func() {
			srv.Broadcast(api.ServerMessage{
				Event: "flow.started",
			})

			err := runner.Execute(context.Background(), req.Nodes, req.Edges, func(result engine.NodeResult) {
				if result.Success {
					srv.Broadcast(api.ServerMessage{
						Event:   "node.result",
						Payload: result,
					})
				} else {
					srv.Broadcast(api.ServerMessage{
						Event:   "node.error",
						Payload: map[string]any{"nodeId": result.NodeID, "error": result.Error},
					})
				}
			})

			if err != nil {
				srv.Broadcast(api.ServerMessage{
					Event:   "flow.error",
					Payload: map[string]any{"error": err.Error()},
				})
			} else {
				srv.Broadcast(api.ServerMessage{
					Event: "flow.complete",
				})
			}
		}()

		return map[string]string{"status": "started"}, nil
	})

	srv.Handle("flow.stop", func(payload json.RawMessage) (any, error) {
		runner.Stop()
		return map[string]string{"status": "stopped"}, nil
	})
}
