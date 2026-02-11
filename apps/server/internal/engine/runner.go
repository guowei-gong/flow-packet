package engine

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/flow-packet/server/internal/codec"
	"google.golang.org/protobuf/reflect/protoreflect"
)

// FlowNode 流程节点
type FlowNode struct {
	ID          string         `json:"id"`
	MessageName string         `json:"messageName"`
	Route       uint32         `json:"route"`
	Fields      map[string]any `json:"fields"`
}

// FlowEdge 流程边
type FlowEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

// NodeResult 节点执行结果
type NodeResult struct {
	NodeID   string         `json:"nodeId"`
	Success  bool           `json:"success"`
	Request  map[string]any `json:"request,omitempty"`
	Response map[string]any `json:"response,omitempty"`
	Error    string         `json:"error,omitempty"`
	Duration int64          `json:"duration"` // 毫秒
}

// NodeCallback 节点完成回调
type NodeCallback func(result NodeResult)

// MessageResolver 消息描述符解析器
type MessageResolver func(messageName string) protoreflect.MessageDescriptor

// Runner 串行流程执行器
type Runner struct {
	mu        sync.Mutex
	running   bool
	cancel    context.CancelFunc
	seqCtx    *SeqContext
	packetCfg codec.PacketConfig
	timeout   time.Duration
	sendFn    func(data []byte) error
	resolver  MessageResolver
}

// NewRunner 创建执行器
func NewRunner(packetCfg codec.PacketConfig) *Runner {
	return &Runner{
		seqCtx:    NewSeqContext(),
		packetCfg: packetCfg,
		timeout:   5 * time.Second,
	}
}

// SetSendFunc 设置发送函数
func (r *Runner) SetSendFunc(fn func(data []byte) error) {
	r.sendFn = fn
}

// SetResolver 设置消息解析器
func (r *Runner) SetResolver(resolver MessageResolver) {
	r.resolver = resolver
}

// SetTimeout 设置响应超时
func (r *Runner) SetTimeout(d time.Duration) {
	r.timeout = d
}

// SeqCtx 获取 seq 上下文（供外部匹配响应）
func (r *Runner) SeqCtx() *SeqContext {
	return r.seqCtx
}

// Running 返回是否正在执行
func (r *Runner) Running() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.running
}

// ResolveOrder 解析执行顺序，返回有序节点 ID 列表
func ResolveOrder(nodes []FlowNode, edges []FlowEdge) ([]string, error) {
	if len(nodes) == 0 {
		return nil, fmt.Errorf("empty node list")
	}

	// 构建邻接表和入度表
	nodeMap := make(map[string]*FlowNode)
	inDegree := make(map[string]int)
	outEdge := make(map[string]string) // source → target

	for i := range nodes {
		nodeMap[nodes[i].ID] = &nodes[i]
		inDegree[nodes[i].ID] = 0
	}

	for _, e := range edges {
		outEdge[e.Source] = e.Target
		inDegree[e.Target]++
	}

	// 找起点（入度为 0 的节点）
	var starts []string
	for id, deg := range inDegree {
		if deg == 0 {
			starts = append(starts, id)
		}
	}

	if len(starts) == 0 {
		return nil, fmt.Errorf("no start node found (cycle detected)")
	}
	if len(starts) > 1 {
		return nil, fmt.Errorf("multiple start nodes: %v", starts)
	}

	// 沿链遍历
	order := make([]string, 0, len(nodes))
	current := starts[0]
	visited := make(map[string]bool)

	for current != "" {
		if visited[current] {
			return nil, fmt.Errorf("cycle detected at node %s", current)
		}
		visited[current] = true
		order = append(order, current)
		current = outEdge[current]
	}

	if len(order) != len(nodes) {
		return nil, fmt.Errorf("disconnected graph: resolved %d of %d nodes", len(order), len(nodes))
	}

	return order, nil
}

// Execute 执行流程
func (r *Runner) Execute(ctx context.Context, nodes []FlowNode, edges []FlowEdge, onNode NodeCallback) error {
	order, err := ResolveOrder(nodes, edges)
	if err != nil {
		return err
	}

	nodeMap := make(map[string]*FlowNode)
	for i := range nodes {
		nodeMap[nodes[i].ID] = &nodes[i]
	}

	r.mu.Lock()
	if r.running {
		r.mu.Unlock()
		return fmt.Errorf("already running")
	}
	r.running = true
	execCtx, cancel := context.WithCancel(ctx)
	r.cancel = cancel
	r.seqCtx.Reset()
	r.mu.Unlock()

	defer func() {
		r.mu.Lock()
		r.running = false
		r.cancel = nil
		r.mu.Unlock()
	}()

	for _, nodeID := range order {
		select {
		case <-execCtx.Done():
			return execCtx.Err()
		default:
		}

		node := nodeMap[nodeID]
		result := r.executeNode(execCtx, node)
		if onNode != nil {
			onNode(result)
		}

		if !result.Success {
			return fmt.Errorf("node %s failed: %s", nodeID, result.Error)
		}
	}

	return nil
}

// Stop 停止执行
func (r *Runner) Stop() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.cancel != nil {
		r.cancel()
	}
}

// executeNode 执行单个节点
func (r *Runner) executeNode(ctx context.Context, node *FlowNode) NodeResult {
	start := time.Now()

	result := NodeResult{
		NodeID:  node.ID,
		Request: node.Fields,
	}

	// 解析 message descriptor
	if r.resolver == nil {
		result.Error = "message resolver not configured"
		result.Duration = time.Since(start).Milliseconds()
		return result
	}

	reqMd := r.resolver(node.MessageName)
	if reqMd == nil {
		result.Error = fmt.Sprintf("message %q not found", node.MessageName)
		result.Duration = time.Since(start).Milliseconds()
		return result
	}

	// 动态编码
	protoData, err := codec.DynamicEncode(reqMd, node.Fields)
	if err != nil {
		result.Error = fmt.Sprintf("encode: %v", err)
		result.Duration = time.Since(start).Milliseconds()
		return result
	}

	// 分配 seq
	seq, respCh := r.seqCtx.NextSeq()

	// 封装协议帧
	pkt := &codec.Packet{
		Route: node.Route,
		Seq:   seq,
		Data:  protoData,
	}

	frame, err := codec.Encode(pkt, r.packetCfg)
	if err != nil {
		result.Error = fmt.Sprintf("frame encode: %v", err)
		result.Duration = time.Since(start).Milliseconds()
		return result
	}

	// 发送
	if r.sendFn == nil {
		result.Error = "send function not configured"
		result.Duration = time.Since(start).Milliseconds()
		return result
	}

	if err := r.sendFn(frame); err != nil {
		result.Error = fmt.Sprintf("send: %v", err)
		result.Duration = time.Since(start).Milliseconds()
		return result
	}

	// 等待响应
	respData, err := r.seqCtx.WaitResponse(respCh, r.timeout)
	if err != nil {
		result.Error = fmt.Sprintf("wait response: %v", err)
		result.Duration = time.Since(start).Milliseconds()
		return result
	}

	// 解码响应帧
	respFrame, err := codec.DynamicDecode(respData, nil) // 先以 nil 解码获取 hex
	if err != nil {
		result.Error = fmt.Sprintf("decode response: %v", err)
		result.Duration = time.Since(start).Milliseconds()
		return result
	}

	result.Success = true
	result.Response = respFrame
	result.Duration = time.Since(start).Milliseconds()
	return result
}
