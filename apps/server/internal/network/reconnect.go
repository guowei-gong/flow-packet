package network

import (
	"sync"
	"time"
)

// ReconnectConfig 重连配置
type ReconnectConfig struct {
	Enable      bool          // 是否启用重连
	InitialWait time.Duration // 初始等待时间（默认 1s）
	MaxWait     time.Duration // 最大等待时间（默认 30s）
	MaxRetries  int           // 最大重试次数（默认 10，0 表示无限制）
	Multiplier  float64       // 退避倍数（默认 2.0）
}

// DefaultReconnectConfig 默认重连配置
func DefaultReconnectConfig() ReconnectConfig {
	return ReconnectConfig{
		Enable:      true,
		InitialWait: 1 * time.Second,
		MaxWait:     30 * time.Second,
		MaxRetries:  10,
		Multiplier:  2.0,
	}
}

// Reconnector 断线重连模块
type Reconnector struct {
	cfg     ReconnectConfig
	mu      sync.Mutex
	retries int
	stopped bool
	stopCh  chan struct{}
}

// NewReconnector 创建重连器
func NewReconnector(cfg ReconnectConfig) *Reconnector {
	return &Reconnector{
		cfg:    cfg,
		stopCh: make(chan struct{}),
	}
}

// BackoffDuration 计算第 n 次重试的退避等待时间（从 0 开始计数）
func (r *Reconnector) BackoffDuration(retry int) time.Duration {
	wait := r.cfg.InitialWait
	for i := 0; i < retry; i++ {
		wait = time.Duration(float64(wait) * r.cfg.Multiplier)
		if wait > r.cfg.MaxWait {
			wait = r.cfg.MaxWait
			break
		}
	}
	return wait
}

// Start 启动重连流程，每次尝试调用 connectFn，成功后调用 onSuccess，达到上限调用 onGiveUp
func (r *Reconnector) Start(connectFn func() error, onSuccess func(), onGiveUp func(retries int)) {
	r.mu.Lock()
	if !r.cfg.Enable || r.stopped {
		r.mu.Unlock()
		return
	}
	r.retries = 0
	r.stopCh = make(chan struct{})
	r.mu.Unlock()

	go r.run(connectFn, onSuccess, onGiveUp)
}

// Stop 停止重连
func (r *Reconnector) Stop() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.stopped {
		return
	}
	r.stopped = true
	select {
	case <-r.stopCh:
	default:
		close(r.stopCh)
	}
}

// Reset 重置重连器状态，以便复用
func (r *Reconnector) Reset() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.retries = 0
	r.stopped = false
	r.stopCh = make(chan struct{})
}

// Retries 返回当前重试次数
func (r *Reconnector) Retries() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.retries
}

func (r *Reconnector) run(connectFn func() error, onSuccess func(), onGiveUp func(retries int)) {
	for {
		r.mu.Lock()
		if r.stopped {
			r.mu.Unlock()
			return
		}

		if r.cfg.MaxRetries > 0 && r.retries >= r.cfg.MaxRetries {
			retries := r.retries
			r.mu.Unlock()
			if onGiveUp != nil {
				onGiveUp(retries)
			}
			return
		}

		retry := r.retries
		r.retries++
		r.mu.Unlock()

		wait := r.BackoffDuration(retry)

		select {
		case <-r.stopCh:
			return
		case <-time.After(wait):
		}

		// 检查是否被停止
		r.mu.Lock()
		if r.stopped {
			r.mu.Unlock()
			return
		}
		r.mu.Unlock()

		if err := connectFn(); err != nil {
			continue
		}

		// 连接成功
		if onSuccess != nil {
			onSuccess()
		}
		return
	}
}
