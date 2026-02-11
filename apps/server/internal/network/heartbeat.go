package network

import (
	"sync"
	"time"

	"github.com/flow-packet/server/internal/codec"
)

// HeartbeatConfig 心跳配置
type HeartbeatConfig struct {
	Enable   bool          // 是否启用心跳
	Interval time.Duration // 心跳发送间隔（默认 15s）
	Timeout  time.Duration // 心跳超时时间（默认 45s）
}

// DefaultHeartbeatConfig 默认心跳配置
func DefaultHeartbeatConfig() HeartbeatConfig {
	return HeartbeatConfig{
		Enable:   true,
		Interval: 15 * time.Second,
		Timeout:  45 * time.Second,
	}
}

// Heartbeat 心跳模块，独立 goroutine 定时发送心跳并监测超时
type Heartbeat struct {
	cfg       HeartbeatConfig
	packetCfg codec.PacketConfig
	sendFn    func(data []byte) error
	onTimeout func()

	mu           sync.Mutex
	lastReceived time.Time
	stopCh       chan struct{}
	running      bool
}

// NewHeartbeat 创建心跳模块
func NewHeartbeat(cfg HeartbeatConfig, packetCfg codec.PacketConfig) *Heartbeat {
	return &Heartbeat{
		cfg:       cfg,
		packetCfg: packetCfg,
	}
}

// OnSend 注册心跳发送函数
func (h *Heartbeat) OnSend(fn func(data []byte) error) {
	h.sendFn = fn
}

// OnTimeout 注册超时回调
func (h *Heartbeat) OnTimeout(fn func()) {
	h.onTimeout = fn
}

// Start 启动心跳发送和超时检测
func (h *Heartbeat) Start() {
	if !h.cfg.Enable {
		return
	}

	h.mu.Lock()
	if h.running {
		h.mu.Unlock()
		return
	}
	h.running = true
	h.lastReceived = time.Now()
	h.stopCh = make(chan struct{})
	h.mu.Unlock()

	go h.loop()
}

// Stop 停止心跳
func (h *Heartbeat) Stop() {
	h.mu.Lock()
	defer h.mu.Unlock()
	if !h.running {
		return
	}
	h.running = false
	close(h.stopCh)
}

// Feed 喂狗——更新最后接收心跳时间
func (h *Heartbeat) Feed() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.lastReceived = time.Now()
}

// Running 返回心跳是否正在运行
func (h *Heartbeat) Running() bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.running
}

func (h *Heartbeat) loop() {
	ticker := time.NewTicker(h.cfg.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-h.stopCh:
			return
		case <-ticker.C:
			// 发送心跳包
			h.sendHeartbeat()

			// 检测超时
			h.mu.Lock()
			elapsed := time.Since(h.lastReceived)
			h.mu.Unlock()

			if elapsed > h.cfg.Timeout {
				if h.onTimeout != nil {
					h.onTimeout()
				}
				h.mu.Lock()
				h.running = false
				h.mu.Unlock()
				return
			}
		}
	}
}

func (h *Heartbeat) sendHeartbeat() {
	if h.sendFn == nil {
		return
	}

	pkt := &codec.Packet{
		Heartbeat: true,
		ExtCode:   0,
	}

	data, err := codec.Encode(pkt, h.packetCfg)
	if err != nil {
		return
	}

	h.sendFn(data)
}
